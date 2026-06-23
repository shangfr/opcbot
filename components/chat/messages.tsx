import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowDownIcon } from "lucide-react";
import { useEffect, useRef } from "react";
import { useActiveChat } from "@/hooks/use-active-chat";
import { useMessages } from "@/hooks/use-messages";
import type { ChatMessage } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useDataStream } from "./data-stream-provider";
import { Greeting } from "./greeting";
import { PreviewMessage, ThinkingMessage } from "./message";

type MessagesProps = {
  isArtifactVisible: boolean;
  onEditMessage?: (message: ChatMessage) => void;
};

function PureMessages({ isArtifactVisible, onEditMessage }: MessagesProps) {
  const {
    chatId,
    messages,
    status,
    votes,
    isReadonly,
    isLoading,
    currentModelId: selectedModelId,
  } = useActiveChat();
  const { addToolApprovalResponse, setMessages, regenerate } = useActiveChat();
  const {
    containerRef: messagesContainerRef,
    endRef: messagesEndRef,
    isAtBottom,
    scrollToBottom,
    hasSentMessage,
    reset,
  } = useMessages({
    status,
  });

  useDataStream();

  // P2: Virtual scrolling for long conversations
  const virtualizer = useVirtualizer({
    count:
      messages.length +
      (status === "submitted" && messages.at(-1)?.role !== "assistant"
        ? 1
        : 0) +
      1, // +1 for thinking, +1 for end spacer
    getScrollElement: () => messagesContainerRef.current,
    estimateSize: () => 120,
    overscan: 5,
    enabled: messages.length > 30, // Only virtualize for long conversations
  });

  const prevChatIdRef = useRef(chatId);
  useEffect(() => {
    if (prevChatIdRef.current !== chatId) {
      prevChatIdRef.current = chatId;
      reset();
    }
  }, [chatId, reset]);

  return (
    <div className="relative flex-1 bg-background">
      {messages.length === 0 && !isLoading && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <Greeting />
        </div>
      )}
      <div
        className={cn(
          "absolute inset-0 touch-pan-y overflow-y-auto",
          messages.length > 0 ? "bg-background" : "bg-transparent"
        )}
        ref={messagesContainerRef}
        style={isArtifactVisible ? { scrollbarWidth: "none" } : undefined}
      >
        <div className="mx-auto flex min-h-full min-w-0 max-w-4xl flex-col gap-5 px-2 py-6 md:gap-7 md:px-4">
          {messages.length > 30 ? (
            <>
              {/* Virtualized rendering for 30+ messages */}
              <div
                style={{
                  height: `${virtualizer.getTotalSize()}px`,
                  width: "100%",
                  position: "relative",
                }}
              >
                {virtualizer.getVirtualItems().map((virtualRow) => {
                  const index = virtualRow.index;
                  if (index < messages.length) {
                    const message = messages[index];
                    return (
                      <div
                        data-index={index}
                        key={message.id}
                        ref={virtualizer.measureElement}
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          width: "100%",
                          transform: `translateY(${virtualRow.start}px)`,
                        }}
                      >
                        <PreviewMessage
                          addToolApprovalResponse={addToolApprovalResponse}
                          chatId={chatId}
                          isLoading={
                            status === "streaming" &&
                            messages.length - 1 === index
                          }
                          isReadonly={isReadonly}
                          message={message}
                          onEdit={onEditMessage}
                          regenerate={regenerate}
                          requiresScrollPadding={
                            hasSentMessage && index === messages.length - 1
                          }
                          selectedModelId={selectedModelId}
                          setMessages={setMessages}
                          vote={
                            votes
                              ? votes.find(
                                  (vote) => vote.messageId === message.id
                                )
                              : undefined
                          }
                        />
                      </div>
                    );
                  }
                  if (
                    index === messages.length &&
                    status === "submitted" &&
                    messages.at(-1)?.role !== "assistant"
                  ) {
                    return (
                      <div
                        data-index={index}
                        key="thinking"
                        ref={virtualizer.measureElement}
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          width: "100%",
                          transform: `translateY(${virtualRow.start}px)`,
                        }}
                      >
                        <ThinkingMessage selectedModelId={selectedModelId} />
                      </div>
                    );
                  }
                  return (
                    <div
                      data-index={index}
                      key="spacer"
                      ref={virtualizer.measureElement}
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                    >
                      <div
                        className="min-h-[24px] min-w-[24px] shrink-0"
                        ref={messagesEndRef}
                      />
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              {/* Normal rendering for ≤ 30 messages */}
              {messages.map((message, index) => (
                <PreviewMessage
                  addToolApprovalResponse={addToolApprovalResponse}
                  chatId={chatId}
                  isLoading={
                    status === "streaming" && messages.length - 1 === index
                  }
                  isReadonly={isReadonly}
                  key={message.id}
                  message={message}
                  onEdit={onEditMessage}
                  regenerate={regenerate}
                  requiresScrollPadding={
                    hasSentMessage && index === messages.length - 1
                  }
                  selectedModelId={selectedModelId}
                  setMessages={setMessages}
                  vote={
                    votes
                      ? votes.find((vote) => vote.messageId === message.id)
                      : undefined
                  }
                />
              ))}

              {status === "submitted" &&
                messages.at(-1)?.role !== "assistant" && (
                  <ThinkingMessage selectedModelId={selectedModelId} />
                )}

              <div
                className="min-h-[24px] min-w-[24px] shrink-0"
                ref={messagesEndRef}
              />
            </>
          )}
        </div>
      </div>

      <button
        aria-label="滚动到底部"
        className={`absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center rounded-full border border-border/50 bg-card/90 px-3.5 shadow-[var(--shadow-float)] backdrop-blur-lg transition-all duration-200 h-7 text-[10px] ${
          isAtBottom
            ? "pointer-events-none scale-90 opacity-0"
            : "pointer-events-auto scale-100 opacity-100"
        }`}
        onClick={() => scrollToBottom("smooth")}
        type="button"
      >
        <ArrowDownIcon className="size-3 text-muted-foreground" />
      </button>
    </div>
  );
}

export const Messages = PureMessages;
