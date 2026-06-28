"use client";

import { Lightbulb, PowerOff, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { getAvatarChar } from "@/lib/agent-groups";
import { cn } from "@/lib/utils";
import {
  AgentCard,
  CategoryProvider,
  GroupHeader,
  useAgents,
} from "./opc-shared";

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
  // 类别筛选：null 表示「全部」
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const filtered = search.trim() ? searchAgents(search) : null;

  // 构建类别筛选按钮列表（仅展示有活跃 OPC 的类别）
  const categoryFilters = useMemo(() => {
    const seen = new Map<string, { id: string; name: string; count: number }>();
    for (const { group, agents: groupAgents } of userGroups.groups) {
      if (group.key === "__ungrouped__") continue;
      seen.set(group.key, {
        id: group.key,
        name: group.label,
        count: groupAgents.length,
      });
    }
    return Array.from(seen.values());
  }, [userGroups.groups]);

  // 按类别筛选后的分组
  const visibleGroups = useMemo(() => {
    if (activeCategory === null) return userGroups.groups;
    return userGroups.groups.filter((g) => g.group.key === activeCategory);
  }, [userGroups.groups, activeCategory]);

  // 全部活跃 OPC 数量
  const totalActive = useMemo(
    () => userGroups.groups.reduce((sum, g) => sum + g.agents.length, 0),
    [userGroups.groups]
  );

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

  const { inactive } = userGroups;

  return (
    <CategoryProvider value={ctxValue}>
      <div className="page-container">
        {/* 搜索框 */}
        {activeCount > 3 && (
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/50" />
            <input
              className="search-input"
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索 OPC..."
              type="text"
              value={search}
            />
          </div>
        )}

        {/* 类别筛选按钮（搜索时不显示） */}
        {filtered === null && categoryFilters.length > 0 && (
          <div className="mb-6 flex flex-wrap items-center gap-2">
            <button
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all sm:px-3.5",
                activeCategory === null
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
              onClick={() => setActiveCategory(null)}
              type="button"
            >
              全部
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px]",
                  activeCategory === null
                    ? "bg-primary-foreground/20"
                    : "bg-background/80"
                )}
              >
                {totalActive}
              </span>
            </button>
            {categoryFilters.map((cat) => (
              <button
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all sm:px-3.5",
                  activeCategory === cat.id
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                type="button"
              >
                {cat.name}
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[10px]",
                    activeCategory === cat.id
                      ? "bg-primary-foreground/20"
                      : "bg-background/80"
                  )}
                >
                  {cat.count}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* 全空 */}
        {agents.length === 0 && (
          <div className="empty-state">
            <Lightbulb className="mb-4 size-12 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">还没有可用的 OPC</p>
          </div>
        )}

        {/* 搜索结果 */}
        {filtered !== null && filtered.length > 0 && (
          <div className="card-grid">
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
          <div className="empty-state py-16">
            <Search className="mb-3 size-8 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">未找到匹配的 OPC</p>
          </div>
        )}

        {/* 按分组渲染（无搜索时，应用类别筛选） */}
        {filtered === null &&
          visibleGroups.map(({ group, agents: groupAgents }) => (
            <section className="mb-10" key={group.key}>
              <GroupHeader count={groupAgents.length} group={group} />
              <div className="card-grid">
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

        {/* 类别筛选下无结果 */}
        {filtered === null &&
          visibleGroups.length === 0 &&
          agents.length > 0 && (
            <div className="empty-state py-16">
              <Lightbulb className="mb-3 size-8 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">
                该类别下暂无 OPC
              </p>
            </div>
          )}

        {/* 已停用的 OPC（无搜索且未筛选类别时） */}
        {filtered === null &&
          activeCategory === null &&
          inactive.length > 0 && (
            <section>
              <GroupHeader
                count={inactive.length}
                group={{ bg: "bg-muted-foreground/30", label: "已停用" }}
              />
              <div className="card-grid opacity-50">
                {inactive.map((agent) => {
                  const avatarChar = getAvatarChar(agent.name);
                  return (
                    <Card
                      className="relative"
                      key={agent.id}
                      padding="lg"
                      variant="elevated"
                    >
                      <div className="mb-3 flex items-center gap-3">
                        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted text-base font-bold text-muted-foreground/50">
                          {avatarChar}
                        </div>
                        <div className="min-w-0">
                          <h3 className="truncate text-sm font-semibold leading-tight">
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
                    </Card>
                  );
                })}
              </div>
            </section>
          )}
      </div>
    </CategoryProvider>
  );
}
