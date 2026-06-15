"use client";

import {
  Edit,
  MessageCircle,
  Phone,
  Power,
  PowerOff,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { getAgentGroup, getAllGroups, getAvatarChar } from "@/lib/agent-groups";
import type { Agent } from "@/lib/db/schema";

/* ================================================================
 * useAgents — 共享数据获取 + 分组逻辑
 * ================================================================ */

export function useAgents() {
  const router = useRouter();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAgents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/agents");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setAgents(data);
    } catch {
      toast.error("获取 OPC 列表失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  /** 用户视图：仅活跃 agent，按分组归类 */
  const userGroups = useMemo(() => {
    const active = agents.filter((a) => a.isActive);
    const inactive = agents.filter((a) => !a.isActive);

    const map = new Map<string, Agent[]>();
    for (const g of getAllGroups()) map.set(g.key, []);
    for (const a of active) {
      const group = getAgentGroup(a.sortOrder);
      const bucket = map.get(group.key) ?? [];
      bucket.push(a);
      map.set(group.key, bucket);
    }

    const groups = getAllGroups()
      .filter((g) => (map.get(g.key)?.length ?? 0) > 0)
      .map((g) => ({ group: g, agents: map.get(g.key)! }));

    return { groups, inactive };
  }, [agents]);

  /** 管理视图：所有 agent（含停用），按分组归类 + 未分组 */
  const adminGroups = useMemo(() => {
    const map = new Map<string, Agent[]>();
    for (const g of getAllGroups()) map.set(g.key, []);
    const ungrouped: Agent[] = [];

    for (const a of agents) {
      const group = getAgentGroup(a.sortOrder);
      if (group.key === "default") {
        ungrouped.push(a);
      } else {
        const bucket = map.get(group.key) ?? [];
        bucket.push(a);
        map.set(group.key, bucket);
      }
    }

    const groups = getAllGroups()
      .filter((g) => (map.get(g.key)?.length ?? 0) > 0)
      .map((g) => ({ group: g, agents: map.get(g.key)! }));

    return { groups, ungrouped };
  }, [agents]);

  const activeCount = agents.filter((a) => a.isActive).length;

  /** 按名称/描述搜索活跃 agent */
  const searchAgents = useCallback(
    (query: string): Agent[] => {
      if (!query.trim()) return [];
      const q = query.trim().toLowerCase();
      return agents
        .filter((a) => a.isActive)
        .filter(
          (a) =>
            a.name.toLowerCase().includes(q) ||
            a.description?.toLowerCase().includes(q)
        );
    },
    [agents]
  );

  const handleStartChat = useCallback(
    async (agent: Agent) => {
      try {
        const res = await fetch("/api/chat/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ agentId: agent.id }),
        });
        if (!res.ok) {
          throw new Error("Failed to create chat");
        }
        const { chatId } = await res.json();
        // Store agentId temporarily for page initialization
        sessionStorage.setItem(`pending-chat-${chatId}`, agent.id);
        router.push(`/chat/${chatId}`);
      } catch {
        toast.error("创建对话失败，请重试");
      }
    },
    [router]
  );

  return {
    agents,
    loading,
    refresh: fetchAgents,
    userGroups,
    adminGroups,
    activeCount,
    searchAgents,
    handleStartChat,
  };
}

/* ================================================================
 * GroupHeader — 分组标题（色条 + 名称 + 数量）
 * ================================================================ */

export function GroupHeader({
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
 * AgentCard — OPC 卡片
 *
 * 默认模式：渐变背景、整体可点击、hover 显示「聊天」操作
 * admin 模式：渐变背景、badge + sortOrder、hover 显示「聊天/编辑/删除」
 * ================================================================ */

export function AgentCard({
  agent,
  admin = false,
  onChat,
  onEdit,
  onDelete,
}: {
  agent: Agent;
  admin?: boolean;
  onChat?: (agent: Agent) => void;
  onEdit?: (agent: Agent) => void;
  onDelete?: (agent: Agent) => void;
}) {
  const group = getAgentGroup(agent.sortOrder);
  const avatarChar = getAvatarChar(agent.name);

  return (
    <div
      className={`fade-up group relative overflow-hidden rounded-2xl border border-border/50 bg-gradient-to-br ${group.gradientFrom} to-transparent p-5 shadow-[var(--shadow-card)] transition-all duration-300 hover:-translate-y-1 hover:${group.borderHover} ${group.hoverShadow} ${
        !admin && onChat ? "cursor-pointer" : ""
      }`}
      onClick={!admin && onChat ? () => onChat(agent) : undefined}
      onKeyDown={
        !admin && onChat
          ? (e) => {
              if (e.key === "Enter") onChat(agent);
            }
          : undefined
      }
      role={!admin && onChat ? "button" : undefined}
      tabIndex={!admin && onChat ? 0 : undefined}
    >
      {/* 顶部色条 */}
      <div className={`absolute inset-x-0 top-0 h-1 ${group.bg}`} />

      {/* 头像 + 名称 */}
      <div className="mb-3 mt-1.5 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`flex size-11 shrink-0 items-center justify-center rounded-xl text-base font-bold shadow-sm ${group.bg} ${group.text}`}
          >
            {avatarChar}
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold leading-tight">
              {agent.name}
            </h3>
            <div className="mt-0.5 flex items-center gap-2 text-[10px]">
              {admin && (
                <>
                  <span className="text-muted-foreground">
                    #{agent.sortOrder}
                  </span>
                  {agent.isDefault && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-600 dark:bg-amber-500/15 dark:text-amber-400">
                      ★ 默认
                    </span>
                  )}
                </>
              )}
              <span className={`font-medium ${group.softText}`}>
                {group.label}
              </span>
            </div>
          </div>
        </div>

        {/* 管理视图：启用/停用 badge */}
        {admin && (
          <span
            className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
              agent.isActive
                ? "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {agent.isActive ? (
              <Power className="size-2.5" />
            ) : (
              <PowerOff className="size-2.5" />
            )}
            {agent.isActive ? "启用" : "停用"}
          </span>
        )}
      </div>

      {/* 描述 */}
      <p className="mb-4 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
        {agent.description}
      </p>

      {/* hover 行动栏 */}
      <div className="flex items-center justify-between opacity-0 transition-opacity duration-200 group-hover:opacity-100">
        {admin ? (
          /* 管理操作 */
          <>
            <button
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${group.soft} ${group.softText} hover:bg-foreground/10`}
              disabled={!agent.isActive}
              onClick={(e) => {
                e.stopPropagation();
                onChat?.(agent);
              }}
              type="button"
            >
              <MessageCircle className="size-3" />
              聊天
            </button>
            {agent.phone && (
              <a
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${group.soft} ${group.softText} hover:bg-foreground/10`}
                href={`tel:${agent.phone}`}
                onClick={(e) => e.stopPropagation()}
                type="button"
              >
                <Phone className="size-3" />
                电话
              </a>
            )}
            <div className="flex items-center gap-1">
              <button
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${group.soft} ${group.softText} hover:bg-foreground/10`}
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit?.(agent);
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
                  onDelete?.(agent);
                }}
                type="button"
              >
                <Trash2 className="size-3" />
                删除
              </button>
            </div>
          </>
        ) : (
          /* 用户操作 */
          <>
            <span className="text-[10px] text-muted-foreground">
              点击开始对话
            </span>
            <div className="flex items-center gap-1">
              {agent.phone && (
                <a
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${group.soft} ${group.softText} hover:bg-foreground/10 active:bg-foreground/20 cursor-pointer`}
                  href={`tel:${agent.phone}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <Phone className="size-3" />
                  电话
                </a>
              )}
              <button
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${group.soft} ${group.softText} hover:bg-foreground/10 active:bg-foreground/20 cursor-pointer`}
                onClick={(e) => {
                  e.stopPropagation();
                  onChat?.(agent);
                }}
                type="button"
              >
                <MessageCircle className="size-3" />
                聊天
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
