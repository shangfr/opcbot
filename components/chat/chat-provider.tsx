"use client";

import { ActiveChatProvider } from "@/hooks/use-active-chat";

export function ChatProvider({ children }: { children: React.ReactNode }) {
  return <ActiveChatProvider>{children}</ActiveChatProvider>;
}
