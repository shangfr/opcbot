"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Settings2 } from "lucide-react";
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
import type { Ticket, TicketCategory } from "@/lib/db/schema";
import {
  PRIORITY_LABELS,
  STATUS_LABELS,
  type TicketPriority,
  type TicketStatus,
} from "./ticket-shared";

type TicketFormData = {
  title: string;
  description: string;
  content: string;
  priority: TicketPriority;
  status: TicketStatus;
  progress: number;
  assignee: string;
  dueDate: string; // yyyy-mm-dd 格式，便于 input[type=date]
  categoryId: string;
  isActive: boolean;
  sortOrder: number;
  visibility: "public" | "private";
};

const emptyForm: TicketFormData = {
  title: "",
  description: "",
  content: "",
  priority: "medium",
  status: "pending",
  progress: 0,
  assignee: "",
  dueDate: "",
  categoryId: "__none__",
  isActive: true,
  sortOrder: 0,
  visibility: "public",
};

/** 将 Date 转为 yyyy-mm-dd 本地日期字符串 */
function toDateInput(d: Date | string | null): string {
  if (!d) return "";
  const date = new Date(d);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function TicketFormDialog({
  open,
  onOpenChange,
  editingTicket,
  categories,
  onOpenGroupDialog,
  onSuccess,
  isAdmin = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingTicket: Ticket | null;
  categories: TicketCategory[];
  onOpenGroupDialog: () => void;
  onSuccess: () => void;
  isAdmin?: boolean;
}) {
  const [form, setForm] = useState<TicketFormData>(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      if (editingTicket) {
        setForm({
          title: editingTicket.title,
          description: editingTicket.description,
          content: editingTicket.content ?? "",
          priority: editingTicket.priority,
          status: editingTicket.status,
          progress: editingTicket.progress,
          assignee: editingTicket.assignee ?? "",
          dueDate: toDateInput(editingTicket.dueDate),
          categoryId: editingTicket.categoryId ?? "__none__",
          isActive: editingTicket.isActive,
          sortOrder: editingTicket.sortOrder,
          visibility: editingTicket.visibility,
        });
      } else {
        setForm(emptyForm);
      }
    }
  }, [open, editingTicket]);

  const handleSave = async () => {
    if (!form.title.trim() || !form.description.trim()) {
      toast.error("请填写标题和描述");
      return;
    }

    // 将 yyyy-mm-dd 转为 ISO datetime 字符串（UTC 当天 00:00）
    const dueDateIso = form.dueDate
      ? new Date(form.dueDate + "T00:00:00").toISOString()
      : null;

    const payload = {
      ...form,
      content: form.content || null,
      assignee: form.assignee.trim() || null,
      dueDate: dueDateIso,
      categoryId: isAdmin ? (form.categoryId === "__none__" ? null : form.categoryId) : null,
      sortOrder: isAdmin ? form.sortOrder : 0,
      visibility: isAdmin ? form.visibility : "private",
    };

    setSaving(true);
    try {
      if (editingTicket) {
        const res = await fetch(`/api/tickets?id=${editingTicket.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("Failed to update");
        toast.success("信息已更新");
      } else {
        const res = await fetch("/api/tickets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("Failed to create");
        toast.success("发布成功");
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
      <DialogContent className="dialog-mobile-friendly max-h-[90dvh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingTicket ? "编辑信息" : "发布信息"}
          </DialogTitle>
          <DialogDescription>
            {editingTicket
              ? "修改您的服务发布或求购需求详情"
              : "发布一个新的服务或求购需求"}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {/* 标题 */}
          <div className="space-y-2">
            <Label htmlFor="title">标题 *</Label>
            <Input
              id="title"
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="例如：提供企业官网定制开发服务 / 求购二手商用咖啡机"
              value={form.title}
            />
          </div>
          {/* 描述 */}
          <div className="space-y-2">
            <Label htmlFor="desc">描述 *</Label>
            <Textarea
              className="min-h-[60px]"
              id="desc"
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              placeholder="简短描述您能提供的服务或您的求购需求..."
              value={form.description}
            />
          </div>
          {/* 详情 */}
          <div className="space-y-2">
            <Label htmlFor="content">详细说明</Label>
            <Textarea
              className="min-h-[100px] text-xs"
              id="content"
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              placeholder="详细说明服务范围、报价、交付周期或求购具体要求等..."
              value={form.content}
            />
            <p className="text-[11px] text-muted-foreground">
              可选。详细描述服务细节或求购要求，以便更好地匹配
            </p>
          </div>
          {/* 优先级 + 状态 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>优先级</Label>
              <Select
                onValueChange={(v) =>
                  setForm({ ...form, priority: v as TicketPriority })
                }
                value={form.priority}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(
                    ["low", "medium", "high", "urgent"] as TicketPriority[]
                  ).map((p) => (
                    <SelectItem key={p} value={p}>
                      {PRIORITY_LABELS[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>状态</Label>
              <Select
                onValueChange={(v) =>
                  setForm({ ...form, status: v as TicketStatus })
                }
                value={form.status}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(
                    [
                      "pending",
                      "in_progress",
                      "completed",
                      "closed",
                    ] as TicketStatus[]
                  ).map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {/* 进度 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="progress">进度</Label>
              <span className="text-[11px] text-muted-foreground">
                {form.progress}%
              </span>
            </div>
            <input
              className="w-full accent-foreground"
              id="progress"
              max={100}
              min={0}
              onChange={(e) =>
                setForm({ ...form, progress: Number(e.target.value) })
              }
              step={5}
              type="range"
              value={form.progress}
            />
          </div>
          {/* 负责人 + 截止日期 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="assignee">服务方/接单人</Label>
              <Input
                id="assignee"
                onChange={(e) =>
                  setForm({ ...form, assignee: e.target.value })
                }
                placeholder="例如：张三"
                value={form.assignee}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dueDate">截止日期</Label>
              <Input
                id="dueDate"
                onChange={(e) =>
                  setForm({ ...form, dueDate: e.target.value })
                }
                type="date"
                value={form.dueDate}
              />
            </div>
          </div>
          {/* 仅管理员可见：分类选择 */}
          {isAdmin && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>所属分类</Label>
                <button
                  className="inline-flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
                  onClick={onOpenGroupDialog}
                  type="button"
                >
                  <Settings2 className="size-3" />
                  管理分类
                </button>
              </div>
              <div className="flex items-center gap-2">
                <Select
                  onValueChange={(v) =>
                    setForm({ ...form, categoryId: v })
                  }
                  value={form.categoryId}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="无分类" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">
                      <span className="text-muted-foreground">无分类</span>
                    </SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        <span
                          className="mr-2 inline-block size-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: cat.color }}
                        />
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.categoryId && form.categoryId !== "__none__" && (() => {
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
          )}
          {/* 仅管理员可见：可见性设置 */}
          {isAdmin && (
            <div className="flex items-center gap-2 rounded-lg border border-blue-500/15 bg-blue-500/[0.03] px-3 py-2.5">
              <Switch
                checked={form.visibility === "public"}
                id="visibility"
                onCheckedChange={(v) =>
                  setForm({ ...form, visibility: v ? "public" : "private" })
                }
              />
              <Label className="cursor-pointer text-sm" htmlFor="visibility">
                公开到服务市场
              </Label>
              <span className="ml-auto text-[11px] text-muted-foreground">
                {form.visibility === "public" ? "所有用户可见" : "仅创建者可见"}
              </span>
            </div>
          )}
          {/* 启用 + 排序 */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 rounded-lg border border-blue-500/15 bg-blue-500/[0.03] px-3 py-2.5">
              <Switch
                checked={form.isActive}
                id="active"
                onCheckedChange={(v) => setForm({ ...form, isActive: v })}
              />
              <Label className="cursor-pointer" htmlFor="active">
                启用
              </Label>
            </div>
            {isAdmin && (
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
            )}
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} variant="outline">
            取消
          </Button>
          <Button disabled={saving} onClick={handleSave}>
            {saving ? "保存中..." : editingTicket ? "保存修改" : "发布"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
