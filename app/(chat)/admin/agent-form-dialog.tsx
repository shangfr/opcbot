"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import type { Agent, Category } from "@/lib/db/schema";

type FormData = {
  name: string;
  description: string;
  avatar: string;
  systemPrompt: string;
  categoryId: string;
  isDefault: boolean;
  isActive: boolean;
  sortOrder: number;
};

export function AgentFormDialog({
  open,
  onOpenChange,
  editingAgent,
  categories,
  isAdmin,
  onSuccess
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingAgent: Agent | null;
  categories: Category[];
  isAdmin: boolean;
  onSuccess: () => void;
}) {
  const [saving, setSaving] = useState(false);
  
  const [form, setForm] = useState<FormData>(
    editingAgent ? {
      name: editingAgent.name,
      description: editingAgent.description,
      avatar: editingAgent.avatar,
      systemPrompt: editingAgent.systemPrompt,
      categoryId: editingAgent.categoryId ?? "__none__",
      isDefault: editingAgent.isDefault,
      isActive: editingAgent.isActive,
      sortOrder: editingAgent.sortOrder,
    } : {
      name: "", description: "", avatar: "/icon.png", systemPrompt: "",
      categoryId: "__none__", isDefault: false, isActive: true, sortOrder: 0
    }
  );

  const handleSave = async () => {
    if (!form.name.trim() || !form.description.trim() || !form.systemPrompt.trim()) {
      toast.error("请填写所有必填字段");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        categoryId: form.categoryId === "__none__" ? null : form.categoryId,
        visibility: isAdmin ? "public" : "private", // 普通用户强制 private
        // 普通用户强制覆盖以下字段，防止越权
        isDefault: isAdmin ? form.isDefault : false,
        sortOrder: isAdmin ? form.sortOrder : 0,
      };

      const url = editingAgent ? `/api/agents?id=${editingAgent.id}` : "/api/agents";
      const method = editingAgent ? "PATCH" : "POST";
      
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("保存失败");
      
      toast.success(editingAgent ? "OPC 已更新" : "OPC 已创建");
      onOpenChange(false);
      onSuccess();
    } catch {
      toast.error("保存失败，请重试");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editingAgent ? "编辑 OPC" : "新建 OPC"}</DialogTitle>
          <DialogDescription>
            {editingAgent ? "修改 OPC 角色配置" : "创建一个新的 AI OPC 角色"}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>名称 *</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>

          {/* 头像：允许普通用户修改 */}
          <div className="space-y-2">
            <Label>头像 URL</Label>
            <Input value={form.avatar} onChange={(e) => setForm({ ...form, avatar: e.target.value })} placeholder="/icon.png" />
          </div>

          <div className="space-y-2">
            <Label>描述 *</Label>
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>

          <div className="space-y-2">
            <Label>系统提示词 *</Label>
            <Textarea className="min-h-[120px]" value={form.systemPrompt} onChange={(e) => setForm({ ...form, systemPrompt: e.target.value })} />
          </div>

          {/* 分组选择：所有用户都能选 */}
          <div className="space-y-2">
            <Label>所属分组</Label>
            <Select value={form.categoryId} onValueChange={(v) => setForm({ ...form, categoryId: v })}>
              <SelectTrigger><SelectValue placeholder="无分组" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">无分组</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 管理员专属字段 */}
          {isAdmin && (
            <>
              <div className="flex items-center gap-2 rounded-lg border bg-amber-500/[0.03] px-3 py-2.5">
                <Switch checked={form.isDefault} onCheckedChange={(v) => setForm({ ...form, isDefault: v })} id="isDefault" />
                <Label htmlFor="isDefault">设为默认 OPC</Label>
              </div>

              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} id="active" />
                  <Label htmlFor="active">启用</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Label>排序</Label>
                  <Input className="w-20" type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })} />
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button disabled={saving} onClick={handleSave}>
            {saving ? "保存中..." : "保存"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
