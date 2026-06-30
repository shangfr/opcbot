"use client";

import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  Edit,
  Loader2,
  Power,
  PowerOff,
  Trash2,
  User as UserIcon,
} from "lucide-react";
import { createContext, useCallback, useContext, useMemo } from "react";
import useSWR from "swr";
import { cardVariants } from "@/components/ui/card";
import {
  type AgentGroupStyle,
  buildGroupFromCategory,
  DEFAULT_THEME,
  getAvatarChar,
} from "@/lib/agent-groups";
import type { Ticket, TicketCategory } from "@/lib/db/schema";
import { cn, fetcher } from "@/lib/utils";

/* ================================================================
 * 优先级 & 状态样式映射 —— 工单系统优化项
 * ================================================================ */

export type TicketPriority = "low" | "medium" | "high" | "urgent";
export type TicketStatus = "pending" | "in_progress" | "completed" | "closed";

export const PRIORITY_LABELS: Record<TicketPriority, string> = {
  low: "低",
  medium: "中",
  high: "高",
  urgent: "紧急",
};

export const PRIORITY_STYLES: Record<TicketPriority, string> = {
  low: "bg-slate-500/10 text-slate-600 dark:text-slate-300",
  medium: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  high: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  urgent: "bg-red-500/10 text-red-600 dark:text-red-400",
};

export const STATUS_LABELS: Record<TicketStatus, string> = {
  pending: "待匹配",
  in_progress: "进行中",
  completed: "已完成",
  closed: "已关闭",
};

export const STATUS_STYLES: Record<TicketStatus, string> = {
  pending: "bg-slate-500/10 text-slate-600 dark:text-slate-300",
  in_progress: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  completed: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  closed: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400",
};

/** 判断工单是否已逾期（截止日期早于现在，且未完成/未关闭） */
export function isOverdue(ticket: Ticket): boolean {
  if (!ticket.dueDate) return false;
  if (ticket.status === "completed" || ticket.status === "closed") return false;
  return new Date(ticket.dueDate).getTime() < Date.now();
}

/** 格式化截止日期为简短中文格式 */
export function formatDueDate(dueDate: Date | string | null): string {
  if (!dueDate) return "";
  const d = new Date(dueDate);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

/* ================================================================
 * TicketCategory 上下文 —— TicketCard 通过 context 获取分组主题
 * ================================================================ */

type TicketCategoryRecord = TicketCategory & {
  sortOrder: number;
  colorKey: string;
};

interface TicketCategoryContextValue {
  categories: TicketCategoryRecord[];
  themeFor: (categoryId: string | null) => AgentGroupStyle;
  labelFor: (categoryId: string | null) => string;
}

const TicketCategoryCtx = createContext<TicketCategoryContextValue>({
  categories: [],
  themeFor: () => DEFAULT_THEME,
  labelFor: () => "未分类",
});

export function useTicketCategoryContext() {
  return useContext(TicketCategoryCtx);
}

/* ================================================================
 * useTickets — 共享数据获取 + 分组逻辑
 * ================================================================ */

const TICKETS_KEY = `${
  process.env.NEXT_PUBLIC_BASE_PATH ?? ""
}/api/tickets`;
const TICKET_CATEGORIES_KEY = `${
  process.env.NEXT_PUBLIC_BASE_PATH ?? ""
}/api/ticket-categories`;

export function useTickets() {
  const {
    data: tickets = [],
    isLoading: loading,
    mutate,
  } = useSWR<Ticket[]>(TICKETS_KEY, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  });

  const {
    data: categories = [],
    mutate: mutateCategories,
  } = useSWR<TicketCategoryRecord[]>(TICKET_CATEGORIES_KEY, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  });

  /** categoryId → category record */
  const categoryMap = useMemo(() => {
    const map = new Map<string, TicketCategoryRecord>();
    for (const c of categories) map.set(c.id, c);
    return map;
  }, [categories]);

  const ctxValue = useMemo<TicketCategoryContextValue>(
    () => ({
      categories,
      themeFor: (catId) => {
        if (!catId) return DEFAULT_THEME;
        const cat = categoryMap.get(catId);
        if (!cat) return DEFAULT_THEME;
        return buildGroupFromCategory(cat);
      },
      labelFor: (catId) => {
        if (!catId) return "未分类";
        return categoryMap.get(catId)?.name ?? "未分类";
      },
    }),
    [categories, categoryMap]
  );

  /** Force re-fetch (used after CRUD operations) */
  const refresh = useCallback(() => {
    mutate();
    mutateCategories();
  }, [mutate, mutateCategories]);

  /** 用户视图：仅活跃工单，按分类归类 */
  const userGroups = useMemo(() => {
    const active = tickets.filter((t) => t.isActive);
    const inactive = tickets.filter((t) => !t.isActive);

    const map = new Map<string, Ticket[]>();
    for (const t of active) {
      const key = t.categoryId ?? "__ungrouped__";
      const bucket = map.get(key) ?? [];
      bucket.push(t);
      map.set(key, bucket);
    }

    const groups = categories
      .map((c) => ({
        group: buildGroupFromCategory(c),
        tickets: (map.get(c.id) ?? []).sort(
          (a, b) => a.sortOrder - b.sortOrder
        ),
      }))
      .filter((g) => g.tickets.length > 0);

    const ungroupedActive = map.get("__ungrouped__") ?? [];
    if (ungroupedActive.length > 0) {
      groups.push({
        group: {
          ...DEFAULT_THEME,
          key: "__ungrouped__",
          label: "未分类",
          order: 999,
        },
        tickets: ungroupedActive,
      });
    }

    return { groups, inactive };
  }, [tickets, categories]);

  /** 管理视图：所有工单（含停用），按分类归类 + 未分类 */
  const adminGroups = useMemo(() => {
    const map = new Map<string, Ticket[]>();
    const ungrouped: Ticket[] = [];

    for (const t of tickets) {
      if (t.categoryId) {
        const bucket = map.get(t.categoryId) ?? [];
        bucket.push(t);
        map.set(t.categoryId, bucket);
      } else {
        ungrouped.push(t);
      }
    }

    const groups = categories
      .map((c) => ({
        group: buildGroupFromCategory(c),
        tickets: (map.get(c.id) ?? []).sort(
          (a, b) => a.sortOrder - b.sortOrder
        ),
      }))
      .filter((g) => g.tickets.length > 0);

    return { groups, ungrouped };
  }, [tickets, categories]);

  const activeCount = tickets.filter((t) => t.isActive).length;

  /** 统计看板数据 —— 工单系统优化项 */
  const stats = useMemo(() => {
    const active = tickets.filter((t) => t.isActive);
    return {
      total: active.length,
      pending: active.filter((t) => t.status === "pending").length,
      inProgress: active.filter((t) => t.status === "in_progress").length,
      completed: active.filter((t) => t.status === "completed").length,
      closed: active.filter((t) => t.status === "closed").length,
      overdue: active.filter(isOverdue).length,
      urgent: active.filter((t) => t.priority === "urgent").length,
    };
  }, [tickets]);

  /** 按标题/描述搜索活跃工单 */
  const searchTickets = useCallback(
    (query: string): Ticket[] => {
      if (!query.trim()) return [];
      const q = query.trim().toLowerCase();
      return tickets
        .filter((t) => t.isActive)
        .filter(
          (t) =>
            t.title.toLowerCase().includes(q) ||
            t.description?.toLowerCase().includes(q) ||
            t.assignee?.toLowerCase().includes(q)
        );
    },
    [tickets]
  );

  return {
    tickets,
    categories,
    loading,
    refresh,
    userGroups,
    adminGroups,
    activeCount,
    stats,
    searchTickets,
    ctxValue,
    setCategories: mutateCategories,
  };
}

/* ================================================================
 * TicketCategoryProvider — 包裹子组件以提供分类 context
 * ================================================================ */

export function TicketCategoryProvider({
  value,
  children,
}: {
  value: TicketCategoryContextValue;
  children: React.ReactNode;
}) {
  return (
    <TicketCategoryCtx.Provider value={value}>
      {children}
    </TicketCategoryCtx.Provider>
  );
}

/* ================================================================
 * GroupHeader — 分类标题（色条 + 名称 + 数量）
 * ================================================================ */

export function TicketGroupHeader({
  group,
  count,
}: {
  group: { bg: string; label: string };
  count: number;
}) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <div aria-hidden className={`h-1 w-6 rounded-full ${group.bg}`} />
      <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        {group.label}
      </h2>
      <span className="text-[10px] text-muted-foreground/50">{count} 个</span>
    </div>
  );
}

/* ================================================================
 * TicketCard — 工单卡片
 *
 * 默认模式：渐变背景、显示优先级/状态/负责人/截止日期/进度
 * admin 模式：同上 + badge + sortOrder + 编辑/删除操作
 * ================================================================ */

export function TicketCard({
  ticket,
  admin = false,
  onEdit,
  onDelete,
}: {
  ticket: Ticket;
  admin?: boolean;
  onEdit?: (ticket: Ticket) => void;
  onDelete?: (ticket: Ticket) => void;
}) {
  const { themeFor, labelFor } = useTicketCategoryContext();
  const group = themeFor(ticket.categoryId);
  const groupLabel = labelFor(ticket.categoryId);
  const avatarChar = getAvatarChar(ticket.title);
  const overdue = isOverdue(ticket);

  return (
    <div
      className={cn(
        "fade-up group relative overflow-hidden bg-gradient-to-br to-transparent p-5 transition-all duration-300 hover:-translate-y-1",
        cardVariants({
          variant: "elevated",
          padding: "none",
          className: `${group.gradientFrom} ${group.borderHover} ${group.hoverShadow}`,
        })
      )}
    >
      {/* 顶部色条 */}
      <div className={`absolute inset-x-0 top-0 h-1 ${group.bg}`} />

      {/* 头像 + 标题 */}
      <div className="mb-3 mt-1.5 flex items-start justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className={`flex size-11 shrink-0 items-center justify-center rounded-xl text-base font-bold shadow-sm ${group.bg} ${group.text}`}
          >
            {avatarChar}
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold leading-tight">
              {ticket.title}
            </h3>
            <div className="mt-0.5 flex items-center gap-2 text-[10px]">
              {admin && (
                <span className="text-muted-foreground">
                  #{ticket.sortOrder}
                </span>
              )}
              <span className={`font-medium ${group.softText}`}>
                {groupLabel}
              </span>
            </div>
          </div>
        </div>

        {/* 管理视图：启用/停用 badge */}
        {admin && (
          <span
            className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
              ticket.isActive
                ? "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {ticket.isActive ? (
              <Power className="size-2.5" />
            ) : (
              <PowerOff className="size-2.5" />
            )}
            {ticket.isActive ? "启用" : "停用"}
          </span>
        )}
      </div>

      {/* 描述 */}
      <p className="mb-3 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
        {ticket.description}
      </p>

      {/* 优先级 + 状态 badge 行 */}
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${PRIORITY_STYLES[ticket.priority]}`}
        >
          {ticket.priority === "urgent" && (
            <AlertCircle className="size-2.5" />
          )}
          {PRIORITY_LABELS[ticket.priority]}
        </span>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_STYLES[ticket.status]}`}
        >
          {ticket.status === "completed" && (
            <CheckCircle2 className="size-2.5" />
          )}
          {ticket.status === "in_progress" && (
            <Loader2 className="size-2.5" />
          )}
          {STATUS_LABELS[ticket.status]}
        </span>
        {ticket.visibility === "private" && (
          <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            私有
          </span>
        )}
      </div>

      {/* 进度条 —— 工单系统优化项 */}
      {ticket.progress > 0 && (
        <div className="mb-3">
          <div className="mb-1 flex items-center justify-between text-[10px] text-muted-foreground">
            <span>进度</span>
            <span>{ticket.progress}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full transition-all ${group.bg}`}
              style={{ width: `${ticket.progress}%` }}
            />
          </div>
        </div>
      )}

      {/* 负责人 + 截止日期 */}
      <div className="mb-3 flex items-center gap-3 text-[10px] text-muted-foreground">
        {ticket.assignee && (
          <span className="inline-flex items-center gap-1">
            <UserIcon className="size-3" />
            {ticket.assignee}
          </span>
        )}
        {ticket.dueDate && (
          <span
            className={`inline-flex items-center gap-1 ${
              overdue
                ? "font-medium text-red-600 dark:text-red-400"
                : ""
            }`}
          >
            <CalendarClock className="size-3" />
            {formatDueDate(ticket.dueDate)}
            {overdue && "· 逾期"}
          </span>
        )}
      </div>

      {/* hover 行动栏 — 移动端始终可见，桌面端 hover 显示 */}
      <div className="flex items-center justify-between opacity-100 transition-opacity duration-200 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
        {admin ? (
          <div className="flex items-center gap-1">
            <button
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${group.soft} ${group.softText} hover:bg-foreground/10`}
              onClick={(e) => {
                e.stopPropagation();
                onEdit?.(ticket);
              }}
              type="button"
            >
              <Edit className="size-3" />
              编辑
            </button>
            <button
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium text-destructive/70 transition-colors hover:bg-destructive/10 hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                onDelete?.(ticket);
              }}
              type="button"
            >
              <Trash2 className="size-3" />
              删除
            </button>
          </div>
        ) : (
          <span className="text-[10px] text-muted-foreground">
            创建于 {new Date(ticket.createdAt).toLocaleDateString("zh-CN")}
          </span>
        )}
      </div>
    </div>
  );
}
