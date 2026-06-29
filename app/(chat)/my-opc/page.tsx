"use client";

import {
  ArrowLeft,
  Bot,
  Edit,
  Loader2,
  MessageCircle,
  Plus,
  Power,
  PowerOff,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import useSWR, { useSWRConfig } from "swr";
import { getAvatarChar } from "@/lib/agent-groups";
import type { Agent } from "@/lib/db/schema";
import { cn, fetcher } from "@/lib/utils";
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

export default function MyOpcPage() {
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const { data: agents = [], isLoading } = useSWR<Agent[]>(
    "/api/agents?scope=mine",
    fetcher
  );

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

  const handleSave = async () => {
    if (!form.name.trim() || !form.description.trim() || !form.systemPrompt.trim()) {
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
      mutate("/api/agents?mine=1");
      mutate("/api/agents");
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
      mutate("/api/agents?mine=1");
      mutate("/api/agents");
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
      mutate("/api/agents?mine=1");
      mutate("/api/agents");
    } catch {
      toast.error("删除失败");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex h-dvh flex-col bg-background">
      <header className="page-header shrink-0">
        <button
          className="back-button"
          onClick={() => router.back()}
          type="button"
        >
          <ArrowLeft className="size-3.5" />
          <span className="hidden sm:inline">返回</span>
        </button>
        <div className="flex min-w-0 items-center gap-2">
          <Bot className="size-4 shrink-0 text-primary" />
          <h1 className="truncate text-sm font-semibold">我的 OPC</h1>
          <span className="shrink-0 text-xs text-muted-foreground">
            {agents.length} 个
          </span>
        </div>
        <button
          className="touch-target ml-auto inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          onClick={openCreate}
          type="button"
        >
          <Plus className="size-3.5" />
          <span className="hidden sm:inline">创建 OPC</span>
          <span className="sm:hidden">创建</span>
        </button>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl px-4 py-6 md:px-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : agents.length === 0 ? (
            <div className="empty-state">
              <Bot className="mb-4 size-12 text-muted-foreground/30" />
              <p className="text-sm font-medium text-foreground/70">
                还没有创建自己的 OPC
              </p>
              <p className="mt-1 px-4 text-xs text-muted-foreground">
                创建专属的 AI 助手，自定义人设、提示词和知识库
              </p>
              <button
                className="touch-target mt-4 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                onClick={openCreate}
                type="button"
              >
                <Plus className="size-3.5" />
                创建第一个 OPC
              </button>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {agents.map((agent) => {
                const avatarChar = getAvatarChar(agent.name);
                return (
                  <div
                    className={cn(
                      "rounded-xl border p-4 transition-all",
                      agent.isActive
                        ? "border-border/50 bg-card hover:border-border hover:shadow-sm"
                        : "border-border/30 bg-muted/20 opacity-60"
                    )}
                    key={agent.id}
                  >
                    <div className="mb-3 flex items-start gap-3">
                      <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted text-base font-bold text-muted-foreground">
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
                              : "text-muted-foreground"
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
                        onClick={() => router.push(`/chat?agentId=${agent.id}`)}
                        type="button"
                      >
                        <MessageCircle className="size-3.5" />
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
        </div>
      </div>

      {/* 创建/编辑弹窗 */}
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
              <Label className="text-xs text-muted-foreground">系统提示词</Label>
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

      {/* 删除确认 */}
      <Dialog onOpenChange={(o) => !o && setDeleteAgent(null)} open={!!deleteAgent}>
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
    </div>
  );
}
