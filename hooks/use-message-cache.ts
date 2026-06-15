/**
 * Message cache with two tiers:
 *   1. In-memory Map (fast, survives React re-mounts)
 *   2. localStorage (survives page refresh, limited to MAX_CACHED chats)
 */
import type { ChatMessage } from "@/lib/types";

export interface ChatCacheEntry {
  messages: ChatMessage[];
  agentId: string | null;
  visibility: string;
  title?: string;
  agentName?: string | null;
}

const MAX_CACHED = 20;
const STORAGE_KEY = "opc-chat-cache";

// ── In-memory tier ──────────────────────────────────────
const messageCache = new Map<string, ChatCacheEntry>();

// ── localStorage helpers ────────────────────────────────
function loadFromStorage(): Record<string, ChatCacheEntry & { _ts?: number }> {
  if (typeof window === "undefined") {
    return {};
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw) as Record<
        string,
        ChatCacheEntry & { _ts?: number }
      >;
    }
  } catch {
    /* corrupted data — reset */
  }
  return {};
}

function saveToStorage(
  data: Record<string, ChatCacheEntry & { _ts?: number }>
): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    // Keep only the most recent entries
    const entries = Object.entries(data).sort(
      (a, b) => (b[1]._ts ?? 0) - (a[1]._ts ?? 0)
    );
    const trimmed = Object.fromEntries(entries.slice(0, MAX_CACHED));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    /* quota exceeded — silently ignore */
  }
}

// ── Public API ──────────────────────────────────────────
export function getChatCache(chatId: string): ChatCacheEntry | undefined {
  // Check memory first
  const memEntry = messageCache.get(chatId);
  if (memEntry) {
    return memEntry;
  }
  // Fallback to localStorage
  const storage = loadFromStorage();
  const storedEntry = storage[chatId];
  if (storedEntry) {
    // Promote to memory (strip _ts)
    const { _ts, ...entry } = storedEntry;
    messageCache.set(chatId, entry);
    return entry;
  }
  return undefined;
}

export function setChatCache(chatId: string, entry: ChatCacheEntry): void {
  messageCache.set(chatId, entry);
  // Persist to localStorage with timestamp
  const storage = loadFromStorage();
  storage[chatId] = { ...entry, _ts: Date.now() };
  saveToStorage(storage);
}

export function updateChatMessages(
  chatId: string,
  messages: ChatMessage[]
): void {
  const existing = messageCache.get(chatId);
  const entry: ChatCacheEntry = {
    messages,
    agentId: existing?.agentId ?? null,
    visibility: existing?.visibility ?? "private",
  };
  messageCache.set(chatId, entry);
  // Persist to localStorage
  const storage = loadFromStorage();
  storage[chatId] = { ...entry, _ts: Date.now() };
  saveToStorage(storage);
}

export function hasChatCache(chatId: string): boolean {
  if (messageCache.has(chatId)) {
    return true;
  }
  const storage = loadFromStorage();
  return chatId in storage;
}

export function clearChatCache(chatId?: string): void {
  if (chatId) {
    messageCache.delete(chatId);
  } else {
    messageCache.clear();
  }
  // Also clear from localStorage
  if (typeof window !== "undefined") {
    if (chatId) {
      const storage = loadFromStorage();
      delete storage[chatId];
      saveToStorage(storage);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }
}
