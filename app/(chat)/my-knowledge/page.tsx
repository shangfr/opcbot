"use client";

import {
  ArrowLeft,
  BookOpen,
  FileText,
  Loader2,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import useSWR, { useSWRConfig } from "swr";
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

type KnowledgeBase = {
  id: string;
  knowledgeId: string;
  name: string;
  description: string | null;
  documentCount?: number;
  createdAt: string;
};

type DocItem = {
  id: string;
  name: string;
  length: number;
  wordNum: number;
};

export default function MyKnowledgePage() {
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const { data: knowledgeBases = [], isLoading } = useSWR<KnowledgeBase[]>(
    "/api/knowledge",
    fetcher
  );

  const [showCreate, setShowCreate] = useState(false);
  const [selectedKb, setSelectedKb] = useState<KnowledgeBase | null>(null);
  const [deleteKb, setDeleteKb] = useState<KnowledgeBase | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState({ name: "", description: "" });

  // 文档管理
  const { data: docsData, isLoading: docsLoading } = useSWR<{ list: DocItem[] }>(
    selectedKb ? `/api/knowledge/documents?knowledgeId=${selectedKb.knowledgeId}` : null,
    fetcher
  );
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCreate = async () => {
    if (!form.name.trim()) {
      toast.error("请输入知识库名称");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || err.error || "创建失败");
      }
      toast.success("知识库创建成功");
      setShowCreate(false);
      setForm({ name: "", description: "" });
      mutate("/api/knowledge");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "创建失败");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteKb) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/knowledge?id=${deleteKb.knowledgeId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || err.error || "删除失败");
      }
      toast.success("知识库已删除");
      setDeleteKb(null);
      if (selectedKb?.knowledgeId === deleteKb.knowledgeId) {
        setSelectedKb(null);
      }
      mutate("/api/knowledge");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "删除失败");
    } finally {
      setDeleting(false);
    }
  };

  const handleUpload = async (files: FileList) => {
    if (!selectedKb || files.length === 0) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("knowledgeId", selectedKb.knowledgeId);
      for (const file of Array.from(files)) {
        formData.append("files", file);
      }
      const res = await fetch("/api/knowledge/documents", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || err.error || "上传失败");
      }
      const result = await res.json();
      const successCount = result.successInfos?.length ?? 0;
      const failCount = result.failedInfos?.length ?? 0;
      if (successCount > 0) {
        toast.success(`成功上传 ${successCount} 个文件`);
      }
      if (failCount > 0) {
        toast.error(`${failCount} 个文件上传失败`);
      }
      // 刷新文档列表
      mutate(`/api/knowledge/documents?knowledgeId=${selectedKb.knowledgeId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "上传失败");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDeleteDoc = async (docId: string) => {
    if (!selectedKb) return;
    try {
      const res = await fetch(
        `/api/knowledge/documents?id=${docId}&knowledgeId=${selectedKb.knowledgeId}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || err.error || "删除失败");
      }
      toast.success("文档已删除");
      mutate(`/api/knowledge/documents?knowledgeId=${selectedKb.knowledgeId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "删除失败");
    }
  };

  return (
    <div className="flex h-dvh flex-col bg-background">
      {/* 顶部栏 */}
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
          <BookOpen className="size-4 shrink-0 text-muted-foreground" />
          <h1 className="truncate text-sm font-semibold">我的知识库</h1>
          <span className="shrink-0 text-xs text-muted-foreground">
            {knowledgeBases.length} 个
          </span>
        </div>
        <button
          className="touch-target ml-auto inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          onClick={() => setShowCreate(true)}
          type="button"
        >
          <Plus className="size-3.5" />
          <span className="hidden sm:inline">新建知识库</span>
          <span className="sm:hidden">新建</span>
        </button>
      </header>

      {/* 内容区 */}
      <div className="flex-1 overflow-y-auto page-container">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : knowledgeBases.length === 0 ? (
          <div className="empty-state h-full">
            <BookOpen className="mb-3 size-12 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">还没有知识库</p>
            <p className="mt-1 px-6 text-xs text-muted-foreground/60">
              创建知识库后，可以上传文档用于 OPC 对话检索（RAG）
            </p>
            <button
              className="touch-target mt-4 inline-flex items-center gap-1.5 rounded-lg border border-border/50 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              onClick={() => setShowCreate(true)}
              type="button"
            >
              <Plus className="size-3.5" />
              创建第一个知识库
            </button>
          </div>
        ) : (
          <div className="mx-auto max-w-4xl">
            {/* 知识库列表 */}
            {!selectedKb && (
              <div className="card-grid">
                {knowledgeBases.map((kb) => (
                  <button
                    className="group relative overflow-hidden rounded-xl border border-border/50 bg-card p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-border hover:shadow-md"
                    key={kb.id}
                    onClick={() => setSelectedKb(kb)}
                    type="button"
                  >
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950/40">
                        <BookOpen className="size-4 text-blue-600" />
                      </div>
                      <button
                        aria-label="删除知识库"
                        className="touch-target shrink-0 rounded-lg p-1 text-muted-foreground/40 transition-colors hover:bg-destructive/10 hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteKb(kb);
                        }}
                        type="button"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                    <h3 className="line-clamp-1 text-sm font-medium text-foreground">
                      {kb.name}
                    </h3>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {kb.description || "暂无描述"}
                    </p>
                  </button>
                ))}
              </div>
            )}

            {/* 文档管理 */}
            {selectedKb && (
              <div>
                <div className="mb-4 flex items-center gap-2">
                  <button
                    className="back-button"
                    onClick={() => setSelectedKb(null)}
                    type="button"
                  >
                    <ArrowLeft className="size-3.5" />
                    返回列表
                  </button>
                  <h2 className="truncate text-sm font-semibold">
                    {selectedKb.name}
                  </h2>
                </div>

                {/* 上传区 */}
                <div className="mb-4 flex items-center gap-2">
                  <input
                    accept=".txt,.md,.pdf,.docx,.doc,.csv,.xlsx,.pptx,.html,.json"
                    className="hidden"
                    multiple
                    onChange={(e) => {
                      if (e.target.files) handleUpload(e.target.files);
                    }}
                    ref={fileInputRef}
                    type="file"
                  />
                  <button
                    className="touch-target inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                    disabled={uploading}
                    onClick={() => fileInputRef.current?.click()}
                    type="button"
                  >
                    {uploading ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Upload className="size-3.5" />
                    )}
                    上传文档
                  </button>
                  <span className="text-xs text-muted-foreground">
                    支持 txt/md/pdf/docx/csv 等格式
                  </span>
                </div>

                {/* 文档列表 */}
                {docsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="size-5 animate-spin text-muted-foreground" />
                  </div>
                ) : (docsData?.list ?? []).length === 0 ? (
                  <div className="empty-state py-12">
                    <FileText className="mb-3 size-8 text-muted-foreground/30" />
                    <p className="text-sm text-muted-foreground">
                      知识库中还没有文档
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground/60">
                      上传文档后，OPC 可以基于这些文档回答问题
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {(docsData?.list ?? []).map((doc) => (
                      <div
                        className="flex items-center gap-3 rounded-xl border border-border/50 bg-card p-3"
                        key={doc.id}
                      >
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                          <FileText className="size-4 text-muted-foreground" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">
                            {doc.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {doc.wordNum ?? 0} 字 · {doc.length ?? 0} 段
                          </p>
                        </div>
                        <button
                          aria-label="删除文档"
                          className="touch-target shrink-0 rounded-lg p-1.5 text-muted-foreground/50 transition-colors hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => handleDeleteDoc(doc.id)}
                          type="button"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 创建知识库弹窗 */}
      <Dialog onOpenChange={setShowCreate} open={showCreate}>
        <DialogContent className="dialog-mobile-friendly max-w-md">
          <DialogHeader>
            <DialogTitle>新建知识库</DialogTitle>
            <DialogDescription>
              创建知识库后可上传文档，OPC 对话时将基于文档内容进行检索（RAG）
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex flex-col gap-2">
              <Label className="text-muted-foreground" htmlFor="kb-name">
                名称
              </Label>
              <Input
                id="kb-name"
                maxLength={64}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="例如：产品文档库"
                value={form.name}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label className="text-muted-foreground" htmlFor="kb-desc">
                描述（可选）
              </Label>
              <Textarea
                id="kb-desc"
                maxLength={256}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                placeholder="知识库的用途说明"
                rows={3}
                value={form.description}
              />
            </div>
          </div>
          <DialogFooter>
            <button
              className="touch-target rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
              onClick={() => setShowCreate(false)}
              type="button"
            >
              取消
            </button>
            <button
              className="touch-target inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              disabled={creating || !form.name.trim()}
              onClick={handleCreate}
              type="button"
            >
              {creating && <Loader2 className="size-3.5 animate-spin" />}
              创建
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认 */}
      <Dialog onOpenChange={(o) => !o && setDeleteKb(null)} open={!!deleteKb}>
        <DialogContent className="dialog-mobile-friendly max-w-sm">
          <DialogHeader>
            <DialogTitle>删除知识库？</DialogTitle>
            <DialogDescription>
              确定要删除「{deleteKb?.name}」吗？知识库中的所有文档将被永久删除，此操作无法撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <button
              className="touch-target rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
              onClick={() => setDeleteKb(null)}
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
