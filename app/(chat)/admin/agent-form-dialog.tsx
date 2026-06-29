"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Settings2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { Agent, Category } from "@/lib/db/schema";
import { KnowledgeSection } from "./knowledge-section";

type AgentFormData = {
  name: string;
  description: string;
  avatar: string;
  systemPrompt: string;
  phone: string;
  knowledgeId: string;
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
  knowledgeId: "__none__",
  starterQuestions: "",
  isActive: true,
  isDefault: false,
  sortOrder: 0,
  categoryId: "__none__",
};

export function AgentFormDialog({
  open,
  onOpenChange,
  editingAgent,
  categories,
  onOpenGroupDialog,
  onSuccess,
  isAdmin = false // 新增：默认为非管理员
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingAgent: Agent | null;
  categories: Category[];
  onOpenGroupDialog: () => void;
  onSuccess: () => void;
  isAdmin?: boolean;
}) {
  const [form, setForm] = useState<AgentFormData>(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      if (editingAgent) {
        setForm({
          name: editingAgent.name,
          description: editingAgent.description,
          avatar: editingAgent.avatar,
          systemPrompt: editingAgent.systemPrompt,
          phone: editingAgent.phone ?? "",
          knowledgeId: editingAgent.knowledgeId ?? "__none__",
          starterQuestions: (editingAgent.starterQuestions ?? []).join("\n"),
          isActive: editingAgent.isActive,
          isDefault: editingAgent.isDefault,
          sortOrder: editingAgent.sortOrder,
          categoryId: editingAgent.categoryId ?? "__none__",
        });
      } else {
        setForm(emptyForm);
      }
    }
  }, [open, editingAgent]);

  const handleSave = async () => {
    if (!form.name.trim() || !form.description.trim() || !form.systemPrompt.trim()) {
      toast.error("请填写所有必填字段");
      return;
    }

    const payload = {
      ...form,
      starterQuestions: form.starterQuestions.split("\n").map((s) => s.trim()).filter(Boolean),
      knowledgeId: form.knowledgeId === "__none__" ? null : form.knowledgeId,
      // 普通用户强制覆盖以下字段，防止越权
      categoryId: isAdmin ? (form.categoryId === "__none__" ? null : form.categoryId) : null,
      isDefault: isAdmin ? form.isDefault : false,
      sortOrder: isAdmin ? form.sortOrder : 0,
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
      onOpenChange(false);
      onSuccess();
    } catch {
      toast.error("保存失败，请重试");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="dialog-mobile-friendly max-h-[90dvh] max-w-lg">
        <DialogHeader>
          <DialogTitle>{editingAgent ? "编辑 OPC" : "新建 OPC"}</DialogTitle>
          <DialogDescription>
            {editingAgent ? "修改 OPC 角色的名称、描述和系统提示词" : "创建一个新的 OPC 角色配置"}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="name">名称 *</Label>
            <Input id="name" onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="例如：技术支持助手" value={form.name} />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="avatar">头像 URL</Label>
            <Input id="avatar" onChange={(e) => setForm({ ...form, avatar: e.target.value })} placeholder="/icon.png" value={form.avatar} />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="phone">手机号</Label>
            <Input id="phone" onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="例如：13800138000" value={form.phone} />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="desc">描述 *</Label>
            <Textarea className="min-h-[60px]" id="desc" onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="简短描述 OPC 的角色定位..." value={form.description} />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="prompt">系统提示词 *</Label>
            <Textarea className="min-h-[120px] font-mono text-xs" id="prompt" onChange={(e) => setForm({ ...form, systemPrompt: e.target.value })} placeholder="你是一个乐于助人的 AI 助手..." value={form.systemPrompt} />
          </div>

          {/* 知识库配置 (RAG) */}
          <KnowledgeSection onChange={(v) => setForm({ ...form, knowledgeId: v })} value={form.knowledgeId} />
          
          <div className="space-y-2">
            <Label htmlFor="starterQuestions">默认问题</Label>
            <Textarea 
              className="min-h-[80px] text-xs" 
              id="starterQuestions" 
              onChange={(e) => setForm({ ...form, starterQuestions: e.target.value })} 
              placeholder={"每行一个问题，最多 8 个\n例如：\n你好，你能帮我做什么？\n请介绍一下你的专业能力"} 
              value={form.starterQuestions} 
            />
            <p className="text-[11px] text-muted-foreground">用户进入该 OPC 聊天时显示的默认引导问题，每行一个</p>
          </div>

          {/* 仅管理员可见：分组选择 */}
          {isAdmin && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>所属分组</Label>
                <button 
                  className="inline-flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground" 
                  onClick={onOpenGroupDialog} 
                  type="button"
                >
                  <Settings2 className="size-3" />
                  管理分组
                </button>
              </div>
              <div className="flex items-center gap-2">
                <Select onValueChange={(v) => setForm({ ...form, categoryId: v })} value={form.categoryId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="无分组" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">
                      <span className="text-muted-foreground">无分组</span>
                    </SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        <span className="mr-2 inline-block size-2.5 shrink-0 rounded-full" style={{ backgroundColor: cat.color }} />
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                {form.categoryId && form.categoryId !== "__none__" && (() => {
                  const cat = categories.find((c) => c.id === form.categoryId);
                  return cat ? (
                    <Badge 
                      className="shrink-0 gap-1 px-2 py-0.5 text-[11px]" 
                      style={{ borderColor: cat.color + "40", backgroundColor: cat.color + "10", color: cat.color }} 
                      variant="outline"
                    >
                      <span className="inline-block size-2 rounded-full" style={{ backgroundColor: cat.color }} />
                      {cat.name}
                    </Badge>
                  ) : null;
                })()}
              </div>
            </div>
          )}

          {/* 仅管理员可见：设为默认 OPC */}
          {isAdmin && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-500/15 bg-amber-500/[0.03] px-3 py-2.5">
              <Switch checked={form.isDefault} id="isDefault" onCheckedChange={(v) => setForm({ ...form, isDefault: v })} />
              <Label className="cursor-pointer text-sm" htmlFor="isDefault">设为默认 OPC</Label>
              <span className="ml-auto text-[11px] text-muted-foreground">「开始对话」将使用此 OPC 的配置</span>
            </div>
          )}

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Switch checked={form.isActive} id="active" onCheckedChange={(v) => setForm({ ...form, isActive: v })} />
              <Label className="cursor-pointer" htmlFor="active">启用</Label>
            </div>
            {/* 仅管理员可见：排序 */}
            {isAdmin && (
              <div className="flex items-center gap-2">
                <Label className="shrink-0" htmlFor="order">排序</Label>
                <Input 
                  className="w-20" 
                  id="order" 
                  onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) || 0 })} 
                  type="number" 
                  value={form.sortOrder} 
                />
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} variant="outline">取消</Button>
          <Button disabled={saving} onClick={handleSave}>
            {saving ? "保存中..." : editingAgent ? "保存修改" : "创建"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
