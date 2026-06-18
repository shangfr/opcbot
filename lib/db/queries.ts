import "server-only";

import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  gte,
  inArray,
  isNull,
  lt,
  type SQL,
  sql,
} from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import type { ArtifactKind } from "@/components/chat/artifact";
import type { VisibilityType } from "@/components/chat/visibility-selector";
import { ChatbotError } from "../errors";
import { generateUUID } from "../utils";
import {
  agent,
  type Chat,
  category,
  chat,
  type DBMessage,
  document,
  message,
  passwordResetToken,
  siteConfig,
  type Suggestion,
  stream,
  suggestion,
  type User,
  user,
  vote,
} from "./schema";
import { generateHashedPassword } from "./utils";

const client = postgres(process.env.POSTGRES_URL ?? "");
const db = drizzle(client);

export async function getUser(email: string): Promise<User[]> {
  try {
    return await db.select().from(user).where(eq(user.email, email));
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get user by email"
    );
  }
}

export async function createUser(email: string, password: string) {
  const hashedPassword = generateHashedPassword(password);

  try {
    return await db.insert(user).values({ email, password: hashedPassword });
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to create user");
  }
}

export async function createGuestUser() {
  const email = `guest-${Date.now()}`;
  const password = generateHashedPassword(generateUUID());

  try {
    return await db.insert(user).values({ email, password }).returning({
      id: user.id,
      email: user.email,
    });
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to create guest user"
    );
  }
}

export async function saveChat({
  id,
  userId,
  title,
  visibility,
  agentId,
  agentName,
}: {
  id: string;
  userId: string;
  title: string;
  visibility: VisibilityType;
  agentId?: string | null;
  agentName?: string | null;
}) {
  try {
    return await db.insert(chat).values({
      id,
      createdAt: new Date(),
      userId,
      title,
      visibility,
      agentId: agentId ?? null,
      agentName: agentName ?? null,
    });
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to save chat");
  }
}

export async function deleteChatById({ id }: { id: string }) {
  try {
    return await db.transaction(async (tx) => {
      await tx.delete(vote).where(eq(vote.chatId, id));
      await tx.delete(message).where(eq(message.chatId, id));
      await tx.delete(stream).where(eq(stream.chatId, id));

      const [chatsDeleted] = await tx
        .delete(chat)
        .where(eq(chat.id, id))
        .returning();
      return chatsDeleted;
    });
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to delete chat by id"
    );
  }
}

export async function deleteAllChatsByUserId({ userId }: { userId: string }) {
  try {
    return await db.transaction(async (tx) => {
      const userChats = await tx
        .select({ id: chat.id })
        .from(chat)
        .where(eq(chat.userId, userId));

      if (userChats.length === 0) {
        return { deletedCount: 0 };
      }

      const chatIds = userChats.map((c) => c.id);

      await tx.delete(vote).where(inArray(vote.chatId, chatIds));
      await tx.delete(message).where(inArray(message.chatId, chatIds));
      await tx.delete(stream).where(inArray(stream.chatId, chatIds));

      const deletedChats = await tx
        .delete(chat)
        .where(eq(chat.userId, userId))
        .returning();

      return { deletedCount: deletedChats.length };
    });
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to delete all chats by user id"
    );
  }
}

export async function getChatsByUserId({
  id,
  limit,
  startingAfter,
  endingBefore,
}: {
  id: string;
  limit: number;
  startingAfter: string | null;
  endingBefore: string | null;
}) {
  try {
    const extendedLimit = limit + 1;

    const baseQuery = (whereCondition?: SQL<unknown>) =>
      db
        .select()
        .from(chat)
        .where(
          whereCondition
            ? and(whereCondition, eq(chat.userId, id))
            : eq(chat.userId, id)
        )
        .orderBy(desc(chat.createdAt))
        .limit(extendedLimit);

    let filteredChats: Chat[] = [];

    if (startingAfter) {
      const [selectedChat] = await db
        .select()
        .from(chat)
        .where(eq(chat.id, startingAfter))
        .limit(1);

      if (!selectedChat) {
        throw new ChatbotError(
          "not_found:database",
          `Chat with id ${startingAfter} not found`
        );
      }

      filteredChats = await baseQuery(gt(chat.createdAt, selectedChat.createdAt));
    } else if (endingBefore) {
      const [selectedChat] = await db
        .select()
        .from(chat)
        .where(eq(chat.id, endingBefore))
        .limit(1);

      if (!selectedChat) {
        throw new ChatbotError(
          "not_found:database",
          `Chat with id ${endingBefore} not found`
        );
      }

      filteredChats = await baseQuery(lt(chat.createdAt, selectedChat.createdAt));
    } else {
      filteredChats = await baseQuery();
    }

    const hasMore = filteredChats.length > limit;

    return {
      chats: hasMore ? filteredChats.slice(0, limit) : filteredChats,
      hasMore,
    };
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get chats by user id"
    );
  }
}

export async function getChatById({ id }: { id: string }) {
  try {
    const [selectedChat] = await db.select().from(chat).where(eq(chat.id, id));
    if (!selectedChat) {
      return null;
    }

    return selectedChat;
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to get chat by id");
  }
}

export async function getChatWithAgent({ id }: { id: string }) {
  try {
    const [row] = await db.select().from(chat).where(eq(chat.id, id));
    if (!row) return null;
    return row;
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to get chat with agent");
  }
}

export async function saveMessages({ messages }: { messages: DBMessage[] }) {
  try {
    return await db
      .insert(message)
      .values(messages)
      .onConflictDoUpdate({
        target: message.id,
        set: { parts: sql`excluded.parts` },
      });
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to save messages");
  }
}

export async function updateMessage({
  id,
  parts,
}: {
  id: string;
  parts: DBMessage["parts"];
}) {
  try {
    return await db.update(message).set({ parts }).where(eq(message.id, id));
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to update message");
  }
}

export async function getMessagesByChatId({ id }: { id: string }) {
  try {
    return await db
      .select()
      .from(message)
      .where(eq(message.chatId, id))
      .orderBy(asc(message.createdAt));
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get messages by chat id"
    );
  }
}

export async function voteMessage({
  chatId,
  messageId,
  type,
}: {
  chatId: string;
  messageId: string;
  type: "up" | "down";
}) {
  try {
    const [existingVote] = await db
      .select()
      .from(vote)
      .where(and(eq(vote.messageId, messageId)));

    if (existingVote) {
      return await db
        .update(vote)
        .set({ isUpvoted: type === "up" })
        .where(and(eq(vote.messageId, messageId), eq(vote.chatId, chatId)));
    }
    return await db.insert(vote).values({
      chatId,
      messageId,
      isUpvoted: type === "up",
    });
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to vote message");
  }
}

export async function getVotesByChatId({ id }: { id: string }) {
  try {
    return await db.select().from(vote).where(eq(vote.chatId, id));
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get votes by chat id"
    );
  }
}

export async function saveDocument({
  id,
  title,
  kind,
  content,
  userId,
}: {
  id: string;
  title: string;
  kind: ArtifactKind;
  content: string;
  userId: string;
}) {
  try {
    return await db
      .insert(document)
      .values({
        id,
        title,
        kind,
        content,
        userId,
        createdAt: new Date(),
      })
      .returning();
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to save document");
  }
}

export async function updateDocumentContent({
  id,
  content,
}: {
  id: string;
  content: string;
}) {
  try {
    const docs = await db
      .select()
      .from(document)
      .where(eq(document.id, id))
      .orderBy(desc(document.createdAt))
      .limit(1);

    const latest = docs[0];
    if (!latest) {
      throw new ChatbotError("not_found:database", "Document not found");
    }

    return await db
      .update(document)
      .set({ content })
      .where(and(eq(document.id, id), eq(document.createdAt, latest.createdAt)))
      .returning();
  } catch (_error) {
    if (_error instanceof ChatbotError) {
      throw _error;
    }
    throw new ChatbotError(
      "bad_request:database",
      "Failed to update document content"
    );
  }
}

export async function getDocumentsById({ id }: { id: string }) {
  try {
    const documents = await db
      .select()
      .from(document)
      .where(eq(document.id, id))
      .orderBy(asc(document.createdAt));

    return documents;
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get documents by id"
    );
  }
}

export async function getDocumentById({ id }: { id: string }) {
  try {
    const [selectedDocument] = await db
      .select()
      .from(document)
      .where(eq(document.id, id))
      .orderBy(desc(document.createdAt));

    return selectedDocument;
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get document by id"
    );
  }
}

export async function deleteDocumentsByIdAfterTimestamp({
  id,
  timestamp,
}: {
  id: string;
  timestamp: Date;
}) {
  try {
    await db
      .delete(suggestion)
      .where(
        and(
          eq(suggestion.documentId, id),
          gt(suggestion.documentCreatedAt, timestamp)
        )
      );

    return await db
      .delete(document)
      .where(and(eq(document.id, id), gt(document.createdAt, timestamp)))
      .returning();
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to delete documents by id after timestamp"
    );
  }
}

export async function saveSuggestions({
  suggestions,
}: {
  suggestions: Suggestion[];
}) {
  try {
    return await db.insert(suggestion).values(suggestions);
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to save suggestions"
    );
  }
}

export async function getSuggestionsByDocumentId({
  documentId,
}: {
  documentId: string;
}) {
  try {
    return await db
      .select()
      .from(suggestion)
      .where(eq(suggestion.documentId, documentId));
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get suggestions by document id"
    );
  }
}

export async function getMessageById({ id }: { id: string }) {
  try {
    return await db.select().from(message).where(eq(message.id, id));
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get message by id"
    );
  }
}

export async function deleteMessagesByChatIdAfterTimestamp({
  chatId,
  timestamp,
}: {
  chatId: string;
  timestamp: Date;
}) {
  try {
    const messagesToDelete = await db
      .select({ id: message.id })
      .from(message)
      .where(
        and(eq(message.chatId, chatId), gte(message.createdAt, timestamp))
      );

    const messageIds = messagesToDelete.map(
      (currentMessage) => currentMessage.id
    );

    if (messageIds.length > 0) {
      await db
        .delete(vote)
        .where(
          and(eq(vote.chatId, chatId), inArray(vote.messageId, messageIds))
        );

      return await db
        .delete(message)
        .where(
          and(eq(message.chatId, chatId), inArray(message.id, messageIds))
        );
    }
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to delete messages by chat id after timestamp"
    );
  }
}

export async function updateChatVisibilityById({
  chatId,
  visibility,
}: {
  chatId: string;
  visibility: "private" | "public";
}) {
  try {
    return await db.update(chat).set({ visibility }).where(eq(chat.id, chatId));
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to update chat visibility by id"
    );
  }
}

export async function updateChatTitleById({
  chatId,
  title,
}: {
  chatId: string;
  title: string;
}) {
  try {
    return await db.update(chat).set({ title }).where(eq(chat.id, chatId));
  } catch (_error) {
    return;
  }
}

export async function getMessageCountByUserId({
  id,
  differenceInHours,
}: {
  id: string;
  differenceInHours: number;
}) {
  try {
    const cutoffTime = new Date(
      Date.now() - differenceInHours * 60 * 60 * 1000
    );

    const [stats] = await db
      .select({ count: count(message.id) })
      .from(message)
      .innerJoin(chat, eq(message.chatId, chat.id))
      .where(
        and(
          eq(chat.userId, id),
          gte(message.createdAt, cutoffTime),
          eq(message.role, "user")
        )
      )
      .execute();

    return stats?.count ?? 0;
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get message count by user id"
    );
  }
}

export async function createStreamId({
  streamId,
  chatId,
}: {
  streamId: string;
  chatId: string;
}) {
  try {
    await db
      .insert(stream)
      .values({ id: streamId, chatId, createdAt: new Date() });
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to create stream id"
    );
  }
}

export async function getStreamIdsByChatId({ chatId }: { chatId: string }) {
  try {
    const streamIds = await db
      .select({ id: stream.id })
      .from(stream)
      .where(eq(stream.chatId, chatId))
      .orderBy(asc(stream.createdAt))
      .execute();

    return streamIds.map(({ id }) => id);
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get stream ids by chat id"
    );
  }
}

// ============================================================
// Agent CRUD
// ============================================================

export async function getAgents() {
  try {
    return await db
      .select()
      .from(agent)
      .orderBy(asc(agent.sortOrder), desc(agent.createdAt));
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to get agents");
  }
}

// ── Agent cache (5-min TTL, invalidated on CRUD mutations) ──
const agentCache = new Map<string, { data: unknown; ts: number }>();
const AGENT_CACHE_TTL = 5 * 60 * 1000;

export function invalidateAgentCache(id: string): void {
  agentCache.delete(id);
}

export async function getAgentById({ id }: { id: string }) {
  const cached = agentCache.get(id);
  if (cached && Date.now() - cached.ts < AGENT_CACHE_TTL) {
    return cached.data as Awaited<ReturnType<typeof getAgentByIdFromDb>>;
  }
  const result = await getAgentByIdFromDb({ id });
  if (result) {
    agentCache.set(id, { data: result, ts: Date.now() });
  }
  return result;
}

async function getAgentByIdFromDb({ id }: { id: string }) {
  try {
    const [result] = await db.select().from(agent).where(eq(agent.id, id));
    return result ?? null;
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to get agent by id");
  }
}

export async function createAgent({
  name,
  description,
  avatar,
  systemPrompt,
  phone,
  starterQuestions,
  isActive,
  isDefault,
  sortOrder,
  categoryId,
  userId,
}: {
  name: string;
  description: string;
  avatar: string;
  systemPrompt: string;
  phone?: string | null;
  starterQuestions?: string[];
  isActive: boolean;
  isDefault?: boolean;
  sortOrder: number;
  categoryId?: string | null;
  userId: string;
}) {
  try {
    if (isDefault === true) {
      const [result] = await db.transaction(async (tx) => {
        await tx
          .update(agent)
          .set({ isDefault: false })
          .where(eq(agent.isDefault, true));

        const [created] = await tx
          .insert(agent)
          .values({
            name,
            description,
            avatar,
            systemPrompt,
            phone: phone || null,
            starterQuestions: starterQuestions ?? [],
            isActive,
            isDefault: true,
            sortOrder,
            categoryId: categoryId ?? null,
            userId,
          })
          .returning();

        return [created];
      });
      return result;
    }

    const [result] = await db
      .insert(agent)
      .values({
        name,
        description,
        avatar,
        systemPrompt,
        phone: phone || null,
        starterQuestions: starterQuestions ?? [],
        isActive,
        isDefault: false,
        sortOrder,
        categoryId: categoryId ?? null,
        userId,
      })
      .returning();
    return result;
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to create agent");
  }
}

export async function getDefaultAgent() {
  try {
    const [result] = await db
      .select()
      .from(agent)
      .where(eq(agent.isDefault, true))
      .limit(1);
    return result ?? null;
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get default agent"
    );
  }
}

export async function updateAgent({
  id,
  name,
  description,
  avatar,
  systemPrompt,
  phone,
  starterQuestions,
  isActive,
  isDefault,
  sortOrder,
  categoryId,
}: {
  id: string;
  name: string;
  description: string;
  avatar: string;
  systemPrompt: string;
  phone?: string | null;
  starterQuestions?: string[];
  isActive: boolean;
  isDefault?: boolean;
  sortOrder: number;
  categoryId?: string | null;
}) {
  try {
    // When setting as default, use a transaction to ensure only one default exists
    if (isDefault === true) {
      const [result] = await db.transaction(async (tx) => {
        await tx
          .update(agent)
          .set({ isDefault: false })
          .where(eq(agent.isDefault, true));

        const [updated] = await tx
          .update(agent)
          .set({
            name,
            description,
            avatar,
            systemPrompt,
            phone: phone ?? null,
            starterQuestions: starterQuestions ?? [],
            isActive,
            isDefault: true,
            sortOrder,
            categoryId: categoryId ?? null,
            updatedAt: new Date(),
          })
          .where(eq(agent.id, id))
          .returning();

        return [updated];
      });
      return result;
    }

    const [result] = await db
      .update(agent)
      .set({
        name,
        description,
        avatar,
        systemPrompt,
        phone: phone ?? null,
        starterQuestions: starterQuestions ?? [],
        isActive,
        ...(isDefault !== undefined ? { isDefault } : {}),
        sortOrder,
        categoryId: categoryId ?? null,
        updatedAt: new Date(),
      })
      .where(eq(agent.id, id))
      .returning();
    return result;
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to update agent");
  }
}

export async function deleteAgent({ id }: { id: string }) {
  try {
    const [result] = await db.delete(agent).where(eq(agent.id, id)).returning();
    return result;
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to delete agent");
  }
}

// ============================================================
// Category CRUD
// ============================================================

export async function getCategories() {
  try {
    return await db
      .select()
      .from(category)
      .orderBy(asc(category.sortOrder), asc(category.createdAt));
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to get categories");
  }
}

export async function getCategoryById({ id }: { id: string }) {
  try {
    const [result] = await db
      .select()
      .from(category)
      .where(eq(category.id, id));
    return result ?? null;
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get category by id"
    );
  }
}

export async function createCategory({
  name,
  color,
  sortOrder,
  colorKey,
  userId,
}: {
  name: string;
  color: string;
  sortOrder?: number;
  colorKey?: string;
  userId: string;
}) {
  try {
    const [result] = await db
      .insert(category)
      .values({
        name,
        color,
        sortOrder: sortOrder ?? 0,
        colorKey: colorKey ?? "indigo",
        userId,
      })
      .returning();
    return result;
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to create category");
  }
}

export async function updateCategory({
  id,
  name,
  color,
  sortOrder,
  colorKey,
}: {
  id: string;
  name: string;
  color: string;
  sortOrder?: number;
  colorKey?: string;
}) {
  try {
    const updates: Record<string, unknown> = { name, color };
    if (sortOrder !== undefined) updates.sortOrder = sortOrder;
    if (colorKey !== undefined) updates.colorKey = colorKey;
    const [result] = await db
      .update(category)
      .set(updates)
      .where(eq(category.id, id))
      .returning();
    return result;
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to update category");
  }
}

export async function deleteCategory({ id }: { id: string }) {
  try {
    const [result] = await db
      .delete(category)
      .where(eq(category.id, id))
      .returning();
    return result;
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to delete category");
  }
}

// ============================================================
// SiteConfig CRUD
// ============================================================

export async function getSiteConfig() {
  try {
    const [result] = await db.select().from(siteConfig).limit(1);
    return result ?? null;
  } catch (_error) {
    console.error("getSiteConfig error:", _error);
    throw new ChatbotError("bad_request:database", "Failed to get site config");
  }
}

export async function upsertSiteConfig({
  defaultSystemPrompt,
  defaultStarterQuestions,
  siteName,
  siteDescription,
}: {
  defaultSystemPrompt?: string | null;
  defaultStarterQuestions?: string[] | null;
  siteName?: string | null;
  siteDescription?: string | null;
}) {
  try {
    const existing = await db.select({ id: siteConfig.id }).from(siteConfig).limit(1);

    if (existing.length > 0) {
      const [result] = await db
        .update(siteConfig)
        .set({
          ...(defaultSystemPrompt !== undefined ? { defaultSystemPrompt: defaultSystemPrompt || null } : {}),
          ...(defaultStarterQuestions !== undefined ? { defaultStarterQuestions: defaultStarterQuestions || null } : {}),
          ...(siteName !== undefined ? { siteName: siteName || null } : {}),
          ...(siteDescription !== undefined ? { siteDescription: siteDescription || null } : {}),
          updatedAt: new Date(),
        })
        .where(eq(siteConfig.id, existing[0].id))
        .returning();
      return result;
    }

    const [result] = await db
      .insert(siteConfig)
      .values({
        defaultSystemPrompt: defaultSystemPrompt ?? null,
        defaultStarterQuestions: defaultStarterQuestions ?? null,
        siteName: siteName ?? null,
        siteDescription: siteDescription ?? null,
      })
      .returning();
    return result;
  } catch (_error) {
    console.error("upsertSiteConfig error:", _error);
    throw new ChatbotError("bad_request:database", "Failed to upsert site config");
  }
}

// ============================================================
// Password Reset
// ============================================================

export async function createPasswordResetToken({
  email,
  token,
  expiresAt,
}: {
  email: string;
  token: string;
  expiresAt: Date;
}) {
  try {
    const [result] = await db
      .insert(passwordResetToken)
      .values({ email, token, expiresAt })
      .returning();
    return result;
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to create password reset token"
    );
  }
}

export async function getPasswordResetToken({
  token,
}: {
  token: string;
}) {
  try {
    const [result] = await db
      .select()
      .from(passwordResetToken)
      .where(
        and(
          eq(passwordResetToken.token, token),
          isNull(passwordResetToken.usedAt),
          gt(passwordResetToken.expiresAt, new Date())
        )
      );
    return result ?? null;
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get password reset token"
    );
  }
}

export async function markResetTokenAsUsed({ id }: { id: string }) {
  try {
    await db
      .update(passwordResetToken)
      .set({ usedAt: new Date() })
      .where(eq(passwordResetToken.id, id));
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to mark reset token as used"
    );
  }
}

export async function updateUserPassword({
  email,
  password,
}: {
  email: string;
  password: string;
}) {
  try {
    const hashedPassword = generateHashedPassword(password);
    await db
      .update(user)
      .set({ password: hashedPassword, updatedAt: new Date() })
      .where(eq(user.email, email));
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to update user password"
    );
  }
}

// ============================================================
// Dashboard Stats (admin only)
// ============================================================

export async function getDashboardStats() {
  try {
    // Overview counts
    const [chatCount] = await db
      .select({ value: count() })
      .from(chat);
    const [userCount] = await db
      .select({ value: count() })
      .from(user);
    const [agentCount] = await db
      .select({ value: count() })
      .from(agent);
    const [activeAgentCount] = await db
      .select({ value: count() })
      .from(agent)
      .where(eq(agent.isActive, true));
    const [messageCount] = await db
      .select({ value: count() })
      .from(message);

    // Vote totals
    const [upvotes] = await db
      .select({ value: count() })
      .from(vote)
      .where(eq(vote.isUpvoted, true));
    const [downvotes] = await db
      .select({ value: count() })
      .from(vote)
      .where(eq(vote.isUpvoted, false));

    // Period stats
    const periods = await db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE c."createdAt" > NOW() - INTERVAL '1 day') AS "todayChats",
        COUNT(*) FILTER (WHERE c."createdAt" > NOW() - INTERVAL '7 days') AS "weekChats",
        COUNT(*) FILTER (WHERE c."createdAt" > NOW() - INTERVAL '30 days') AS "monthChats",
        COUNT(DISTINCT CASE WHEN c."createdAt" > NOW() - INTERVAL '1 day' THEN c."userId" END) AS "todayUsers",
        COUNT(DISTINCT CASE WHEN c."createdAt" > NOW() - INTERVAL '7 days' THEN c."userId" END) AS "weekUsers",
        COUNT(DISTINCT CASE WHEN c."createdAt" > NOW() - INTERVAL '30 days' THEN c."userId" END) AS "monthUsers"
      FROM "Chat" c
    `);

    // Per-agent stats
    const agentStats = await db.execute(sql`
      SELECT
        a.name AS "agentName",
        COUNT(DISTINCT c.id) AS "chatCount",
        COUNT(DISTINCT m.id) AS "messageCount",
        COUNT(DISTINCT CASE WHEN v."isUpvoted" = true THEN v."messageId" END) AS "upvotes",
        COUNT(DISTINCT CASE WHEN v."isUpvoted" = false THEN v."messageId" END) AS "downvotes"
      FROM "Agent" a
      LEFT JOIN "Chat" c ON c."agentId" = a.id
      LEFT JOIN "Message_v2" m ON m."chatId" = c.id AND m.role = 'assistant'
      LEFT JOIN "Vote_v2" v ON v."chatId" = c.id AND v."messageId" = m.id
      GROUP BY a.id, a.name
      ORDER BY COUNT(DISTINCT c.id) DESC
    `);

    const periodRow = (periods as unknown as Record<string, string>[])[0] ?? {};

    return {
      overview: {
        totalChats: chatCount.value,
        totalUsers: userCount.value,
        totalAgents: agentCount.value,
        activeAgents: activeAgentCount.value,
        totalMessages: messageCount.value,
        totalUpvotes: upvotes.value,
        totalDownvotes: downvotes.value,
      },
      periods: {
        todayChats: Number(periodRow.todayChats ?? 0),
        weekChats: Number(periodRow.weekChats ?? 0),
        monthChats: Number(periodRow.monthChats ?? 0),
        todayUsers: Number(periodRow.todayUsers ?? 0),
        weekUsers: Number(periodRow.weekUsers ?? 0),
        monthUsers: Number(periodRow.monthUsers ?? 0),
      },
      agentStats: (agentStats as unknown as Record<string, string>[]).map(
        (row) => ({
          agentName: row.agentName,
          chatCount: Number(row.chatCount ?? 0),
          messageCount: Number(row.messageCount ?? 0),
          upvotes: Number(row.upvotes ?? 0),
          downvotes: Number(row.downvotes ?? 0),
        })
      ),
    };
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get dashboard stats"
    );
  }
}
