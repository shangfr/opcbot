"use client";

import { Lightbulb, PowerOff, Search } from "lucide-react";
import { useState } from "react";
import { getAvatarChar } from "@/lib/agent-groups";
import { AgentCard, CategoryProvider, GroupHeader, useAgents } from "./opc-shared";

export function AgentCards() {
  const {
    agents,
    loading,
    userGroups,
    activeCount,
    searchAgents,
    handleStartChat,
    ctxValue,
  } = useAgents();
  const [search, setSearch] = useState("");

  const filtered = search.trim() ? searchAgents(search) : null;

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

  const { groups, inactive } = userGroups;

  return (
    <CategoryProvider value={ctxValue}>
    <div className="mx-auto max-w-6xl px-6 py-8">
      {/* 页头 */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">选择 OPC</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          选择一个角色开始对话，共 {activeCount} 个可用 OPC
        </p>
      </div>

      {/* 搜索框 */}
      {activeCount > 6 && (
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/50" />
          <input
            className="w-full rounded-xl border border-border/50 bg-background py-2.5 pl-10 pr-4 text-sm transition-colors placeholder:text-muted-foreground/40 focus:border-primary/30 focus:outline-none focus:ring-2 focus:ring-primary/10"
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索 OPC..."
            type="text"
            value={search}
          />
        </div>
      )}

      {/* 全空 */}
      {agents.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 py-20">
          <Lightbulb className="mb-4 size-12 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">还没有可用的 OPC</p>
        </div>
      )}

      {/* 搜索结果 */}
      {filtered !== null && filtered.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((agent) => (
            <AgentCard
              agent={agent}
              key={agent.id}
              onChat={handleStartChat}
            />
          ))}
        </div>
      )}

      {filtered !== null && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 py-16">
          <Search className="mb-3 size-8 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">未找到匹配的 OPC</p>
        </div>
      )}

      {/* 按分组渲染（无搜索时） */}
      {filtered === null &&
        groups.map(({ group, agents: groupAgents }) => (
          <section key={group.key} className="mb-10">
            <GroupHeader group={group} count={groupAgents.length} />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {groupAgents.map((agent) => (
                <AgentCard
                  agent={agent}
                  key={agent.id}
                  onChat={handleStartChat}
                />
              ))}
            </div>
          </section>
        ))}

      {/* 已停用的 OPC（无搜索时） */}
      {filtered === null && inactive.length > 0 && (
        <section>
          <GroupHeader
            group={{ bg: "bg-muted-foreground/30", label: "已停用" }}
            count={inactive.length}
          />
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
    </CategoryProvider>
  );
}
