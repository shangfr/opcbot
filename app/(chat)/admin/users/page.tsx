"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft,
  Calendar,
  MessageSquare,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  User,
  UserCheck,
  UserX,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";

interface UserStats {
  id: string;
  email: string;
  name: string | null;
  isAnonymous: boolean;
  role: "user" | "moderator" | "admin";
  createdAt: string;
  updatedAt: string;
  chatCount: number;
  messageCount: number;
  lastActivityAt: string | null;
  upvotes: number;
  downvotes: number;
}

interface UserManagementData {
  users: UserStats[];
  conversion: {
    guestUsers: number;
    registeredUsers: number;
    totalUsers: number;
  };
  feedback: {
    totalUpvotes: number;
    totalDownvotes: number;
    votedChats: number;
    votedMessages: number;
  };
}

const colorMap: Record<string, { bg: string; icon: string }> = {
  cyan: { bg: "bg-sky-500/10", icon: "text-sky-500" },
  orange: { bg: "bg-orange-500/10", icon: "text-orange-500" },
  amber: { bg: "bg-amber-500/10", icon: "text-amber-500" },
  green: { bg: "bg-emerald-500/10", icon: "text-emerald-500" },
  purple: { bg: "bg-purple-500/10", icon: "text-purple-500" },
  red: { bg: "bg-red-500/10", icon: "text-red-500" },
};

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  color,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon?: React.ComponentType<{ className?: string }>;
  color: string;
}) {
  const c = colorMap[color] ?? colorMap.cyan;
  return (
    <Card className="flex items-center gap-4" padding="md" variant="base">
      {Icon && (
        <div
          className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${c.bg}`}
        >
          <Icon className={`size-4 ${c.icon}`} />
        </div>
      )}
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <p className="text-lg font-semibold tracking-tight tabular-nums">
          {value}
        </p>
        {sub && (
          <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>
        )}
      </div>
    </Card>
  );
}

function formatTimeAgo(dateStr: string | null): string {
  if (!dateStr) return "从未活跃";
  try {
    return formatDistanceToNow(new Date(dateStr), {
      addSuffix: true,
      locale: zhCN,
    });
  } catch {
    return "未知";
  }
}

export default function UsersPage() {
  const router = useRouter();
  const [data, setData] = useState<UserManagementData | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showDeleteGuestsDialog, setShowDeleteGuestsDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editingRole, setEditingRole] = useState<string | null>(null);
  const [updatingRole, setUpdatingRole] = useState(false);

  const handleDeleteGuests = async () => {
    setDeleting(true);
    setShowDeleteGuestsDialog(false);
    try {
      const res = await fetch("/api/users/guests", { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete guest users");
      const result = await res.json();
      toast.success(`成功删除 ${result.deletedCount} 个访客用户`);
      // Refresh data
      const refreshRes = await fetch("/api/users");
      if (refreshRes.ok) {
        setData(await refreshRes.json());
      }
    } catch {
      toast.error("删除访客用户失败，请重试");
    } finally {
      setDeleting(false);
    }
  };

  const handleUpdateRole = async (userId: string, newRole: string) => {
    setUpdatingRole(true);
    try {
      const res = await fetch("/api/users/role", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role: newRole }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "更新角色失败");
      }
      toast.success("角色更新成功");
      // Refresh data
      const refreshRes = await fetch("/api/users");
      if (refreshRes.ok) {
        setData(await refreshRes.json());
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "更新角色失败");
    } finally {
      setUpdatingRole(false);
      setEditingRole(null);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetch("/api/users")
      .then((res) => (res.ok ? res.json() : null))
      .then((result) => {
        if (result) setData(result);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const { users = [], conversion, feedback } = data ?? {};

  const filteredUsers = users.filter((u) => {
    const query = searchQuery.toLowerCase();
    return (
      u.email.toLowerCase().includes(query) ||
      u.name?.toLowerCase().includes(query) ||
      u.id.toLowerCase().includes(query)
    );
  });

  const conversionRate =
    conversion && conversion.totalUsers > 0
      ? Math.round((conversion.registeredUsers / conversion.totalUsers) * 100)
      : 0;

  const totalVotes = (feedback?.totalUpvotes ?? 0) + (feedback?.totalDownvotes ?? 0);
  const satisfactionRate =
    totalVotes > 0
      ? Math.round(((feedback?.totalUpvotes ?? 0) / totalVotes) * 100)
      : null;

  return (
    <div className="px-6 py-8">
      {/* Header */}
      <div className="mb-10 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
          >
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">用户管理</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              查看用户列表、活跃度统计和访客转化数据
            </p>
          </div>
        </div>
        <Button
          variant="destructive"
          size="sm"
          onClick={() => setShowDeleteGuestsDialog(true)}
          disabled={deleting || (conversion?.guestUsers ?? 0) === 0}
        >
          <Trash2 className="mr-2 size-4" />
          {deleting ? "删除中..." : `一键清空访客 (${conversion?.guestUsers ?? 0})`}
        </Button>
      </div>

      {loading && !data ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          加载数据中...
        </div>
      ) : data ? (
        <div className="space-y-4">
          {/* 概览卡片 */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              color="cyan"
              icon={Users}
              label="总用户数"
              value={conversion?.totalUsers ?? 0}
            />
            <StatCard
              color="green"
              icon={UserCheck}
              label="注册用户"
              sub={`转化率 ${conversionRate}%`}
              value={conversion?.registeredUsers ?? 0}
            />
            <StatCard
              color="orange"
              icon={UserX}
              label="访客用户"
              value={conversion?.guestUsers ?? 0}
            />
            <StatCard
              color="amber"
              icon={ThumbsUp}
              label="用户满意度"
              sub={
                totalVotes > 0
                  ? `${feedback?.totalUpvotes} 好评 / ${feedback?.totalDownvotes} 差评`
                  : "暂无投票"
              }
              value={satisfactionRate !== null ? `${satisfactionRate}%` : "—"}
            />
          </div>

          {/* 访客转化漏斗 */}
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              访客转化漏斗
            </p>
            <Card
              className="overflow-hidden border-border/50"
              padding="md"
              variant="base"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-medium">总访客</span>
                    <span className="text-lg font-semibold tabular-nums">
                      {conversion?.totalUsers ?? 0}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-sky-500"
                      style={{ width: "100%" }}
                    />
                  </div>
                </div>
                <div className="flex-1">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-medium">注册用户</span>
                    <span className="text-lg font-semibold tabular-nums">
                      {conversion?.registeredUsers ?? 0}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-emerald-500"
                      style={{ width: `${conversionRate}%` }}
                    />
                  </div>
                </div>
                <div className="flex-1">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-medium">转化率</span>
                    <span className="text-lg font-semibold tabular-nums">
                      {conversionRate}%
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-amber-500"
                      style={{ width: `${conversionRate}%` }}
                    />
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* 用户反馈汇总 */}
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              用户反馈汇总
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard
                color="green"
                icon={ThumbsUp}
                label="总好评"
                value={feedback?.totalUpvotes ?? 0}
              />
              <StatCard
                color="red"
                icon={ThumbsDown}
                label="总差评"
                value={feedback?.totalDownvotes ?? 0}
              />
              <StatCard
                color="purple"
                icon={MessageSquare}
                label="投票对话"
                value={feedback?.votedChats ?? 0}
              />
              <StatCard
                color="cyan"
                icon={MessageSquare}
                label="投票消息"
                value={feedback?.votedMessages ?? 0}
              />
            </div>
          </div>

          {/* 用户列表 */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">
                用户列表 ({filteredUsers.length})
              </p>
              <input
                type="text"
                placeholder="搜索邮箱、姓名或ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 w-64 rounded-md border border-border/50 bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <Card
              className="overflow-hidden border-border/50"
              padding="none"
              variant="base"
            >
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/40 bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-3 py-2 text-left font-medium">用户</th>
                    <th className="px-3 py-2 text-left font-medium">类型</th>
                    <th className="px-3 py-2 text-left font-medium">角色</th>
                    <th className="px-3 py-2 text-right font-medium">对话</th>
                    <th className="px-3 py-2 text-right font-medium">消息</th>
                    <th className="px-3 py-2 text-right font-medium">
                      满意度
                    </th>
                    <th className="px-3 py-2 text-left font-medium">
                      最后活跃
                    </th>
                    <th className="px-3 py-2 text-left font-medium">
                      注册时间
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td
                        className="px-3 py-6 text-center text-xs text-muted-foreground"
                        colSpan={7}
                      >
                        {searchQuery ? "未找到匹配用户" : "暂无用户数据"}
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((user) => {
                      const votes = user.upvotes + user.downvotes;
                      const rate =
                        votes > 0
                          ? Math.round((user.upvotes / votes) * 100)
                          : null;
                      return (
                        <tr
                          className="border-b border-border/20 last:border-0"
                          key={user.id}
                        >
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted">
                                <User className="size-3.5 text-muted-foreground" />
                              </div>
                              <div className="min-w-0">
                                <div className="truncate text-sm font-medium">
                                  {user.name || user.email}
                                </div>
                                {user.name && (
                                  <div className="truncate text-[11px] text-muted-foreground">
                                    {user.email}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                user.isAnonymous
                                  ? "bg-orange-500/10 text-orange-700 dark:text-orange-300"
                                  : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                              }`}
                            >
                              {user.isAnonymous ? "访客" : "注册"}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            {editingRole === user.id ? (
                              <select
                                className="h-7 rounded border border-border/50 bg-background px-2 text-xs"
                                defaultValue={user.role}
                                disabled={updatingRole}
                                onBlur={() => setEditingRole(null)}
                                onChange={(e) => {
                                  handleUpdateRole(user.id, e.target.value);
                                }}
                                autoFocus
                              >
                                <option value="user">用户</option>
                                <option value="moderator">版主</option>
                                <option value="admin">管理员</option>
                              </select>
                            ) : (
                              <button
                                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors hover:ring-1 hover:ring-ring ${
                                  user.role === "admin"
                                    ? "bg-purple-500/10 text-purple-700 dark:text-purple-300"
                                    : user.role === "moderator"
                                      ? "bg-blue-500/10 text-blue-700 dark:text-blue-300"
                                      : "bg-gray-500/10 text-gray-700 dark:text-gray-300"
                                }`}
                                onClick={() => setEditingRole(user.id)}
                                disabled={updatingRole}
                              >
                                {user.role === "admin"
                                  ? "管理员"
                                  : user.role === "moderator"
                                    ? "版主"
                                    : "用户"}
                              </button>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {user.chatCount}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {user.messageCount}
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
                          <td className="px-3 py-2 text-[11px] text-muted-foreground">
                            {formatTimeAgo(user.lastActivityAt)}
                          </td>
                          <td className="px-3 py-2 text-[11px] text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Calendar className="size-3" />
                              {formatTimeAgo(user.createdAt)}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </Card>
          </div>
        </div>
      ) : (
        <div className="py-12 text-center text-sm text-muted-foreground">
          暂无数据
        </div>
      )}

      {/* 确认删除弹窗 */}
      <AlertDialog
        onOpenChange={setShowDeleteGuestsDialog}
        open={showDeleteGuestsDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认清空所有访客用户？</AlertDialogTitle>
            <AlertDialogDescription>
              此操作将删除所有访客用户（{conversion?.guestUsers ?? 0} 个），包括他们的所有对话、消息和相关数据。
              <br />
              <br />
              <strong>此操作无法撤销！</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteGuests}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "删除中..." : "确认清空"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
