"use client";

import {
  Bot,
  MessageSquare,
  Sparkles,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Agent } from "@/lib/db/schema";
import {
  getAllGroups,
  getAgentGroup,
  getAvatarChar,
} from "@/lib/agent-groups";

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
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  trend?: { value: string; up: boolean };
  delay: number;
}) {
  return (
    <div
      className="stat-enter flex items-center gap-4 rounded-xl border border-border/40 bg-card p-4 shadow-[var(--shadow-card)]"
      style={{ animationDelay: `${delay}ms`, animationFillMode: "both" }}
    >
      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/8">
        <Icon className="size-4 text-primary/70" />
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
    [agents],
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

  const handleNewChat = useCallback(() => {
    if (onNewChat) {
      onNewChat();
    }
    router.push("/chat");
  }, [onNewChat, router]);

  const handleStartChatWithAgent = useCallback(
    (agent: Agent) => {
      router.push(`/chat?agentId=${agent.id}`);
    },
    [router],
  );

  return (
    <div className="flex h-full flex-col items-center overflow-y-auto px-6 py-0">
      <div className="w-full max-w-3xl pt-12 pb-8">
        {/* ===== Welcome 标题 ===== */}
        <div className="mb-10 text-center">
          <div className="mx-auto mb-5 flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/10 to-accent/10 ring-1 ring-primary/10">
            <Sparkles className="size-7 text-primary" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            OPC Bot
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            选择一位 Agent 或直接开始对话，探索 AI 助手的无限可能
          </p>
        </div>

        {/* ===== 统计卡片 ===== */}
        <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            delay={0}
            icon={MessageSquare}
            label="对话数"
            trend={{ up: true, value: "12%" }}
            value="--"
          />
          <StatCard
            delay={80}
            icon={Users}
            label="活跃用户"
            trend={{ up: true, value: "8%" }}
            value="--"
          />
          <StatCard
            delay={160}
            icon={Zap}
            label="响应速度"
            trend={{ up: true, value: "5%" }}
            value="--"
          />
          <StatCard
            delay={240}
            icon={TrendingUp}
            label="Agent 数"
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
              type="button"
              onClick={handleNewChat}
              className="group flex items-center gap-4 rounded-xl border border-border/40 bg-card p-4 text-left shadow-[var(--shadow-card)] transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[var(--shadow-float)]"
            >
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/8 transition-colors group-hover:bg-primary/15">
                <MessageSquare className="size-5 text-primary/70" />
              </div>
              <div>
                <p className="text-sm font-medium">新建对话</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  直接与 AI 开始对话
                </p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => router.push("/agents")}
              className="group flex items-center gap-4 rounded-xl border border-border/40 bg-card p-4 text-left shadow-[var(--shadow-card)] transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[var(--shadow-float)]"
            >
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent/8 transition-colors group-hover:bg-accent/15">
                <Bot className="size-5 text-accent/70" />
              </div>
              <div>
                <p className="text-sm font-medium">选择 Agent</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  浏览和管理 Agent 角色
                </p>
              </div>
            </button>
          </div>
        </div>

        {/* ===== 推荐 Agent ===== */}
        {featuredAgents.length > 0 && (
          <div>
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              推荐 Agent
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {featuredAgents.map((agent, i) => {
                const group = getAgentGroup(agent.sortOrder);
                const avatarChar = getAvatarChar(agent.name);

                return (
                  <button
                    key={agent.id}
                    type="button"
                    onClick={() => handleStartChatWithAgent(agent)}
                    className="stat-enter group flex items-center gap-4 rounded-xl border border-border/40 bg-card p-3 text-left shadow-[var(--shadow-card)] transition-all duration-200 hover:-translate-y-0.5 hover:border-transparent hover:shadow-[var(--shadow-float)] hover:ring-2 hover:ring-primary/15"
                    style={{
                      animationDelay: `${300 + i * 80}ms`,
                      animationFillMode: "both",
                    }}
                  >
                    <div
                      className={`flex size-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold shadow-sm transition-transform group-hover:scale-105 ${group.bg} ${group.text}`}
                    >
                      {avatarChar}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {agent.name}
                      </p>
                      <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                        {agent.description || "点击开始对话"}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* 查看更多 */}
            {activeAgents.length > featuredAgents.length && (
              <button
                type="button"
                onClick={() => router.push("/agents")}
                className="mt-4 w-full rounded-xl border border-dashed border-border/50 py-2.5 text-center text-xs text-muted-foreground transition-colors hover:border-primary/30 hover:text-primary"
              >
                查看全部 {activeAgents.length} 个 Agent →
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
