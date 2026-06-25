"use client";

import { PanelLeftIcon } from "lucide-react";
import { memo } from "react";
import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";
import { getAvatarChar } from "@/lib/agent-groups";
import { VisibilitySelector, type VisibilityType } from "./visibility-selector";

function PureChatHeader({
  chatId,
  agentName,
  selectedVisibilityType,
  isReadonly,
}: {
  chatId: string;
  agentName: string | null;
  selectedVisibilityType: VisibilityType;
  isReadonly: boolean;
}) {
  const { state, toggleSidebar, isMobile } = useSidebar();
  const isCollapsed = state === "collapsed" && !isMobile;

  return (
    <header className="sticky top-0 z-10 flex h-12 items-center gap-3 border-b border-border/40 bg-background/80 px-4 backdrop-blur-sm">
      {!isCollapsed && (
        <Button
          className="md:hidden -ml-1"
          onClick={toggleSidebar}
          size="icon-sm"
          variant="ghost"
        >
          <PanelLeftIcon className="size-4" />
        </Button>
      )}

      {agentName && (
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-semibold text-muted-foreground">
            {getAvatarChar(agentName)}
          </div>
          <span className="truncate text-sm font-medium text-foreground/80">
            {agentName}
          </span>
        </div>
      )}

      <div className="ml-auto flex items-center gap-2">
        {!isReadonly && (
          <VisibilitySelector
            chatId={chatId}
            selectedVisibilityType={selectedVisibilityType}
          />
        )}
      </div>
    </header>
  );
}

export const ChatHeader = memo(PureChatHeader, (prevProps, nextProps) => {
  return (
    prevProps.chatId === nextProps.chatId &&
    prevProps.agentName === nextProps.agentName &&
    prevProps.selectedVisibilityType === nextProps.selectedVisibilityType &&
    prevProps.isReadonly === nextProps.isReadonly
  );
});
