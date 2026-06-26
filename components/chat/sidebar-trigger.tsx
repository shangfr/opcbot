"use client";

import { PanelLeftIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";

export function SidebarTrigger() {
  const { state, toggleSidebar, isMobile } = useSidebar();
  const isCollapsed = state === "collapsed" && !isMobile;

  // 移动端始终显示（侧边栏默认隐藏）
  // 桌面端折叠时显示（需要入口来展开侧边栏）
  // 桌面端展开时不显示（侧边栏内部已有收起按钮）
  if (!isMobile && !isCollapsed) {
    return null;
  }

  return (
    <Button
      className="-ml-1"
      onClick={toggleSidebar}
      size="icon-sm"
      variant="ghost"
    >
      <PanelLeftIcon className="size-4" />
    </Button>
  );
}
