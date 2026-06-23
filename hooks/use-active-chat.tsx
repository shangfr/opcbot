"use client";

import type { UseChatHelpers } from "@ai-sdk/react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { usePathname } from "next/navigation";
import {
  createContext,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import useSWR, { useSWRConfig } from "swr";
import { useDataStream } from "@/components/chat/data-stream-provider";
import { toast } from "@/components/chat/toast";
import type { VisibilityType } from "@/components/chat/visibility-selector";
import { useAgentBinding } from "@/hooks/use-agent-binding";
import { useAutoResume } from "@/hooks/use-auto-resume";
import {
  getChatCache,
  setChatCache,
  updateChatMessages,
} from "@/hooks/use-message-cache";
import { DEFAULT_CHAT_MODEL } from "@/lib/ai/models";
import type { Vote } from "@/lib/db/schema";
import { ChatbotError } from "@/lib/errors";
import type { ChatMessage } from "@/lib/types";
import { fetcher, fetchWithErrorHandlers, generateUUID } from "@/lib/utils";

type ActiveChatContextValue = {
  chatId: string;
  title: string;
  agentName: string | null;
  messages: ChatMessage[];
  status: UseChatHelpers<ChatMessage>["status"];
  input: string;
  visibilityType: VisibilityType;
  isReadonly: boolean;
  isLoading: boolean;
  votes: Vote[] | undefined;
  currentModelId: string;
  thinkingEnabled: boolean;
  agentId: string | null;
};

type ActiveChatActionsContextValue = {
  setTitle: Dispatch<SetStateAction<string>>;
  setMessages: UseChatHelpers<ChatMessage>["setMessages"];
  sendMessage: UseChatHelpers<ChatMessage>["sendMessage"];
  stop: UseChatHelpers<ChatMessage>["stop"];
  regenerate: UseChatHelpers<ChatMessage>["regenerate"];
  addToolApprovalResponse: UseChatHelpers<ChatMessage>["addToolApprovalResponse"];
  setInput: Dispatch<SetStateAction<string>>;
  setCurrentModelId: (id: string) => void;
  setThinkingEnabled: Dispatch<SetStateAction<boolean>>;
};

const ActiveChatContext = createContext<ActiveChatContextValue | null>(null);
const ActiveChatActionsContext =
  createContext<ActiveChatActionsContextValue | null>(null);

function extractChatId(pathname: string): string | null {
  const match = pathname.match(/\/chat\/([^/]+)/);
  return match ? match[1] : null;
}

export function ActiveChatProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { setDataStream } = useDataStream();
  const { mutate } = useSWRConfig();

  const chatIdFromUrl = extractChatId(pathname);
  const isNewChat = !chatIdFromUrl;
  const newChatIdRef = useRef(generateUUID());
  const prevPathnameRef = useRef(pathname);

  if (isNewChat && prevPathnameRef.current !== pathname) {
    newChatIdRef.current = generateUUID();
  }
  prevPathnameRef.current = pathname;

  const chatId = chatIdFromUrl ?? newChatIdRef.current;

  const [currentModelId, setCurrentModelId] = useState(DEFAULT_CHAT_MODEL);
  const currentModelIdRef = useRef(currentModelId);
  useEffect(() => {
    currentModelIdRef.current = currentModelId;
  }, [currentModelId]);

  const [thinkingEnabled, setThinkingEnabled] = useState(false);
  const thinkingEnabledRef = useRef(thinkingEnabled);
  useEffect(() => {
    thinkingEnabledRef.current = thinkingEnabled;
  }, [thinkingEnabled]);

  const isNewChatRef = useRef(isNewChat);
  useEffect(() => {
    isNewChatRef.current = isNewChat;
  }, [isNewChat]);

  const [input, setInput] = useState("");

  // Check if messages for this chatId are already cached in memory.
  // Re-fetch when cache has agentId but no agentName (old cache entries).
  const cachedEntry = isNewChat ? undefined : getChatCache(chatId);
  const hasCachedMessages =
    !!cachedEntry &&
    (!cachedEntry.agentId || cachedEntry.agentName !== undefined);

  // Only fetch from API if chatId is not in memory cache
  const { data: chatData, isLoading } = useSWR(
    isNewChat || hasCachedMessages
      ? null
      : `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/messages?chatId=${chatId}`,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnMount: true,
      onSuccess: (data) => {
        // Cache API response for future navigations
        if (data && chatId) {
          setChatCache(chatId, {
            messages: data.messages ?? [],
            agentId: data.agentId ?? null,
            visibility: data.visibility ?? "private",
            title: data.title,
            agentName: data.agentName,
          });
        }
      },
    }
  );

  // Use cached data if available, otherwise use SWR data
  const effectiveData = hasCachedMessages ? cachedEntry : chatData;

  // Title is stateful so it can be updated in real-time (via data-chat-title stream).
  const [title, setTitle] = useState<string>(
    isNewChat ? "" : ((effectiveData as { title?: string })?.title ?? "")
  );

  // Sync title from effectiveData when navigating to a different chat.
  useEffect(() => {
    if (!isNewChat && effectiveData) {
      const newTitle = (effectiveData as { title?: string })?.title;
      if (newTitle) {
        setTitle(newTitle);
      }
    }
  }, [chatId, isNewChat, effectiveData]);

  // Reset title when navigating to a different chat, before new data loads.
  useEffect(() => {
    if (isNewChat) return;
    const cached = getChatCache(chatId);
    if (cached?.title) {
      setTitle(cached.title);
    } else {
      setTitle("");
    }
  }, [chatId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Agent binding (agentId, agentName, validation, sessionStorage) ──
  const { agentId, agentName, agentIdRef } = useAgentBinding({
    chatId,
    chatIdFromUrl,
    isNewChat,
    effectiveData,
  });

  const initialMessages: ChatMessage[] = isNewChat
    ? []
    : (effectiveData?.messages ?? []);
  const visibility: VisibilityType = isNewChat
    ? "private"
    : (effectiveData?.visibility ?? "private");

  const {
    messages,
    setMessages,
    sendMessage,
    status,
    stop,
    regenerate,
    resumeStream,
    addToolApprovalResponse,
  } = useChat<ChatMessage>({
    id: chatId,
    messages: initialMessages,
    generateId: generateUUID,
    sendAutomaticallyWhen: ({ messages: currentMessages }) => {
      const lastMessage = currentMessages.at(-1);
      return (
        lastMessage?.parts?.some(
          (part) =>
            "state" in part &&
            part.state === "approval-responded" &&
            "approval" in part &&
            (part.approval as { approved?: boolean })?.approved === true
        ) ?? false
      );
    },
    transport: new DefaultChatTransport({
      api: `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/chat`,
      fetch: fetchWithErrorHandlers,
      prepareSendMessagesRequest(request) {
        const lastMessage = request.messages.at(-1);
        const isToolApprovalContinuation =
          lastMessage?.role !== "user" ||
          request.messages.some((msg) =>
            msg.parts?.some((part) => {
              const state = (part as { state?: string }).state;
              return (
                state === "approval-responded" || state === "output-denied"
              );
            })
          );

        // P0: Optimistic history update — add chat to sidebar immediately
        // when user sends first message (not a tool continuation)
        if (!isToolApprovalContinuation && lastMessage?.role === "user") {
          mutate(
            (key: unknown) =>
              typeof key === "string" &&
              key.startsWith("$inf$") &&
              key.includes("/api/history"),
            (
              currentData:
                | Array<{
                    chats: Array<{
                      id: string;
                      createdAt: string;
                      title: string;
                      userId: string;
                      visibility: string;
                    }>;
                    hasMore: boolean;
                  }>
                | undefined
            ) => {
              if (!currentData || currentData.length === 0) {
                return currentData;
              }
              const firstPage = currentData[0];
              if (firstPage.chats.some((c) => c.id === request.id)) {
                return currentData; // Already exists
              }
              const optimisticChat = {
                id: request.id,
                createdAt: new Date().toISOString(),
                title: "New chat",
                userId: "",
                visibility: "private",
              };
              return [
                { ...firstPage, chats: [optimisticChat, ...firstPage.chats] },
                ...currentData.slice(1),
              ];
            },
            { revalidate: false }
          );
        }

        return {
          body: {
            id: request.id,
            ...(isToolApprovalContinuation
              ? { messages: request.messages }
              : { message: lastMessage }),
            selectedChatModel: currentModelIdRef.current,
            selectedVisibilityType: visibility,
            thinkingEnabled: thinkingEnabledRef.current,
            isNewChat: isNewChatRef.current,
            ...(agentIdRef.current ? { agentId: agentIdRef.current } : {}),
            ...request.body,
          },
        };
      },
    }),
    onData: (dataPart) => {
      setDataStream((ds) => (ds ? [...ds, dataPart] : []));
    },
    onFinish: () => {
      // 用 matcher 函数匹配 useSWRInfinite 的缓存键（$inf$ 前缀），
      // 避免 unstable_serialize 在 SWR v2 下对 infinite 模式不生效的问题
      mutate(
        (key: unknown) =>
          typeof key === "string" &&
          key.startsWith("$inf$") &&
          key.includes("/api/history")
      );
    },
    onError: (error) => {
      if (error instanceof ChatbotError) {
        toast({ type: "error", description: error.message });
      } else {
        toast({
          type: "error",
          description: error.message || "出错了，请稍后再试！",
        });
      }
    },
  });

  // Track which chatId the messages were last set for.
  const prevChatIdForMessages = useRef<string | null>(null);
  // Track last synced message count to avoid redundant cache writes
  const prevMessageCountRef = useRef<number>(0);

  // Sync messages FROM effectiveData (API or cache) TO useChat.
  // Only when chatId changes (navigation) or initial load with data.
  useEffect(() => {
    if (isNewChat) {
      prevChatIdForMessages.current = chatId;
      prevMessageCountRef.current = 0;
      setMessages([]);
    } else if (prevChatIdForMessages.current !== chatId) {
      // Navigated to a different chat
      if (effectiveData?.messages && effectiveData.messages.length > 0) {
        prevChatIdForMessages.current = chatId;
        prevMessageCountRef.current = effectiveData.messages.length;
        setMessages(effectiveData.messages);
      } else if (!effectiveData) {
        // Data hasn't loaded yet — clear to avoid showing old chat
        setMessages([]);
      }
    }
  }, [chatId, isNewChat, effectiveData, setMessages]);

  // Sync messages TO cache when messages change (content or count).
  // This is a one-way write (cache ← messages), it does NOT trigger setMessages.
  // P0: Debounced with requestAnimationFrame to avoid excessive writes during streaming.
  const rafRef = useRef<number | null>(null);
  useEffect(() => {
    if (!isNewChat && messages.length > 0) {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
      rafRef.current = requestAnimationFrame(() => {
        updateChatMessages(chatId, messages);
        rafRef.current = null;
      });
    }
  }, [chatId, isNewChat, messages]);

  useEffect(() => {
    if (effectiveData && isNewChat ? false : !!effectiveData) {
      const cookieModel = document.cookie
        .split("; ")
        .find((row) => row.startsWith("chat-model="))
        ?.split("=")[1];
      if (cookieModel) {
        setCurrentModelId(decodeURIComponent(cookieModel));
      }
    }
  }, [effectiveData, isNewChat]);

  const hasAppendedQueryRef = useRef(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const query = params.get("query");
    if (query && !hasAppendedQueryRef.current) {
      hasAppendedQueryRef.current = true;
      window.history.replaceState(
        {},
        "",
        `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/chat/${chatId}`
      );
      sendMessage({
        role: "user" as const,
        parts: [{ type: "text", text: query }],
      });
    }
  }, [sendMessage, chatId]);

  useAutoResume({
    autoResume: isNewChat ? false : !!effectiveData,
    initialMessages,
    resumeStream,
    setMessages,
  });

  const isReadonly = isNewChat ? false : (effectiveData?.isReadonly ?? false);

  const { data: votes } = useSWR<Vote[]>(
    !isReadonly && messages.length >= 2
      ? `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/vote?chatId=${chatId}`
      : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  const stateValue = useMemo<ActiveChatContextValue>(
    () => ({
      chatId,
      title,
      agentName,
      messages,
      status,
      input,
      visibilityType: visibility,
      isReadonly,
      isLoading: !isNewChat && isLoading,
      votes,
      currentModelId,
      thinkingEnabled,
      agentId,
    }),
    [
      chatId,
      title,
      agentName,
      messages,
      status,
      input,
      visibility,
      isReadonly,
      isNewChat,
      isLoading,
      votes,
      currentModelId,
      thinkingEnabled,
      agentId,
    ]
  );

  const actionsValue = useMemo<ActiveChatActionsContextValue>(
    () => ({
      setTitle,
      setMessages,
      sendMessage,
      stop,
      regenerate,
      addToolApprovalResponse,
      setInput,
      setCurrentModelId,
      setThinkingEnabled,
    }),
    [
      setTitle,
      setMessages,
      sendMessage,
      stop,
      regenerate,
      addToolApprovalResponse,
      setInput,
      setCurrentModelId,
      setThinkingEnabled,
    ]
  );

  return (
    <ActiveChatActionsContext.Provider value={actionsValue}>
      <ActiveChatContext.Provider value={stateValue}>
        {children}
      </ActiveChatContext.Provider>
    </ActiveChatActionsContext.Provider>
  );
}

export function useActiveChat() {
  const state = useContext(ActiveChatContext);
  const actions = useContext(ActiveChatActionsContext);
  if (!state || !actions) {
    throw new Error("useActiveChat must be used within ActiveChatProvider");
  }
  return { ...state, ...actions };
}

/**
 * Returns only the stable action references (setMessages, sendMessage, stop, etc.).
 * Use this instead of useActiveChat() when you only need actions, to avoid
 * re-renders triggered by state changes (messages, status, input).
 */
export function useActiveChatActions() {
  const actions = useContext(ActiveChatActionsContext);
  if (!actions) {
    throw new Error(
      "useActiveChatActions must be used within ActiveChatProvider"
    );
  }
  return actions;
}
