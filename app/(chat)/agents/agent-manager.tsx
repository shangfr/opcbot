"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { Agent } from "@/lib/db/schema";
import { AgentCard, GroupHeader, useAgents } from "./opc-shared";

type AgentFormData = {
  name: string;
  description: string;
  avatar: string;
  systemPrompt: string;
  phone: string;
  starterQuestions: string;
  isActive: boolean;
  sortOrder: number;
};

const emptyForm: AgentFormData = {
  name: "",
  description: "",
  avatar: "/icon.png",
  systemPrompt: "",
  phone: "",
  starterQuestions: "",
  isActive: true,
  sortOrder: 0,
};

export function AgentManager() {
  const { agents, loading, refresh, adminGroups, handleStartChat } = useAgents();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [form, setForm] = useState<AgentFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<Agent | null>(null);

  const openCreate = () => {
    setEditingAgent(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (agent: Agent) => {
    setEditingAgent(agent);
    setForm({
      name: agent.name,
      description: agent.description,
      avatar: agent.avatar,
      systemPrompt: agent.systemPrompt,
      phone: agent.phone ?? "",
      starterQuestions: (agent.starterQuestions ?? []).join("\n"),
      isActive: agent.isActive,
      sortOrder: agent.sortOrder,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (
      !form.name.trim() ||
      !form.description.trim() ||
      !form.systemPrompt.trim()
    ) {
      toast.error("请填写所有必填字段");
      return;
    }

    const payload = {
      ...form,
      starterQuestions: form.starterQuestions
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
    };

    setSaving(true);
    try {
      if (editingAgent) {
        const res = await fetch(`/api/agents?id=${editingAgent.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("Failed to update");
        toast.success("OPC 已更新");
      } else {
        const res = await fetch("/api/agents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("Failed to create");
        toast.success("OPC 已创建");
      }
      setDialogOpen(false);
      refresh();
    } catch {
      toast.error("保存失败，请重试");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      const res = await fetch(`/api/agents?id=${deleteConfirm.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete");
      toast.success("OPC 已删除");
      setDeleteConfirm(null);
      refresh();
    } catch {
      toast.error("删除失败，请重试");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[calc(100dvh-4rem)] items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <span className="dot-pulse h-2 w-2 rounded-full bg-primary" />
          加载中...
        </div>
      </div>
    );
  }

  const { groups, ungrouped } = adminGroups;

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      {/* Header */}
      <div className="mb-10 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">OPC 管理</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            管理 AI OPC 角色配置，共 {agents.length} 个
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="size-4" />
          新建 OPC
        </Button>
      </div>

      {/* Empty state */}
      {agents.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 py-20">
          <Plus className="mb-4 size-12 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">还没有任何 OPC</p>
          <Button
            variant="outline"
            className="mt-4 gap-2"
            onClick={openCreate}
          >
            <Plus className="size-4" />
            创建第一个 AI OPC
          </Button>
        </div>
      )}

      {/* 按分组渲染 */}
      {groups.map(({ group, agents: groupAgents }) => (
        <section key={group.key} className="mb-10">
          <GroupHeader group={group} count={groupAgents.length} />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {groupAgents.map((agent) => (
              <AgentCard
                admin
                agent={agent}
                key={agent.id}
                onChat={agent.isActive ? handleStartChat : undefined}
                onDelete={(a) => setDeleteConfirm(a)}
                onEdit={openEdit}
              />
            ))}
          </div>
        </section>
      ))}

      {/* 未分组 */}
      {ungrouped.length > 0 && (
        <section className="mb-10">
          <GroupHeader
            group={{ bg: "bg-slate-400", label: "其他" }}
            count={ungrouped.length}
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {ungrouped.map((agent) => (
              <AgentCard
                admin
                agent={agent}
                key={agent.id}
                onChat={agent.isActive ? handleStartChat : undefined}
                onDelete={(a) => setDeleteConfirm(a)}
                onEdit={openEdit}
              />
            ))}
          </div>
        </section>
      )}

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[85dvh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingAgent ? "编辑 OPC" : "新建 OPC"}
            </DialogTitle>
            <DialogDescription>
              {editingAgent
                ? "修改 OPC 角色的名称、描述和系统提示词"
                : "创建一个新的 OPC 角色配置"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="name">名称 *</Label>
              <Input
                id="name"
                placeholder="例如：技术支持助手"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="avatar">头像 URL</Label>
              <Input
                id="avatar"
                placeholder="/icon.png"
                value={form.avatar}
                onChange={(e) => setForm({ ...form, avatar: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">手机号</Label>
              <Input
                id="phone"
                placeholder="例如：13800138000"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="desc">描述 *</Label>
              <Textarea
                id="desc"
                className="min-h-[60px]"
                placeholder="简短描述 OPC 的角色定位..."
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="prompt">系统提示词 *</Label>
              <Textarea
                id="prompt"
                className="min-h-[120px] font-mono text-xs"
                placeholder="你是一个乐于助人的 AI 助手..."
                value={form.systemPrompt}
                onChange={(e) =>
                  setForm({ ...form, systemPrompt: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="starterQuestions">默认问题</Label>
              <Textarea
                id="starterQuestions"
                className="min-h-[80px] text-xs"
                placeholder={"每行一个问题，最多 8 个\n例如：\n你好，你能帮我做什么？\n请介绍一下你的专业能力"}
                value={form.starterQuestions}
                onChange={(e) =>
                  setForm({ ...form, starterQuestions: e.target.value })
                }
              />
              <p className="text-[11px] text-muted-foreground">
                用户进入该 OPC 聊天时显示的默认引导问题，每行一个
              </p>
            </div>

            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch
                  id="active"
                  checked={form.isActive}
                  onCheckedChange={(v) => setForm({ ...form, isActive: v })}
                />
                <Label htmlFor="active" className="cursor-pointer">
                  启用
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="order" className="shrink-0">
                  排序
                </Label>
                <Input
                  id="order"
                  className="w-20"
                  type="number"
                  value={form.sortOrder}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      sortOrder: Number(e.target.value) || 0,
                    })
                  }
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "保存中..." : editingAgent ? "保存修改" : "创建"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog
        open={!!deleteConfirm}
        onOpenChange={(open) => !open && setDeleteConfirm(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>
              确定要删除 OPC「{deleteConfirm?.name}」吗？此操作不可撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              取消
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
