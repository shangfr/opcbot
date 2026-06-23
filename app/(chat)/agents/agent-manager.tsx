"use client";

import { BarChart3, FolderTree, Plus, Settings2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { Agent } from "@/lib/db/schema";
import { GroupManagerDialog } from "./group-manager-dialog";
import {
  AgentCard,
  CategoryProvider,
  GroupHeader,
  useAgents,
} from "./opc-shared";
import { SiteConfigDialog } from "./site-config-dialog";
import { StatsDialog } from "./stats-dialog";

type AgentFormData = {
  name: string;
  description: string;
  avatar: string;
  systemPrompt: string;
  phone: string;
  starterQuestions: string;
  isActive: boolean;
  isDefault: boolean;
  sortOrder: number;
  categoryId: string;
};

const emptyForm: AgentFormData = {
  name: "",
  description: "",
  avatar: "/icon.png",
  systemPrompt: "",
  phone: "",
  starterQuestions: "",
  isActive: true,
  isDefault: false,
  sortOrder: 0,
  categoryId: "__none__",
};

export function AgentManager() {
  const {
    agents,
    categories,
    loading,
    refresh,
    adminGroups,
    handleStartChat,
    ctxValue,
  } = useAgents();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [form, setForm] = useState<AgentFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<Agent | null>(null);
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [statsDialogOpen, setStatsDialogOpen] = useState(false);

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
      isDefault: agent.isDefault,
      sortOrder: agent.sortOrder,
      categoryId: agent.categoryId ?? "__none__",
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
      isDefault: form.isDefault,
      categoryId: form.categoryId === "__none__" ? null : form.categoryId,
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
    <CategoryProvider value={ctxValue}>
      <div className="mx-auto max-w-6xl px-6 py-8">
        {/* Header */}
        <div className="mb-10 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">OPC 管理</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              管理 AI OPC 角色配置，共 {agents.length} 个
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              className="gap-1.5"
              onClick={() => setStatsDialogOpen(true)}
              size="sm"
              variant="ghost"
            >
              <BarChart3 className="size-3.5" />
              数据看板
            </Button>
            <Button
              className="gap-1.5"
              onClick={() => setGroupDialogOpen(true)}
              size="sm"
              variant="ghost"
            >
              <FolderTree className="size-3.5" />
              管理分组
            </Button>
            <SiteConfigDialog />
            <Button className="gap-2" onClick={openCreate}>
              <Plus className="size-4" />
              新建 OPC
            </Button>
          </div>
        </div>

        {/* Empty state */}
        {agents.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 py-20">
            <Plus className="mb-4 size-12 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">还没有任何 OPC</p>
            <Button
              className="mt-4 gap-2"
              onClick={openCreate}
              variant="outline"
            >
              <Plus className="size-4" />
              创建第一个 AI OPC
            </Button>
          </div>
        )}

        {/* 按分组渲染 */}
        {groups.map(({ group, agents: groupAgents }) => (
          <section className="mb-10" key={group.key}>
            <GroupHeader count={groupAgents.length} group={group} />
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
              count={ungrouped.length}
              group={{ bg: "bg-slate-400", label: "其他" }}
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
        <Dialog onOpenChange={setDialogOpen} open={dialogOpen}>
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
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="例如：技术支持助手"
                  value={form.name}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="avatar">头像 URL</Label>
                <Input
                  id="avatar"
                  onChange={(e) => setForm({ ...form, avatar: e.target.value })}
                  placeholder="/icon.png"
                  value={form.avatar}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">手机号</Label>
                <Input
                  id="phone"
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="例如：13800138000"
                  value={form.phone}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="desc">描述 *</Label>
                <Textarea
                  className="min-h-[60px]"
                  id="desc"
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  placeholder="简短描述 OPC 的角色定位..."
                  value={form.description}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="prompt">系统提示词 *</Label>
                <Textarea
                  className="min-h-[120px] font-mono text-xs"
                  id="prompt"
                  onChange={(e) =>
                    setForm({ ...form, systemPrompt: e.target.value })
                  }
                  placeholder="你是一个乐于助人的 AI 助手..."
                  value={form.systemPrompt}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="starterQuestions">默认问题</Label>
                <Textarea
                  className="min-h-[80px] text-xs"
                  id="starterQuestions"
                  onChange={(e) =>
                    setForm({ ...form, starterQuestions: e.target.value })
                  }
                  placeholder={
                    "每行一个问题，最多 8 个\n例如：\n你好，你能帮我做什么？\n请介绍一下你的专业能力"
                  }
                  value={form.starterQuestions}
                />
                <p className="text-[11px] text-muted-foreground">
                  用户进入该 OPC 聊天时显示的默认引导问题，每行一个
                </p>
              </div>

              {/* 分组选择 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>所属分组</Label>
                  <button
                    className="inline-flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
                    onClick={() => setGroupDialogOpen(true)}
                    type="button"
                  >
                    <Settings2 className="size-3" />
                    管理分组
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <Select
                    onValueChange={(v) => setForm({ ...form, categoryId: v })}
                    value={form.categoryId}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="无分组" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">
                        <span className="text-muted-foreground">无分组</span>
                      </SelectItem>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          <span
                            className="inline-block size-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: cat.color }}
                          />
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {form.categoryId &&
                    form.categoryId !== "__none__" &&
                    (() => {
                      const cat = categories.find(
                        (c) => c.id === form.categoryId
                      );
                      return cat ? (
                        <Badge
                          className="shrink-0 gap-1 px-2 py-0.5 text-[11px]"
                          style={{
                            borderColor: cat.color + "40",
                            backgroundColor: cat.color + "10",
                            color: cat.color,
                          }}
                          variant="outline"
                        >
                          <span
                            className="inline-block size-2 rounded-full"
                            style={{ backgroundColor: cat.color }}
                          />
                          {cat.name}
                        </Badge>
                      ) : null;
                    })()}
                </div>
              </div>

              <div className="flex items-center gap-2 rounded-lg border border-amber-500/15 bg-amber-500/[0.03] px-3 py-2.5">
                <Switch
                  checked={form.isDefault}
                  id="isDefault"
                  onCheckedChange={(v) => setForm({ ...form, isDefault: v })}
                />
                <Label className="cursor-pointer text-sm" htmlFor="isDefault">
                  设为默认 OPC
                </Label>
                <span className="ml-auto text-[11px] text-muted-foreground">
                  「开始对话」将使用此 OPC 的配置
                </span>
              </div>

              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={form.isActive}
                    id="active"
                    onCheckedChange={(v) => setForm({ ...form, isActive: v })}
                  />
                  <Label className="cursor-pointer" htmlFor="active">
                    启用
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Label className="shrink-0" htmlFor="order">
                    排序
                  </Label>
                  <Input
                    className="w-20"
                    id="order"
                    onChange={(e) =>
                      setForm({
                        ...form,
                        sortOrder: Number(e.target.value) || 0,
                      })
                    }
                    type="number"
                    value={form.sortOrder}
                  />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button onClick={() => setDialogOpen(false)} variant="outline">
                取消
              </Button>
              <Button disabled={saving} onClick={handleSave}>
                {saving ? "保存中..." : editingAgent ? "保存修改" : "创建"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete confirmation dialog */}
        <Dialog
          onOpenChange={(open) => !open && setDeleteConfirm(null)}
          open={!!deleteConfirm}
        >
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>确认删除</DialogTitle>
              <DialogDescription>
                确定要删除 OPC「{deleteConfirm?.name}」吗？此操作不可撤销。
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button onClick={() => setDeleteConfirm(null)} variant="outline">
                取消
              </Button>
              <Button onClick={handleDelete} variant="destructive">
                删除
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 分组管理弹窗 */}
        <GroupManagerDialog
          onGroupsChange={() => {}}
          onOpenChange={setGroupDialogOpen}
          open={groupDialogOpen}
        />

        {/* 数据看板弹窗 */}
        <StatsDialog onOpenChange={setStatsDialogOpen} open={statsDialogOpen} />
      </div>
    </CategoryProvider>
  );
}
