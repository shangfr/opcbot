"use client";

import { Bot, MessageSquare, TrendingUp, Users, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { getAgentGroup, getAllGroups, getAvatarChar } from "@/lib/agent-groups";
import type { Agent } from "@/lib/db/schema";

interface WelcomeDashboardProps {
  /** 可选：父组件额外操作（仅在 ChatShell 嵌入时使用） */
  onNewChat?: () => void;
}

function StatCard({
  icon: Icon,
  label,
  value,
  trend,
  delay,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  trend?: { value: string; up: boolean };
  delay: number;
  color: string;
}) {
  const colorMap: Record<string, { bg: string; icon: string }> = {
    cyan: { bg: "bg-sky-500/10", icon: "text-sky-500" },
    orange: { bg: "bg-orange-500/10", icon: "text-orange-500" },
    amber: { bg: "bg-amber-500/10", icon: "text-amber-500" },
    green: { bg: "bg-emerald-500/10", icon: "text-emerald-500" },
  };
  const c = colorMap[color] ?? colorMap.cyan;

  return (
    <div
      className="stat-enter flex items-center gap-4 rounded-xl border border-border/40 bg-card p-4 shadow-[var(--shadow-card)]"
      style={{ animationDelay: `${delay}ms`, animationFillMode: "both" }}
    >
      <div
        className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${c.bg}`}
      >
        <Icon className={`size-4 ${c.icon}`} />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <p className="text-lg font-semibold tracking-tight tabular-nums">
          {value}
        </p>
        {trend && (
          <p
            className={`mt-0.5 text-[11px] ${
              trend.up
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-red-500"
            }`}
          >
            {trend.up ? "↑" : "↓"} {trend.value}
          </p>
        )}
      </div>
    </div>
  );
}

export function WelcomeDashboard({ onNewChat }: WelcomeDashboardProps) {
  const router = useRouter();
  const [agents, setAgents] = useState<Agent[]>([]);

  useEffect(() => {
    fetch("/api/agents")
      .then((r) => (r.ok ? r.json() : []))
      .then(setAgents)
      .catch(() => {});
  }, []);

  const activeAgents = useMemo(
    () => agents.filter((a) => a.isActive),
    [agents]
  );

  // 按分组选出推荐代表（每组至多 2 个）
  const featuredAgents = useMemo(() => {
    const map = new Map<string, Agent[]>();
    for (const a of activeAgents) {
      const g = getAgentGroup(a.sortOrder);
      const bucket = map.get(g.key) ?? [];
      if (bucket.length < 2) {
        bucket.push(a);
        map.set(g.key, bucket);
      }
    }
    return getAllGroups()
      .flatMap((g) => (map.get(g.key) ?? []).slice(0, 2))
      .slice(0, 8);
  }, [activeAgents]);

  const handleNewChat = useCallback(async () => {
    if (onNewChat) {
      onNewChat();
    }
    try {
      const res = await fetch("/api/chat/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        throw new Error("Failed to create chat");
      }
      const { chatId } = await res.json();
      router.push(`/chat/${chatId}`);
    } catch {
      toast.error("创建对话失败，请重试");
    }
  }, [onNewChat, router]);

  const handleStartChatWithAgent = useCallback(
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

  return (
    <div className="flex h-full flex-col items-center overflow-y-auto px-6 py-0">
      <div className="w-full max-w-3xl pt-12 pb-8">
        {/* ===== Welcome 标题 ===== */}
        <div className="mb-10 text-center">
          <div className="mx-auto mb-5 flex size-16 items-center justify-center overflow-hidden rounded-2xl ring-1 ring-primary/10">
            <img
              alt="OPC Bot"
              className="size-full object-cover"
              src="/logo.jpg"
            />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">OPC Bot</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            选择一位 OPC 或直接开始对话，探索 AI 助手的无限可能
          </p>
        </div>

        {/* ===== 统计卡片 ===== */}
        <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            color="cyan"
            delay={0}
            icon={MessageSquare}
            label="对话数"
            trend={{ up: true, value: "12%" }}
            value="--"
          />
          <StatCard
            color="orange"
            delay={80}
            icon={Users}
            label="活跃用户"
            trend={{ up: true, value: "8%" }}
            value="--"
          />
          <StatCard
            color="amber"
            delay={160}
            icon={Zap}
            label="响应速度"
            trend={{ up: true, value: "5%" }}
            value="--"
          />
          <StatCard
            color="green"
            delay={240}
            icon={TrendingUp}
            label="OPC 数"
            value={String(activeAgents.length)}
          />
        </div>

        {/* ===== 快速开始 ===== */}
        <div className="mb-8">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            快速开始
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              className="group relative flex items-center gap-4 overflow-hidden rounded-xl border border-sky-500/15 bg-gradient-to-br from-sky-500/[0.04] to-transparent p-5 text-left shadow-[var(--shadow-card)] transition-all duration-300 hover:-translate-y-0.5 hover:border-sky-500/30 hover:shadow-[0_4px_24px_-4px_rgba(14,165,233,0.15)]"
              onClick={handleNewChat}
              type="button"
            >
              <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-sky-500/10 transition-colors group-hover:bg-sky-500/15">
                <MessageSquare className="size-5 text-sky-500" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">开始对话</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  直接与 AI 开始对话
                </p>
              </div>
              <svg
                className="size-4 shrink-0 text-muted-foreground/40 transition-all duration-300 group-hover:translate-x-0.5 group-hover:text-sky-500"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
              >
                <path
                  d="M9 5l7 7-7 7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <button
              className="group relative flex items-center gap-4 overflow-hidden rounded-xl border border-rose-500/15 bg-gradient-to-br from-rose-500/[0.04] to-transparent p-5 text-left shadow-[var(--shadow-card)] transition-all duration-300 hover:-translate-y-0.5 hover:border-rose-500/30 hover:shadow-[0_4px_24px_-4px_rgba(244,63,94,0.15)]"
              onClick={() => router.push("/agents")}
              type="button"
            >
              <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-rose-500/10 transition-colors group-hover:bg-rose-500/15">
                <Bot className="size-5 text-rose-500" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">选择 OPC</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  浏览和管理 OPC 角色
                </p>
              </div>
              <svg
                className="size-4 shrink-0 text-muted-foreground/40 transition-all duration-300 group-hover:translate-x-0.5 group-hover:text-rose-500"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
              >
                <path
                  d="M9 5l7 7-7 7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* ===== 推荐 OPC ===== */}
        {featuredAgents.length > 0 && (
          <div>
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              推荐 OPC
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {featuredAgents.map((agent, i) => {
                const group = getAgentGroup(agent.sortOrder);
                const avatarChar = getAvatarChar(agent.name);

                return (
                  <button
                    className={`stat-enter group flex items-center gap-4 overflow-hidden rounded-xl border border-border/40 bg-gradient-to-br ${group.gradientFrom} to-transparent p-4 text-left shadow-[var(--shadow-card)] transition-all duration-300 hover:-translate-y-0.5 hover:${group.borderHover} ${group.hoverShadow}`}
                    key={agent.id}
                    onClick={() => handleStartChatWithAgent(agent)}
                    style={{
                      animationDelay: `${300 + i * 80}ms`,
                      animationFillMode: "both",
                    }}
                    type="button"
                  >
                    <div
                      className={`flex size-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold shadow-sm transition-transform group-hover:scale-105 ${group.bg} ${group.text}`}
                    >
                      {avatarChar}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {agent.name}
                      </p>
                      <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                        {agent.description || "点击开始对话"}
                      </p>
                    </div>
                    <svg
                      className="size-4 shrink-0 text-muted-foreground/40 transition-all duration-300 group-hover:translate-x-0.5 group-hover:text-foreground"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      viewBox="0 0 24 24"
                    >
                      <path
                        d="M9 5l7 7-7 7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                );
              })}
            </div>

            {/* 查看更多 */}
            {activeAgents.length > featuredAgents.length && (
              <button
                className="mt-4 w-full rounded-xl border border-dashed border-border/50 py-2.5 text-center text-xs text-muted-foreground transition-colors hover:border-primary/30 hover:text-primary"
                onClick={() => router.push("/agents")}
                type="button"
              >
                查看全部 {activeAgents.length} 个 OPC →
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
