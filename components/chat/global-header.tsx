"use client";

import { usePathname } from "next/navigation";
import { SidebarTrigger } from "./sidebar-trigger";

const EXCLUDED_PATHS = ["/chat"];

// 路由标题映射
const ROUTE_TITLES: { path: string; title: string; exact?: boolean }[] = [
  { path: "/", title: " ", exact: true },
  { path: "/admin/knowledge", title: "管理知识库，上传文档用于对话检索(RAG)" },
  { path: "/admin/stats", title: "查看平台使用情况和各 OPC 的表现数据" },
  { path: "/admin/users", title: "查看用户列表、活跃度统计和访客转化数据" },
  { path: "/my-opc", title: "创建和管理你的专属 OPC" },
  { path: "/my-knowledge", title: "创建和管理你的专属知识库" },
  { path: "/admin", title: "OPC" },
];

function getPageTitle(pathname: string): string {
  // 精确匹配优先
  const exactMatch = ROUTE_TITLES.find(
    (route) => route.exact && pathname === route.path
  );
  if (exactMatch) return exactMatch.title;

  // 前缀匹配：排除 exact 路由（如 "/"），按路径长度降序匹配最具体的
  const prefixMatches = ROUTE_TITLES.filter(
    (route) => !route.exact && pathname.startsWith(route.path)
  );
  // 最长前缀优先
  prefixMatches.sort((a, b) => b.path.length - a.path.length);
  return prefixMatches[0]?.title || "OPC Bot";
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
    <header className="page-header">
      <SidebarTrigger />
      <span className="truncate text-sm font-medium text-foreground/80">
        {pageTitle}
      </span>
    </header>
  );
}
