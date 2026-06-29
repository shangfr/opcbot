"use client";

import {
  Edit,
  Lightbulb,
  Loader2,
  Plus,
  Power,
  PowerOff,
  Search,
  Trash2,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getAvatarChar } from "@/lib/agent-groups";
import type { Agent } from "@/lib/db/schema";
import { cn, fetcher } from "@/lib/utils";
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

  // ── 我的 private OPC ──
  const { data: myAgents = [], mutate: mutateMine } = useSWR<Agent[]>(
    "/api/agents?scope=mine",
    fetcher,
  );

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
    [userGroups.groups],
  );

  // ── 创建/编辑/删除 private OPC ──
  const [showCreate, setShowCreate] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [deleteAgent, setDeleteAgent] = useState<Agent | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    systemPrompt: "",
  });

  const openCreate = () => {
    setEditingAgent(null);
    setForm({ name: "", description: "", systemPrompt: "" });
    setShowCreate(true);
  };

  const openEdit = (agent: Agent) => {
    setEditingAgent(agent);
    setForm({
      name: agent.name,
      description: agent.description,
      systemPrompt: agent.systemPrompt,
    });
    setShowCreate(true);
  };

  const refreshAll = useCallback(() => {
    mutateMine();
  }, [mutateMine]);

  const handleSave = async () => {
    if (
      !form.name.trim() ||
      !form.description.trim() ||
      !form.systemPrompt.trim()
    ) {
      toast.error("名称、描述、系统提示词不能为空");
      return;
    }

    setSaving(true);
    try {
      const url = editingAgent
        ? `/api/agents?id=${editingAgent.id}`
        : "/api/agents";
      const method = editingAgent ? "PATCH" : "POST";
      const body = {
        name: form.name.trim(),
        description: form.description.trim(),
        systemPrompt: form.systemPrompt.trim(),
        avatar: "/icon.png",
        visibility: "private",
        isActive: true,
        sortOrder: 0,
      };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "保存失败");
      }

      toast.success(editingAgent ? "OPC 已更新" : "OPC 创建成功");
      setShowCreate(false);
      refreshAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (agent: Agent) => {
    try {
      const res = await fetch(`/api/agents?id=${agent.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !agent.isActive }),
      });
      if (!res.ok) throw new Error("操作失败");
      toast.success(agent.isActive ? "已停用" : "已启用");
      refreshAll();
    } catch {
      toast.error("操作失败");
    }
  };

  const handleDelete = async () => {
    if (!deleteAgent) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/agents?id=${deleteAgent.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("删除失败");
      toast.success("OPC 已删除");
      setDeleteAgent(null);
      refreshAll();
    } catch {
      toast.error("删除失败");
    } finally {
      setDeleting(false);
    }
  };

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
                  : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground",
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
                    : "bg-background/80",
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
                    : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground",
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
                      : "bg-background/80",
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

        {/* ═══ 我的 OPC 区域 ═══ */}
        {filtered === null && activeCategory === null && (
          <section className="mt-10 border-t border-border/40 pt-8">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-1 w-6 rounded-full bg-primary/60" />
                <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  我的 OPC
                </h2>
                <span className="text-[10px] text-muted-foreground/50">
                  {myAgents.length} 个
                </span>
              </div>
              <button
                className="touch-target inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-2.5 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
                onClick={openCreate}
                type="button"
              >
                <Plus className="size-3.5" />
                <span className="hidden sm:inline">创建 OPC</span>
                <span className="sm:hidden">创建</span>
              </button>
            </div>

            {myAgents.length === 0 ? (
              <div className="empty-state py-10">
                <Plus className="mb-3 size-8 text-muted-foreground/30" />
                <p className="text-xs text-muted-foreground">
                  创建专属的 OPC，自定义人设和提示词
                </p>
                <button
                  className="touch-target mt-3 inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
                  onClick={openCreate}
                  type="button"
                >
                  <Plus className="size-3.5" />
                  创建第一个
                </button>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {myAgents.map((agent) => {
                  const avatarChar = getAvatarChar(agent.name);
                  return (
                    <div
                      className={cn(
                        "group rounded-xl border p-4 transition-all",
                        agent.isActive
                          ? "border-border/50 bg-card hover:border-border hover:shadow-sm"
                          : "border-border/30 bg-muted/20 opacity-60",
                      )}
                      key={agent.id}
                    >
                      <div className="mb-3 flex items-start gap-3">
                        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-base font-bold text-primary">
                          {avatarChar}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="truncate text-sm font-semibold">
                            {agent.name}
                          </h3>
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 text-[10px]",
                              agent.isActive
                                ? "text-emerald-600"
                                : "text-muted-foreground",
                            )}
                          >
                            {agent.isActive ? (
                              <>
                                <Power className="size-2.5" />
                                已启用
                              </>
                            ) : (
                              <>
                                <PowerOff className="size-2.5" />
                                已停用
                              </>
                            )}
                          </span>
                        </div>
                      </div>
                      <p className="mb-3 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                        {agent.description}
                      </p>
                      <div className="flex items-center gap-1.5">
                        <button
                          className="touch-target inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border/50 px-2 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
                          onClick={() => handleStartChat(agent)}
                          type="button"
                        >
                          对话
                        </button>
                        <button
                          className="touch-target inline-flex items-center justify-center rounded-lg border border-border/50 px-2 py-1.5 text-xs transition-colors hover:bg-muted"
                          onClick={() => openEdit(agent)}
                          title="编辑"
                          type="button"
                        >
                          <Edit className="size-3.5" />
                        </button>
                        <button
                          className="touch-target inline-flex items-center justify-center rounded-lg border border-border/50 px-2 py-1.5 text-xs transition-colors hover:bg-muted"
                          onClick={() => handleToggleActive(agent)}
                          title={agent.isActive ? "停用" : "启用"}
                          type="button"
                        >
                          {agent.isActive ? (
                            <PowerOff className="size-3.5" />
                          ) : (
                            <Power className="size-3.5" />
                          )}
                        </button>
                        <button
                          className="touch-target inline-flex items-center justify-center rounded-lg border border-destructive/30 px-2 py-1.5 text-xs text-destructive transition-colors hover:bg-destructive/5"
                          onClick={() => setDeleteAgent(agent)}
                          title="删除"
                          type="button"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </div>

      {/* ═══ 创建/编辑弹窗 ═══ */}
      <Dialog onOpenChange={setShowCreate} open={showCreate}>
        <DialogContent className="dialog-mobile-friendly max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingAgent ? "编辑 OPC" : "创建 OPC"}</DialogTitle>
            <DialogDescription>
              {editingAgent
                ? "修改你的 OPC 角色配置"
                : "创建一个专属的 AI 助手，仅你自己可见"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">名称</Label>
              <Input
                maxLength={64}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="例如：写作助手"
                value={form.name}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">描述</Label>
              <Input
                maxLength={512}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                placeholder="简短描述这个 OPC 的用途"
                value={form.description}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">
                系统提示词
              </Label>
              <Textarea
                className="min-h-[120px] resize-y"
                onChange={(e) =>
                  setForm({ ...form, systemPrompt: e.target.value })
                }
                placeholder="定义 OPC 的人设、能力和回复风格..."
                value={form.systemPrompt}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <button
              className="touch-target rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
              onClick={() => setShowCreate(false)}
              type="button"
            >
              取消
            </button>
            <button
              className="touch-target inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              disabled={saving}
              onClick={handleSave}
              type="button"
            >
              {saving && <Loader2 className="size-3.5 animate-spin" />}
              {editingAgent ? "保存" : "创建"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ 删除确认弹窗 ═══ */}
      <Dialog
        onOpenChange={(o) => !o && setDeleteAgent(null)}
        open={!!deleteAgent}
      >
        <DialogContent className="dialog-mobile-friendly max-w-sm">
          <DialogHeader>
            <DialogTitle>删除 OPC？</DialogTitle>
            <DialogDescription>
              确定要删除「{deleteAgent?.name}」吗？此操作无法撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <button
              className="touch-target rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
              onClick={() => setDeleteAgent(null)}
              type="button"
            >
              取消
            </button>
            <button
              className="touch-target inline-flex items-center gap-1.5 rounded-lg bg-destructive px-4 py-1.5 text-xs font-medium text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:opacity-50"
              disabled={deleting}
              onClick={handleDelete}
              type="button"
            >
              {deleting && <Loader2 className="size-3.5 animate-spin" />}
              确认删除
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </CategoryProvider>
  );
}
