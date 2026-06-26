import equal from "fast-deep-equal";
import { memo } from "react";
import { toast } from "sonner";
import { useSWRConfig } from "swr";
import { useCopyToClipboard } from "usehooks-ts";
import type { Vote } from "@/lib/db/schema";
import type { ChatMessage } from "@/lib/types";
import {
  MessageAction as Action,
  MessageActions as Actions,
} from "../ai-elements/message";
import {
  CopyIcon,
  PencilEditIcon,
  RefreshIcon,
  ThumbDownIcon,
  ThumbUpIcon,
} from "./icons";

export function PureMessageActions({
  chatId,
  message,
  vote,
  isLoading,
  onEdit,
  onRegenerate,
  isLastAssistant,
}: {
  chatId: string;
  message: ChatMessage;
  vote: Vote | undefined;
  isLoading: boolean;
  onEdit?: () => void;
  onRegenerate?: () => void;
  isLastAssistant?: boolean;
}) {
  const { mutate } = useSWRConfig();
  const [_, copyToClipboard] = useCopyToClipboard();

  if (isLoading) {
    return null;
  }

  const textFromParts = message.parts
    ?.filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n")
    .trim();

  const handleCopy = async () => {
    if (!textFromParts) {
      toast.error("没有可复制的文本！");
      return;
    }

    await copyToClipboard(textFromParts);
    toast.success("已复制到剪贴板！");
  };

  if (message.role === "user") {
    return (
      <Actions className="-mr-0.5 justify-end opacity-100 transition-opacity duration-150 md:opacity-0 md:group-hover/message:opacity-100 md:group-focus-within/message:opacity-100 md:group-active/message:opacity-100">
        <div className="flex items-center gap-0.5">
          {onEdit && (
            <Action
              aria-label="编辑消息"
              className="size-8 text-muted-foreground/50 hover:text-foreground"
              data-testid="message-edit-button"
              onClick={onEdit}
              tooltip="编辑"
            >
              <PencilEditIcon />
            </Action>
          )}
          <Action
            aria-label="复制消息"
            className="size-8 text-muted-foreground/50 hover:text-foreground"
            onClick={handleCopy}
            tooltip="复制"
          >
            <CopyIcon />
          </Action>
        </div>
      </Actions>
    );
  }

  return (
    <Actions className="-ml-0.5 opacity-100 transition-opacity duration-150 md:opacity-0 md:group-hover/message:opacity-100 md:group-focus-within/message:opacity-100 md:group-active/message:opacity-100">
      <Action
        aria-label="复制回复"
        className="size-8 text-muted-foreground/50 hover:text-foreground"
        onClick={handleCopy}
        tooltip="复制"
      >
        <CopyIcon />
      </Action>

      {isLastAssistant && onRegenerate && (
        <Action
          aria-label="重新生成回复"
          className="size-8 text-muted-foreground/50 hover:text-foreground"
          data-testid="message-regenerate-button"
          onClick={onRegenerate}
          tooltip="重新生成"
        >
          <RefreshIcon />
        </Action>
      )}

      <Action
        aria-label="点赞"
        className="size-8 text-muted-foreground/50 hover:text-foreground"
        data-testid="message-upvote"
        disabled={vote?.isUpvoted}
        onClick={() => {
          const upvote = fetch(
            `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/vote`,
            {
              method: "PATCH",
              body: JSON.stringify({
                chatId,
                messageId: message.id,
                type: "up",
              }),
            }
          );

          toast.promise(upvote, {
            loading: "正在点赞...",
            success: () => {
              mutate<Vote[]>(
                `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/vote?chatId=${chatId}`,
                (currentVotes) => {
                  if (!currentVotes) {
                    return [];
                  }

                  const votesWithoutCurrent = currentVotes.filter(
                    (currentVote) => currentVote.messageId !== message.id
                  );

                  return [
                    ...votesWithoutCurrent,
                    {
                      chatId,
                      messageId: message.id,
                      isUpvoted: true,
                    },
                  ];
                },
                { revalidate: false }
              );

              return "已点赞！";
            },
            error: "点赞失败。",
          });
        }}
        tooltip="点赞"
      >
        <ThumbUpIcon />
      </Action>

      <Action
        aria-label="取消点赞"
        className="size-8 text-muted-foreground/50 hover:text-foreground"
        data-testid="message-downvote"
        disabled={vote && !vote.isUpvoted}
        onClick={() => {
          const downvote = fetch(
            `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/vote`,
            {
              method: "PATCH",
              body: JSON.stringify({
                chatId,
                messageId: message.id,
                type: "down",
              }),
            }
          );

          toast.promise(downvote, {
            loading: "正在取消点赞...",
            success: () => {
              mutate<Vote[]>(
                `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/vote?chatId=${chatId}`,
                (currentVotes) => {
                  if (!currentVotes) {
                    return [];
                  }

                  const votesWithoutCurrent = currentVotes.filter(
                    (currentVote) => currentVote.messageId !== message.id
                  );

                  return [
                    ...votesWithoutCurrent,
                    {
                      chatId,
                      messageId: message.id,
                      isUpvoted: false,
                    },
                  ];
                },
                { revalidate: false }
              );

              return "已取消点赞！";
            },
            error: "取消点赞失败。",
          });
        }}
        tooltip="取消点赞"
      >
        <ThumbDownIcon />
      </Action>
    </Actions>
  );
}

export const MessageActions = memo(
  PureMessageActions,
  (prevProps, nextProps) => {
    if (!equal(prevProps.vote, nextProps.vote)) {
      return false;
    }
    if (prevProps.isLoading !== nextProps.isLoading) {
      return false;
    }
    if (prevProps.isLastAssistant !== nextProps.isLastAssistant) {
      return false;
    }

    return true;
  }
);
