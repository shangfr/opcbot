"use client";

import { usePathname } from "next/navigation";
import { ChatShell } from "./shell";

const EXCLUDED_PATHS = ["/agents", "/"];

export function ChatShellWrapper() {
  const pathname = usePathname();

  // 在 Agent 管理等独立页面上不渲染 ChatShell
  if (EXCLUDED_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return null;
  }

  return <ChatShell />;
}
