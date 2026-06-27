"use client";

import { formatDistance } from "date-fns";
import { zhCN } from "date-fns/locale";
import {
  ArrowLeft,
  Code2,
  FileText,
  FileType2,
  Image as ImageIcon,
  Loader2,
  Search,
  Sheet,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
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

type ArtifactKind = "text" | "code" | "html" | "image" | "sheet";

type UserDocument = {
  id: string;
  title: string;
  kind: ArtifactKind;
  content: string;
  createdAt: string;
};

const KIND_META: Record<
  ArtifactKind,
  { label: string; icon: typeof FileText; color: string; bg: string }
> = {
  text: {
    label: "文本",
    icon: FileText,
    color: "text-blue-600",
    bg: "bg-blue-50 dark:bg-blue-950/40",
  },
  code: {
    label: "代码",
    icon: Code2,
    color: "text-violet-600",
    bg: "bg-violet-50 dark:bg-violet-950/40",
  },
  html: {
    label: "网页",
    icon: FileType2,
    color: "text-orange-600",
    bg: "bg-orange-50 dark:bg-orange-950/40",
  },
  image: {
    label: "图片",
    icon: ImageIcon,
    color: "text-pink-600",
    bg: "bg-pink-50 dark:bg-pink-950/40",
  },
  sheet: {
    label: "表格",
    icon: Sheet,
    color: "text-emerald-600",
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
  },
};

export default function ArtifactsPage() {
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const { data, isLoading } = useSWR<{ documents: UserDocument[] }>(
    "/api/documents/list",
    fetcher
  );

  const [search, setSearch] = useState("");
  const [previewDoc, setPreviewDoc] = useState<UserDocument | null>(null);
  const [deleting, setDeleting] = useState(false);

  const documents = data?.documents ?? [];

  // 按类型分组
  const grouped = useMemo(() => {
    const map = new Map<ArtifactKind, UserDocument[]>();
    for (const doc of documents) {
      const bucket = map.get(doc.kind) ?? [];
      bucket.push(doc);
      map.set(doc.kind, bucket);
    }
    return map;
  }, [documents]);

  // 搜索过滤
  const filteredDocs = useMemo(() => {
    if (!search.trim()) return documents;
    const q = search.trim().toLowerCase();
    return documents.filter((d) => d.title.toLowerCase().includes(q));
  }, [documents, search]);

  const filteredGrouped = useMemo(() => {
    const map = new Map<ArtifactKind, UserDocument[]>();
    for (const doc of filteredDocs) {
      const bucket = map.get(doc.kind) ?? [];
      bucket.push(doc);
      map.set(doc.kind, bucket);
    }
    return map;
  }, [filteredDocs]);

  const handleDelete = async (doc: UserDocument) => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/documents/list?id=${doc.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete");
      mutate("/api/documents/list");
      setPreviewDoc(null);
      toast.success("已删除制品");
    } catch {
      toast.error("删除失败，请重试");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex h-dvh flex-col bg-background">
      {/* 顶部栏 */}
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border/50 bg-background/80 px-4 backdrop-blur-sm">
        <button
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          onClick={() => router.back()}
          type="button"
        >
          <ArrowLeft className="size-3.5" />
          返回
        </button>
        <div className="flex items-center gap-2">
          <FileText className="size-4 text-muted-foreground" />
          <h1 className="text-sm font-semibold">我的制品</h1>
          <span className="text-xs text-muted-foreground">
            {documents.length} 个
          </span>
        </div>
      </header>

      {/* 内容区 */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : documents.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3">
            <FileText className="size-12 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">还没有制品</p>
            <p className="text-xs text-muted-foreground/60">
              在对话中让 OPC 创建文档、代码、表格等制品，它们会自动保存在这里
            </p>
          </div>
        ) : (
          <div className="mx-auto max-w-4xl">
            {/* 搜索框 */}
            <div className="relative mb-6">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/50" />
              <input
                className="w-full rounded-xl border border-border/50 bg-background py-2.5 pl-10 pr-4 text-sm transition-colors placeholder:text-muted-foreground/40 focus:border-primary/30 focus:outline-none focus:ring-2 focus:ring-primary/10"
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索制品..."
                type="text"
                value={search}
              />
            </div>

            {/* 按类型分组展示 */}
            {(["text", "code", "html", "image", "sheet"] as ArtifactKind[])
              .filter((kind) => (filteredGrouped.get(kind) ?? []).length > 0)
              .map((kind) => {
                const meta = KIND_META[kind];
                const docs = filteredGrouped.get(kind) ?? [];
                const Icon = meta.icon;
                return (
                  <section className="mb-8" key={kind}>
                    <div className="mb-3 flex items-center gap-2">
                      <div
                        className={cn(
                          "flex size-7 items-center justify-center rounded-lg",
                          meta.bg
                        )}
                      >
                        <Icon className={cn("size-3.5", meta.color)} />
                      </div>
                      <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                        {meta.label}
                      </h2>
                      <span className="text-[10px] text-muted-foreground/50">
                        {docs.length} 个
                      </span>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {docs.map((doc) => {
                        const DocIcon = KIND_META[doc.kind].icon;
                        return (
                          <button
                            className="group relative overflow-hidden rounded-xl border border-border/50 bg-card p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-border hover:shadow-md"
                            key={`${doc.id}-${doc.createdAt}`}
                            onClick={() => setPreviewDoc(doc)}
                            type="button"
                          >
                            <div className="mb-2 flex items-start justify-between gap-2">
                              <div
                                className={cn(
                                  "flex size-8 shrink-0 items-center justify-center rounded-lg",
                                  KIND_META[doc.kind].bg
                                )}
                              >
                                <DocIcon
                                  className={cn(
                                    "size-4",
                                    KIND_META[doc.kind].color
                                  )}
                                />
                              </div>
                              <span className="text-[10px] text-muted-foreground/50">
                                {formatDistance(
                                  new Date(doc.createdAt),
                                  new Date(),
                                  { addSuffix: true, locale: zhCN }
                                )}
                              </span>
                            </div>
                            <h3 className="line-clamp-2 text-sm font-medium text-foreground">
                              {doc.title || "无标题"}
                            </h3>
                            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                              {doc.content?.slice(0, 100) || "无内容"}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                );
              })}

            {filteredDocs.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16">
                <Search className="mb-3 size-8 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">未找到匹配的制品</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 预览弹窗 */}
      <Dialog
        onOpenChange={(open) => !open && setPreviewDoc(null)}
        open={!!previewDoc}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {previewDoc && (() => {
                const Icon = KIND_META[previewDoc.kind].icon;
                return (
                  <div
                    className={cn(
                      "flex size-6 items-center justify-center rounded-md",
                      KIND_META[previewDoc.kind].bg
                    )}
                  >
                    <Icon
                      className={cn(
                        "size-3.5",
                        KIND_META[previewDoc.kind].color
                      )}
                    />
                  </div>
                );
              })()}
              {previewDoc?.title || "无标题"}
            </DialogTitle>
            <DialogDescription>
              {previewDoc &&
                `${KIND_META[previewDoc.kind].label} · ${formatDistance(
                  new Date(previewDoc.createdAt),
                  new Date(),
                  { addSuffix: true, locale: zhCN }
                )}`}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[50vh] overflow-y-auto rounded-lg border border-border/50 bg-muted/30 p-4">
            <pre className="whitespace-pre-wrap break-words text-xs leading-relaxed text-foreground/80">
              {previewDoc?.content || "无内容"}
            </pre>
          </div>
          <DialogFooter className="gap-2">
            <button
              className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-1.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
              disabled={deleting}
              onClick={() => previewDoc && handleDelete(previewDoc)}
              type="button"
            >
              {deleting ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Trash2 className="size-3.5" />
              )}
              删除
            </button>
            <button
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
              onClick={() => setPreviewDoc(null)}
              type="button"
            >
              关闭
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
