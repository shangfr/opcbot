"use client";

import {
  BarChart3,
  BookOpen,
  Bot,
  ClipboardList,
  FileText,
  MessagesSquareIcon,
  PanelLeftIcon,
  PenSquareIcon,
  Pin,
  TrashIcon,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { User } from "next-auth";
import { useState } from "react";
import { toast } from "sonner";
import { useSWRConfig } from "swr";
import { unstable_serialize } from "swr/infinite";
import {
  getChatHistoryPaginationKey,
  SidebarHistory,
} from "@/components/chat/sidebar-history";
import { SidebarUserNav } from "@/components/chat/sidebar-user-nav";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { useActiveChat } from "@/hooks/use-active-chat";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";

export function AppSidebar({
  user,
  isAdmin,
}: {
  user: User | undefined;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const { agentId, messages } = useActiveChat();
  const isEmptyChat = messages.length === 0;
  const { setOpenMobile, toggleSidebar } = useSidebar();
  const { mutate } = useSWRConfig();
  const [showDeleteAllDialog, setShowDeleteAllDialog] = useState(false);

  const handleDeleteAll = () => {
    setShowDeleteAllDialog(false);
    router.replace("/");
    mutate(unstable_serialize(getChatHistoryPaginationKey), [], {
      revalidate: false,
    });

    fetch(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/history`, {
      method: "DELETE",
    });

    toast.success("全部对话已删除");
  };

  return (
    <>
      <Sidebar
        className="border-r border-sidebar-border shadow-[var(--shadow-sidebar)]"
        collapsible="icon"
      >
        {/* ===== Logo / Brand 区域 ===== */}
        <SidebarHeader className="border-sidebar-border px-3 pb-3 pt-4">
          <SidebarMenu>
            <SidebarMenuItem className="flex items-center justify-between">
              <div className="group/logo relative flex items-center gap-2.5">
                {/* 折叠时的 Logo 图标 */}
                <SidebarMenuButton
                  asChild
                  className="size-8 shrink-0 items-center justify-center rounded-lg !p-0 group-data-[collapsible=icon]:group-hover/logo:opacity-0 transition-opacity duration-150"
                  tooltip="OPC Bot"
                >
                  <Link href="/" onClick={() => setOpenMobile(false)}>
                    <img
                      alt="OPC Bot"
                      className="size-8 rounded-lg object-cover"
                      src="/logo.jpg"
                    />
                  </Link>
                </SidebarMenuButton>
                {/* 展开时的品牌名称 */}
                <div className="flex items-center gap-1.5 group-data-[collapsible=icon]:hidden">
                  <span className="text-sm font-semibold tracking-tight text-sidebar-foreground">
                    OPC Bot
                  </span>
                </div>
                {/* 折叠时悬停出现的展开按钮 */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <SidebarMenuButton
                      className="pointer-events-none absolute inset-0 size-8 opacity-0 group-data-[collapsible=icon]:pointer-events-auto group-data-[collapsible=icon]:group-hover/logo:opacity-100"
                      onClick={() => toggleSidebar()}
                    >
                      <PanelLeftIcon className="size-4" />
                    </SidebarMenuButton>
                  </TooltipTrigger>
                  <TooltipContent className="hidden md:block" side="right">
                    展开侧边栏
                  </TooltipContent>
                </Tooltip>
              </div>
              {/* 收起按钮 */}
              <div className="group-data-[collapsible=icon]:hidden">
                <SidebarTrigger className="text-sidebar-foreground/50 transition-colors duration-150 hover:text-sidebar-foreground" />
              </div>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent>
          {/* ===== 操作区 ===== */}
          <SidebarGroup className="px-2 pt-3">
            <SidebarGroupLabel className="mb-1 px-2 text-[10px] font-medium uppercase tracking-wider text-sidebar-foreground/40">
              操作
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {/* 新建对话 */}
                <SidebarMenuItem>
                  <SidebarMenuButton
                    className="h-9 w-full gap-2.5 rounded-lg border border-sidebar-border bg-sidebar-accent/40 text-[13px] font-medium text-sidebar-foreground transition-all duration-150 hover:bg-sidebar-primary/15 hover:text-sidebar-primary hover:border-sidebar-primary/30 disabled:opacity-40 disabled:pointer-events-none"
                    disabled={isEmptyChat}
                    onClick={async () => {
                      setOpenMobile(false);
                      try {
                        const res = await fetch("/api/chat/create", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            agentId: agentId ?? undefined,
                          }),
                        });
                        if (!res.ok) {
                          throw new Error("Failed to create chat");
                        }
                        const { chatId } = await res.json();
                        // Store agentId temporarily for page initialization
                        if (agentId) {
                          sessionStorage.setItem(
                            `pending-chat-${chatId}`,
                            agentId
                          );
                        }
                        router.push(`/chat/${chatId}`);
                      } catch {
                        toast.error("创建对话失败，请重试");
                      }
                    }}
                    tooltip="新建对话"
                  >
                    <PenSquareIcon className="size-3.5" />
                    <span>新建对话</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>

                {/* 智库 */}
                {user && (
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      className="h-8 gap-2.5 rounded-lg text-[13px] text-sidebar-foreground/65 transition-all duration-150 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                      tooltip="智库"
                    >
                      <Link href="/admin" onClick={() => setOpenMobile(false)} title="OPC智库咨询台">
                        <Bot className="size-3.5" />
                        <span>智库</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}

                {/* 智客 */}
                {user && (
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      className="h-8 gap-2.5 rounded-lg text-[13px] text-sidebar-foreground/65 transition-all duration-150 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                      tooltip="智客"
                    >
                      <Link href="/admin/tickets" onClick={() => setOpenMobile(false)} title="AI获客与资源整合引擎">
                        <ClipboardList className="size-3.5" />
                        <span>智客</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}

                {/* 智汇 */}
                {user && (
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      className="h-8 gap-2.5 rounded-lg text-[13px] text-sidebar-foreground/65 transition-all duration-150 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                      tooltip="智汇"
                    >
                      <Link href="/pinned" onClick={() => setOpenMobile(false)} title="重要信息汇聚中枢">
                        <Pin className="size-3.5" />
                        <span>智汇</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}

                {/* 智品 */}
                {user && (
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      className="h-8 gap-2.5 rounded-lg text-[13px] text-sidebar-foreground/65 transition-all duration-150 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                      tooltip="智品"
                    >
                      <Link href="/artifacts" onClick={() => setOpenMobile(false)} title="AI生成的交付物">
                        <FileText className="size-3.5" />
                        <span>智品</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}

                {/* 知识库 */}
                {user && (
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      className="h-8 gap-2.5 rounded-lg text-[13px] text-sidebar-foreground/65 transition-all duration-150 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                      tooltip="知识库"
                    >
                      <Link href="/admin/knowledge" onClick={() => setOpenMobile(false)}>
                        <BookOpen className="size-3.5" />
                        <span>知识库</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}

                {/* 数据看板 */}
                {user && isAdmin && (
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      className="h-8 gap-2.5 rounded-lg text-[13px] text-sidebar-foreground/65 transition-all duration-150 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                      tooltip="数据看板"
                    >
                      <Link href="/admin/stats" onClick={() => setOpenMobile(false)}>
                        <BarChart3 className="size-3.5" />
                        <span>数据看板</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}

                {/* 用户管理 */}
                {user && isAdmin && (
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      className="h-8 gap-2.5 rounded-lg text-[13px] text-sidebar-foreground/65 transition-all duration-150 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                      tooltip="用户管理"
                    >
                      <Link href="/admin/users" onClick={() => setOpenMobile(false)}>
                        <Users className="size-3.5" />
                        <span>用户管理</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {/* ===== 历史对话区 ===== */}
          <SidebarGroup className="px-2 pt-1">
            <SidebarGroupLabel className="mb-1 px-2 text-[10px] font-medium uppercase tracking-wider text-sidebar-foreground/40">
              <MessagesSquareIcon className="mr-1.5 size-3" />
              历史对话
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarHistory user={user} />
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        {/* ===== 底部 ===== */}
        <SidebarFooter className="border-t border-sidebar-border px-2 pb-2 pt-2">
          <SidebarMenu>
            {user && (
              <SidebarMenuItem>
                <SidebarMenuButton
                  className="h-8 gap-2.5 rounded-lg text-[12px] text-sidebar-foreground/35 transition-all duration-150 hover:bg-destructive/12 hover:text-destructive/80"
                  onClick={() => setShowDeleteAllDialog(true)}
                  tooltip="清空全部对话"
                >
                  <TrashIcon className="size-3" />
                  <span>清空全部对话</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )}
          </SidebarMenu>
          {user && <SidebarUserNav user={user} />}
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      <AlertDialog
        onOpenChange={setShowDeleteAllDialog}
        open={showDeleteAllDialog}
      >
        <AlertDialogContent className="dialog-mobile-friendly max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>清空全部对话？</AlertDialogTitle>
            <AlertDialogDescription>
              此操作无法撤销，将永久删除所有对话记录。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAll}>
              确认清空
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
