"use client";

import {
  BarChart3,
  MessageSquare,
  ThumbsDown,
  ThumbsUp,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface DashboardStats {
  overview: {
    totalChats: number;
    totalUsers: number;
    totalAgents: number;
    activeAgents: number;
    totalMessages: number;
    totalUpvotes: number;
    totalDownvotes: number;
  };
  periods: {
    todayChats: number;
    weekChats: number;
    monthChats: number;
    todayUsers: number;
    weekUsers: number;
    monthUsers: number;
  };
  agentStats: Array<{
    agentName: string;
    chatCount: number;
    messageCount: number;
    upvotes: number;
    downvotes: number;
  }>;
}

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-xl border border-border/50 bg-card p-4">
      <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
        {Icon && <Icon className="size-3.5" />}
        {label}
      </div>
      <div className="text-2xl font-bold tracking-tight">{value}</div>
      {sub && <div className="mt-0.5 text-[10px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

function PeriodCard({
  label,
  chats,
  users,
}: {
  label: string;
  chats: number;
  users: number;
}) {
  return (
    <div className="rounded-lg border border-border/40 bg-muted/30 px-3 py-2.5">
      <div className="mb-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
        {label}
      </div>
      <div className="flex items-baseline gap-3">
        <span className="text-lg font-semibold">{chats}</span>
        <span className="text-[10px] text-muted-foreground">
          对话
        </span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-sm font-medium">{users}</span>
        <span className="text-[10px] text-muted-foreground">用户</span>
      </div>
    </div>
  );
}

export function StatsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch("/api/stats")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setStats(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open]);

  const { overview, periods, agentStats } = stats ?? {};
  const totalVotes = (overview?.totalUpvotes ?? 0) + (overview?.totalDownvotes ?? 0);
  const satisfactionRate =
    totalVotes > 0
      ? Math.round(((overview?.totalUpvotes ?? 0) / totalVotes) * 100)
      : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="size-4" />
            数据看板
          </DialogTitle>
          <DialogDescription>
            查看平台使用情况和各 OPC 的表现数据
          </DialogDescription>
        </DialogHeader>

        {loading && !stats ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            加载数据中...
          </div>
        ) : !overview ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            暂无数据
          </div>
        ) : (
          <div className="space-y-5 py-2">
            {/* 概览卡片 */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard
                label="总对话数"
                value={overview.totalChats}
                sub={`${overview.totalMessages} 条消息`}
                icon={MessageSquare}
              />
              <StatCard
                label="注册用户"
                value={overview.totalUsers}
                icon={Users}
              />
              <StatCard
                label="活跃 OPC"
                value={overview.activeAgents}
                sub={`共 ${overview.totalAgents} 个`}
              />
              <StatCard
                label="用户满意度"
                value={satisfactionRate !== null ? `${satisfactionRate}%` : "—"}
                sub={
                  totalVotes > 0
                    ? `${overview.totalUpvotes} 好评 / ${overview.totalDownvotes} 差评`
                    : "暂无投票"
                }
                icon={satisfactionRate !== null && satisfactionRate >= 50 ? ThumbsUp : ThumbsDown}
              />
            </div>

            {/* 时段对比 */}
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                时段对比
              </p>
              <div className="grid grid-cols-3 gap-2">
                <PeriodCard
                  label="今日"
                  chats={periods.todayChats}
                  users={periods.todayUsers}
                />
                <PeriodCard
                  label="近 7 天"
                  chats={periods.weekChats}
                  users={periods.weekUsers}
                />
                <PeriodCard
                  label="近 30 天"
                  chats={periods.monthChats}
                  users={periods.monthUsers}
                />
              </div>
            </div>

            {/* OPC 使用排行 */}
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                OPC 使用排行
              </p>
              <div className="rounded-xl border border-border/50 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/40 bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                      <th className="px-3 py-2 text-left font-medium">
                        OPC 名称
                      </th>
                      <th className="px-3 py-2 text-right font-medium">
                        对话
                      </th>
                      <th className="px-3 py-2 text-right font-medium">
                        消息
                      </th>
                      <th className="px-3 py-2 text-right font-medium">
                        满意度
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {agentStats.length === 0 ? (
                      <tr>
                        <td
                          colSpan={4}
                          className="px-3 py-6 text-center text-xs text-muted-foreground"
                        >
                          暂无数据
                        </td>
                      </tr>
                    ) : (
                      agentStats.map((row) => {
                        const votes = row.upvotes + row.downvotes;
                        const rate =
                          votes > 0
                            ? Math.round((row.upvotes / votes) * 100)
                            : null;
                        const hasData = row.chatCount > 0;
                        return (
                          <tr
                            key={row.agentName}
                            className={`border-b border-border/20 last:border-0 ${
                              !hasData ? "opacity-40" : ""
                            }`}
                          >
                            <td className="px-3 py-2 font-medium">
                              {row.agentName}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {row.chatCount}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {row.messageCount}
                            </td>
                            <td className="px-3 py-2 text-right">
                              {rate !== null ? (
                                <div className="flex items-center justify-end gap-1.5">
                                  <div className="h-1.5 w-12 overflow-hidden rounded-full bg-muted">
                                    <div
                                      className={`h-full rounded-full ${
                                        rate >= 60
                                          ? "bg-emerald-500"
                                          : rate >= 40
                                            ? "bg-amber-500"
                                            : "bg-red-500"
                                      }`}
                                      style={{ width: `${rate}%` }}
                                    />
                                  </div>
                                  <span className="text-[11px] tabular-nums">
                                    {rate}%
                                  </span>
                                </div>
                              ) : (
                                <span className="text-[11px] text-muted-foreground">
                                  —
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
