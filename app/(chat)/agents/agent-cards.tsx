"use client";

import { Lightbulb, MessageCircle, PowerOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type { Agent } from "@/lib/db/schema";
import { getAllGroups, getAgentGroup, getAvatarChar } from "@/lib/agent-groups";

export function AgentCards() {
  const router = useRouter();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAgents = useCallback(async () => {
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

  const handleStartChat = (agent: Agent) => {
    router.push(`/chat?agentId=${agent.id}`);
  };

  // 按分组归类
  const groupedAgents = useMemo(() => {
    const activeAgents = agents.filter((a) => a.isActive);
    const inactiveAgents = agents.filter((a) => !a.isActive);

    const map = new Map<string, Agent[]>();
    // 确保每个分组都在，按 order 序
    for (const g of getAllGroups()) {
      map.set(g.key, []);
    }
    for (const a of activeAgents) {
      const group = getAgentGroup(a.sortOrder);
      const bucket = map.get(group.key) ?? [];
      bucket.push(a);
      map.set(group.key, bucket);
    }

    // 过滤掉空分组
    const activeGroups = getAllGroups()
      .filter((g) => (map.get(g.key)?.length ?? 0) > 0)
      .map((g) => ({ group: g, agents: map.get(g.key)! }));

    return { activeGroups, inactive: inactiveAgents };
  }, [agents]);

  if (loading) {
    return (
      <div className="flex min-h-[60dvh] items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <span className="dot-pulse h-2 w-2 rounded-full bg-primary" />
          加载中...
        </div>
      </div>
    );
  }

  const { activeGroups, inactive } = groupedAgents;
  const activeCount = agents.filter((a) => a.isActive).length;

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      {/* 页头 */}
      <div className="mb-10">
        <h1 className="text-2xl font-semibold tracking-tight">选择 OPC</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          选择一个角色开始对话，共 {activeCount} 个可用 OPC
        </p>
      </div>

      {/* 全空 */}
      {agents.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 py-20">
          <Lightbulb className="mb-4 size-12 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">还没有可用的 OPC</p>
        </div>
      )}

      {/* 按分组渲染 */}
      {activeGroups.map(({ group, agents: groupAgents }) => (
        <section key={group.key} className="mb-10">
          {/* 分组标题 */}
          <div className="mb-4 flex items-center gap-3">
            <div
              className={`h-1 w-6 rounded-full ${group.bg}`}
              aria-hidden
            />
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              {group.label}
            </h2>
            <span className="text-[10px] text-muted-foreground/50">
              {groupAgents.length} 个
            </span>
          </div>

          {/* 卡片网格 */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {groupAgents.map((agent) => {
              const avatarChar = getAvatarChar(agent.name);

              return (
                <button
                  key={agent.id}
                  type="button"
                  onClick={() => handleStartChat(agent)}
                  className={`fade-up group relative cursor-pointer overflow-hidden rounded-2xl border border-border/50 bg-gradient-to-br ${group.gradientFrom} to-transparent p-5 text-left shadow-[var(--shadow-card)] transition-all duration-300 hover:-translate-y-1 hover:${group.borderHover} ${group.hoverShadow}`}
                >
                  {/* 顶部色条 */}
                  <div className={`absolute inset-x-0 top-0 h-1 ${group.bg}`} />

                  {/* 头像 + 名称 */}
                  <div className="mb-3 mt-1.5 flex items-center gap-3">
                    <div
                      className={`flex size-11 shrink-0 items-center justify-center rounded-xl text-base font-bold shadow-sm ${group.bg} ${group.text}`}
                    >
                      {avatarChar}
                    </div>
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold leading-tight">
                        {agent.name}
                      </h3>
                      <p
                        className={`mt-0.5 text-[10px] font-medium ${group.softText}`}
                      >
                        {group.label}
                      </p>
                    </div>
                  </div>

                  {/* 描述 */}
                  <p className="mb-4 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                    {agent.description}
                  </p>

                  {/* hover 行动按钮 */}
                  <div className="flex items-center justify-between opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                    <span className="text-[10px] text-muted-foreground">
                      点击开始对话
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${group.soft} ${group.softText} group-hover:${group.bg} group-hover:${group.text}`}
                    >
                      <MessageCircle className="size-3" />
                      聊天
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      ))}

      {/* 已停用的 Agent */}
      {inactive.length > 0 && (
        <section>
          <div className="mb-4 flex items-center gap-3">
            <div className="h-1 w-6 rounded-full bg-muted-foreground/30" />
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              已停用
            </h2>
            <span className="text-[10px] text-muted-foreground/50">
              {inactive.length} 个
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 opacity-50">
            {inactive.map((agent) => {
              const avatarChar = getAvatarChar(agent.name);

              return (
                <div
                  key={agent.id}
                  className="relative rounded-2xl border border-border/50 bg-card p-5"
                >
                  <div className="mb-3 flex items-center gap-3">
                    <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted text-base font-bold text-muted-foreground/50">
                      {avatarChar}
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold leading-tight">
                        {agent.name}
                      </h3>
                      <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                        <PowerOff className="size-2.5" />
                        已停用
                      </span>
                    </div>
                  </div>
                  <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                    {agent.description}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
