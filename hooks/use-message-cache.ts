/**
 * Message cache with two tiers:
 *   1. In-memory Map (fast, survives React re-mounts, keeps ALL messages)
 *   2. localStorage (survives page refresh, limited entries + truncated messages)
 *
 * Optimizations:
 *   - Memory tier: unlimited messages per chat (no truncation)
 *   - Storage tier: only last STORAGE_MSG_LIMIT messages per chat to reduce serialization cost
 *   - Throttled writes: localStorage persists at most once per THROTTLE_MS
 */
import type { ChatMessage } from "@/lib/types";

export interface ChatCacheEntry {
  messages: ChatMessage[];
  agentId: string | null;
  visibility: string;
  title?: string;
  agentName?: string | null;
}

const MAX_CACHED = 10;
const STORAGE_KEY = "opc-chat-cache";
const STORAGE_MSG_LIMIT = 5; // Only persist last N messages per chat in localStorage
const THROTTLE_MS = 2000; // Min interval between localStorage writes

// ── In-memory tier ──────────────────────────────────────
const messageCache = new Map<string, ChatCacheEntry>();

// ── Throttle state ──────────────────────────────────────
let lastWriteTs = 0;
let pendingWriteTimer: ReturnType<typeof setTimeout> | null = null;
let pendingData: Record<string, ChatCacheEntry & { _ts?: number }> | null = null;

// Flush pending writes on page unload to avoid data loss
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    if (pendingWriteTimer !== null) {
      clearTimeout(pendingWriteTimer);
      pendingWriteTimer = null;
    }
    if (pendingData) {
      saveToStorage(pendingData);
      pendingData = null;
    }
  });
}

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

/**
 * Throttled wrapper around saveToStorage.
 * If called within THROTTLE_MS of the last write, defers to a timer.
 */
function saveToStorageThrottled(
  data: Record<string, ChatCacheEntry & { _ts?: number }>
): void {
  const now = Date.now();
  const elapsed = now - lastWriteTs;

  // Always track the latest data for beforeunload flush
  pendingData = data;

  if (elapsed >= THROTTLE_MS) {
    lastWriteTs = now;
    pendingData = null;
    saveToStorage(data);
    return;
  }

  // Schedule a deferred write
  if (pendingWriteTimer !== null) {
    clearTimeout(pendingWriteTimer);
  }
  pendingWriteTimer = setTimeout(() => {
    lastWriteTs = Date.now();
    pendingWriteTimer = null;
    pendingData = null;
    saveToStorage(data);
  }, THROTTLE_MS - elapsed);
}

/**
 * Truncate messages for localStorage persistence.
 * Only keeps the last STORAGE_MSG_LIMIT messages to reduce serialization cost.
 */
function truncateForStorage(entry: ChatCacheEntry): ChatCacheEntry {
  if (entry.messages.length <= STORAGE_MSG_LIMIT) {
    return entry;
  }
  return {
    ...entry,
    messages: entry.messages.slice(-STORAGE_MSG_LIMIT),
  };
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
  // Persist to localStorage with timestamp (truncated messages)
  const storage = loadFromStorage();
  storage[chatId] = { ...truncateForStorage(entry), _ts: Date.now() };
  saveToStorageThrottled(storage);
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
    title: existing?.title,
    agentName: existing?.agentName,
  };
  // Memory tier: always write full messages (no truncation)
  messageCache.set(chatId, entry);
  // Storage tier: truncated + throttled
  const storage = loadFromStorage();
  storage[chatId] = { ...truncateForStorage(entry), _ts: Date.now() };
  saveToStorageThrottled(storage);
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
