/**
 * In-memory message cache.
 * Survives React re-mounts and SPA navigation for instant chat switching.
 * Cleared on hard refresh — SWR re-fetches from API in that case.
 */
import type { ChatMessage } from "@/lib/types";

export interface ChatCacheEntry {
  messages: ChatMessage[];
  agentId: string | null;
  visibility: string;
  title?: string;
  agentName?: string | null;
}

const messageCache = new Map<string, ChatCacheEntry>();

export function getChatCache(chatId: string): ChatCacheEntry | undefined {
  return messageCache.get(chatId);
}

export function setChatCache(chatId: string, entry: ChatCacheEntry): void {
  messageCache.set(chatId, entry);
}

export function updateChatMessages(
  chatId: string,
  messages: ChatMessage[]
): void {
  const existing = messageCache.get(chatId);
  messageCache.set(chatId, {
    messages,
    agentId: existing?.agentId ?? null,
    visibility: existing?.visibility ?? "private",
    title: existing?.title,
    agentName: existing?.agentName,
  });
}

export function hasChatCache(chatId: string): boolean {
  return messageCache.has(chatId);
}

export function clearChatCache(chatId?: string): void {
  if (chatId) {
    messageCache.delete(chatId);
  } else {
    messageCache.clear();
  }
}
