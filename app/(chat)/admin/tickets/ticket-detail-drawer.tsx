"use client";

import {
  Activity,
  CalendarClock,
  CheckCircle2,
  Clock,
  Edit,
  Loader2,
  MessageSquare,
  Send,
  Tag as TagIcon,
  Trash2,
  User as UserIcon,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import type { Ticket, TicketCategory } from "@/lib/db/schema";
import { cn, fetcher } from "@/lib/utils";
import {
  PRIORITY_LABELS,
  PRIORITY_STYLES,
  STATUS_LABELS,
  STATUS_STYLES,
  type TicketPriority,
  type TicketStatus,
} from "./ticket-shared";

// --- 类型定义 ---
type Comment = {
  id: string;
  ticketId: string;
  userId: string;
  content: string;
  createdAt: string;
  user?: { name?: string | null; image?: string | null }; // 优化：期望后端返回用户信息
};

type ActivityLog = {
  id: string;
  ticketId: string;
  userId: string;
  type: string;
  summary: string;
  oldValue: string | null;
  newValue: string | null;
  createdAt: string;
};

type Tag = {
  id: string;
  name: string;
  color: string;
};

type TabKey = "detail" | "comments" | "activity" | "tags";

// --- 工具函数 ---
/** 安全的日期格式化函数，防止 Invalid Date 报错 */
const formatDate = (dateStr: string | Date | null | undefined) => {
  if (!dateStr) return "无";
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? "日期格式错误" : d.toLocaleString("zh-CN");
};

// --- 主组件 ---
export function TicketDetailDrawer({
  ticket,
  categories,
  open,
  onOpenChange,
  onEdit,
  onDelete,
  onRefresh,
}: {
  ticket: Ticket | null;
  categories: TicketCategory[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: (ticket: Ticket) => void;
  onDelete?: (ticket: Ticket) => void;
  onRefresh?: () => void;
}) {
  const [tab, setTab] = useState<TabKey>("detail");
  const [comments, setComments] = useState<Comment[]>([]);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [ticketTagIds, setTicketTagIds] = useState<string[]>([]);
  const [newComment, setNewComment] = useState("");
  const [posting, setPosting] = useState(false);
  const [loadingComments, setLoadingComments] = useState(false);
  const [loadingActivities, setLoadingActivities] = useState(false);

  const loadComments = useCallback(async (id: string) => {
    setLoadingComments(true);
    try {
      const data = (await fetcher(`/api/tickets/${id}/comments`)) as Comment[];
      setComments(data);
    } catch {
      setComments([]);
    } finally {
      setLoadingComments(false);
    }
  }, []);

  const loadActivities = useCallback(async (id: string) => {
    setLoadingActivities(true);
    try {
      const data = (await fetcher(`/api/tickets/${id}/activities`)) as ActivityLog[];
      setActivities(data);
    } catch {
      setActivities([]);
    } finally {
      setLoadingActivities(false);
    }
  }, []);

  const loadTags = useCallback(async () => {
    try {
      const data = (await fetcher(`/api/ticket-tags`)) as Tag[];
      setAllTags(data);
    } catch {
      setAllTags([]);
    }
  }, []);

  const loadTicketTags = useCallback(async (id: string) => {
    try {
      const data = (await fetcher(`/api/tickets/${id}/tags`)) as string[];
      setTicketTagIds(data);
    } catch {
      setTicketTagIds([]);
    }
  }, []);

  useEffect(() => {
    if (ticket && open) {
      setTab("detail");
      loadComments(ticket.id);
      loadActivities(ticket.id);
      loadTags();
      loadTicketTags(ticket.id);
    }
  }, [ticket, open, loadComments, loadActivities, loadTags, loadTicketTags]);

  // 优化：防止重复提交评论
  const handlePostComment = async () => {
    if (posting || !ticket || !newComment.trim()) return;
    setPosting(true);
    try {
      const res = await fetch(`/api/tickets/${ticket.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newComment.trim() }),
      });
      if (!res.ok) throw new Error();
      const created = (await res.json()) as Comment;
      setComments((prev) => [...prev, created]);
      setNewComment("");
      loadActivities(ticket.id);
      onRefresh?.();
      toast.success("评论已发布");
    } catch {
      toast.error("评论发布失败");
    } finally {
      setPosting(false);
    }
  };

  // 优化：标签的乐观更新与失败回滚
  const handleToggleTag = async (tagId: string) => {
    if (!ticket) return;
    const prevIds = ticketTagIds;
    const next = prevIds.includes(tagId)
      ? prevIds.filter((t) => t !== tagId)
      : [...prevIds, tagId];
    
    setTicketTagIds(next); // 乐观更新 UI

    try {
      await fetch(`/api/tickets/${ticket.id}/tags`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tagIds: next }),
      });
    } catch {
      toast.error("标签更新失败");
      setTicketTagIds(prevIds); // 失败时回滚
    }
  };

  if (!ticket) return null;

  const category = categories.find((c) => c.id === ticket.categoryId);
  const overdue =
    ticket.dueDate &&
    new Date(ticket.dueDate) < new Date() &&
    ticket.status !== "completed" &&
    ticket.status !== "closed";

  const tabs: { key: TabKey; label: string; icon: React.ReactNode; count?: number }[] = [
    { key: "detail", label: "详情", icon: <CheckCircle2 className="size-3.5" /> },
    { key: "comments", label: "评论", icon: <MessageSquare className="size-3.5" />, count: comments.length },
    { key: "activity", label: "活动", icon: <Activity className="size-3.5" />, count: activities.length },
    { key: "tags", label: "标签", icon: <TagIcon className="size-3.5" /> },
  ];

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent aria-describedby={undefined} className="w-full gap-0 p-0 sm:max-w-2xl" showCloseButton={false}>
        {/* Header */}
        <SheetHeader className="border-b border-border/60 p-5">
          <div className="flex items-start justify-between gap-3 pr-8">
            <div className="min-w-0 flex-1">
              <SheetTitle className="text-lg leading-snug">{ticket.title}</SheetTitle>
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{ticket.description}</p>
            </div>
          </div>
          {/* 状态/优先级徽章行 */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge className={cn("border-0 text-[11px]", STATUS_STYLES[ticket.status as TicketStatus])} variant="secondary">
              {STATUS_LABELS[ticket.status as TicketStatus]}
            </Badge>
            <Badge className={cn("border-0 text-[11px]", PRIORITY_STYLES[ticket.priority as TicketPriority])} variant="secondary">
              {PRIORITY_LABELS[ticket.priority as TicketPriority]}优先级
            </Badge>
            {category && (
              <Badge className="border-0 text-[11px]" style={{ backgroundColor: `${category.color}15`, color: category.color }} variant="secondary">
                {category.name}
              </Badge>
            )}
            {overdue && (
              <Badge className="border-0 bg-red-500/10 text-[11px] text-red-600" variant="secondary">逾期</Badge>
            )}
          </div>
        </SheetHeader>

        {/* Tabs */}
        <div className="flex items-center gap-1 border-b border-border/60 px-3 py-2">
          {tabs.map((t) => (
            <button
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                tab === t.key ? "bg-foreground/5 text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
              key={t.key}
              onClick={() => setTab(t.key)}
              type="button"
              role="tab" // 优化：无障碍属性
              aria-selected={tab === t.key}
            >
              {t.icon}
              {t.label}
              {t.count !== undefined && t.count > 0 && (
                <span className="ml-0.5 rounded-full bg-foreground/10 px-1.5 text-[10px]">{t.count}</span>
              )}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-1">
            {onEdit && (
              <Button onClick={() => { onEdit(ticket); onOpenChange(false); }} size="sm" variant="ghost">
                <Edit className="size-3.5" /> 编辑
              </Button>
            )}
            {onDelete && (
              <Button onClick={() => { onDelete(ticket); onOpenChange(false); }} size="sm" variant="ghost">
                <Trash2 className="size-3.5 text-destructive" />
              </Button>
            )}
            <Button onClick={() => onOpenChange(false)} size="icon-sm" variant="ghost">
              <X className="size-4" />
            </Button>
          </div>
        </div>

        {/* Tab Content - 优化：抽离为子组件 */}
        <ScrollArea className="flex-1">
          {tab === "detail" && <DetailTabContent ticket={ticket} overdue={!!overdue} />}
          {tab === "comments" && (
            <CommentsTabContent
              comments={comments}
              loadingComments={loadingComments}
              posting={posting}
              newComment={newComment}
              setNewComment={setNewComment}
              handlePostComment={handlePostComment}
            />
          )}
          {tab === "activity" && <ActivityTabContent activities={activities} loadingActivities={loadingActivities} />}
          {tab === "tags" && <TagsTabContent allTags={allTags} ticketTagIds={ticketTagIds} handleToggleTag={handleToggleTag} />}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

// --- 子组件：详情 Tab ---
function DetailTabContent({ ticket, overdue }: { ticket: Ticket; overdue: boolean }) {
  return (
    <div className="space-y-4 p-5">
      <DetailField label="描述" value={ticket.description} />
      {ticket.content && <DetailField label="详情" value={ticket.content} multiline />}
      <div className="grid grid-cols-2 gap-3">
        <DetailMeta icon={<UserIcon className="size-3.5" />} label="负责人" value={ticket.assignee || "未指派"} />
        <DetailMeta icon={<CalendarClock className="size-3.5" />} label="截止日期" value={formatDate(ticket.dueDate)} highlight={overdue} />
        <DetailMeta icon={<Clock className="size-3.5" />} label="创建时间" value={formatDate(ticket.createdAt)} />
        <DetailMeta icon={<Activity className="size-3.5" />} label="更新时间" value={formatDate(ticket.updatedAt)} />
      </div>
      {/* 进度条 */}
      <div>
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <span className="text-muted-foreground">进度</span>
          <span className="font-medium">{ticket.progress}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${ticket.progress}%` }} />
        </div>
      </div>
    </div>
  );
}

// --- 子组件：评论 Tab ---
function CommentsTabContent({
  comments,
  loadingComments,
  posting,
  newComment,
  setNewComment,
  handlePostComment,
}: {
  comments: Comment[];
  loadingComments: boolean;
  posting: boolean;
  newComment: string;
  setNewComment: (v: string) => void;
  handlePostComment: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-3 p-5">
        {loadingComments ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
          </div>
        ) : comments.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground">暂无评论，发表第一条评论吧</div>
        ) : (
          comments.map((c) => (
            <div className="rounded-lg border border-border/50 bg-muted/30 p-3" key={c.id}>
              <div className="mb-1 flex items-center justify-between">
                {/* 优化：优先显示用户昵称，如果没有则截取 userId */}
                <span className="text-xs font-medium">
                  {c.user?.name || `用户 ${c.userId.slice(0, 6)}`}
                </span>
                <span className="text-[10px] text-muted-foreground">{formatDate(c.createdAt)}</span>
              </div>
              <p className="whitespace-pre-wrap text-xs leading-relaxed">{c.content}</p>
            </div>
          ))
        )}
      </div>
      <div className="border-t border-border/60 p-4">
        <div className="flex gap-2">
          <Textarea
            className="min-h-[60px] resize-none text-xs"
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                handlePostComment();
              }
            }}
            placeholder="输入评论... (Cmd/Ctrl+Enter 发送)"
            value={newComment}
          />
          <Button className="shrink-0" disabled={posting || !newComment.trim()} onClick={handlePostComment} size="icon">
            {posting ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}

// --- 子组件：活动 Tab ---
function ActivityTabContent({ activities, loadingActivities }: { activities: ActivityLog[]; loadingActivities: boolean }) {
  return (
    <div className="p-5">
      {loadingActivities ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
        </div>
      ) : activities.length === 0 ? (
        <div className="py-8 text-center text-xs text-muted-foreground">暂无活动记录</div>
      ) : (
        <div className="relative space-y-4 pl-4">
          <div className="absolute top-1 bottom-1 left-[5px] w-px bg-border" />
          {activities.map((a) => (
            <div className="relative" key={a.id}>
              <div className="absolute -left-[14px] top-1 size-2.5 rounded-full border-2 border-background bg-primary" />
              <div className="text-xs font-medium">{a.summary}</div>
              <div className="mt-0.5 text-[10px] text-muted-foreground">{formatDate(a.createdAt)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// --- 子组件：标签 Tab ---
function TagsTabContent({
  allTags,
  ticketTagIds,
  handleToggleTag,
}: {
  allTags: Tag[];
  ticketTagIds: string[];
  handleToggleTag: (id: string) => void;
}) {
  return (
    <div className="space-y-4 p-5">
      <div className="text-xs text-muted-foreground">为工单添加标签，支持多维度标记</div>
      <div className="flex flex-wrap gap-2">
        {allTags.length === 0 ? (
          <span className="text-xs text-muted-foreground">暂无标签，请先在管理端创建标签</span>
        ) : (
          allTags.map((tag) => {
            const selected = ticketTagIds.includes(tag.id);
            return (
              <button
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs transition-all",
                  selected ? "border-transparent text-white" : "border-border text-muted-foreground hover:border-foreground/30"
                )}
                key={tag.id}
                onClick={() => handleToggleTag(tag.id)}
                style={selected ? { backgroundColor: tag.color } : undefined}
                type="button"
              >
                {selected && <CheckCircle2 className="size-3" />}
                {tag.name}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

// --- 通用展示组件 ---
function DetailField({ label, value, multiline }: { label: string; value: string; multiline?: boolean }) {
  return (
    <div>
      <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn("text-sm text-foreground", multiline && "whitespace-pre-wrap leading-relaxed")}>{value}</div>
    </div>
  );
}

function DetailMeta({ icon, label, value, highlight }: { icon: React.ReactNode; label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-lg border border-border/50 bg-muted/20 p-2.5">
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
        {icon} {label}
      </div>
      <div className={cn("mt-1 truncate text-xs font-medium", highlight && "text-red-600")}>{value}</div>
    </div>
  );
}
