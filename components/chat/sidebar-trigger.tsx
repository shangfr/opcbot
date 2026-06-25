"use client";

import { PanelLeftIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";

export function SidebarTrigger() {
  const { state, toggleSidebar, isMobile } = useSidebar();
  const isCollapsed = state === "collapsed" && !isMobile;

  // 在桌面端，当侧边栏折叠时不显示按钮
  // 在移动端，始终显示按钮（因为侧边栏默认是隐藏的）
  if (!isMobile && isCollapsed) {
    return null;
  }

  return (
    <Button
      className="md:hidden -ml-1"
      onClick={toggleSidebar}
      size="icon-sm"
      variant="ghost"
    >
      <PanelLeftIcon className="size-4" />
    </Button>
  );
}
