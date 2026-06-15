"use client";

import { useEffect, useState } from "react";
import { SWRConfig } from "swr";
import { ActiveChatProvider } from "@/hooks/use-active-chat";

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);

  // P2: Offline detection
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    setIsOnline(navigator.onLine);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return (
    <SWRConfig
      value={{
        errorRetryCount: 3,
        errorRetryInterval: 3000,
        shouldRetryOnError: true,
      }}
    >
      <ActiveChatProvider>
        {!isOnline && (
          <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 py-1 text-center text-[11px] font-medium text-white">
            网络连接已断开，部分功能可能不可用
          </div>
        )}
        {children}
      </ActiveChatProvider>
    </SWRConfig>
  );
}
