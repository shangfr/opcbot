"use client";

import { usePathname } from "next/navigation";
import { SidebarTrigger } from "./sidebar-trigger";

const EXCLUDED_PATHS = ["/chat"];

// 路由标题映射
const ROUTE_TITLES: { path: string; title: string; exact?: boolean }[] = [
  { path: "/", title: "OPC Bot", exact: true },
  { path: "/agents/knowledge", title: "知识库管理" },
  { path: "/agents/stats", title: "数据看板" },
  { path: "/agents/users", title: "用户管理" },
  { path: "/agents", title: "OPC 管理" },
];

function getPageTitle(pathname: string): string {
  // 精确匹配优先
  const exactMatch = ROUTE_TITLES.find(
    (route) => route.exact && pathname === route.path
  );
  if (exactMatch) return exactMatch.title;

  // 前缀匹配
  const prefixMatch = ROUTE_TITLES.find((route) =>
    pathname.startsWith(route.path)
  );
  return prefixMatch?.title || "OPC Bot";
}

export function GlobalHeader() {
  const pathname = usePathname();

  // 在聊天页面不显示全局 Header（聊天页面有自己的 ChatHeader）
  const shouldShowHeader =
    !EXCLUDED_PATHS.some(
      (p) => pathname === p || pathname.startsWith(`${p}/`)
    );

  if (!shouldShowHeader) {
    return null;
  }

  const pageTitle = getPageTitle(pathname);

  return (
    <header className="sticky top-0 z-10 flex h-12 items-center gap-3 border-b border-border/40 bg-background/80 px-4 backdrop-blur-sm">
      <SidebarTrigger />
      <span className="text-sm font-medium text-foreground/80">{pageTitle}</span>
    </header>
  );
}
