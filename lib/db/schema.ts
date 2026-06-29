import { type InferSelectModel, sql } from "drizzle-orm";
import {
  boolean,
  foreignKey,
  index,
  integer,
  json,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

// 用户角色枚举
export const userRoleEnum = pgEnum("user_role", ["user", "moderator", "admin"]);

export const user = pgTable(
  "User",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    email: varchar("email", { length: 64 }).notNull(),
    password: varchar("password", { length: 64 }),
    name: text("name"),
    emailVerified: boolean("emailVerified").notNull().default(false),
    image: text("image"),
    isAnonymous: boolean("isAnonymous").notNull().default(false),
    role: userRoleEnum("role").notNull().default("user"),
    // 手机号字段：支持手机号注册登录，可选（邮箱注册用户可为空）
    phone: varchar("phone", { length: 20 }),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (table) => ({
    emailIdx: uniqueIndex("User_email_idx").on(table.email),
    // 手机号唯一索引（部分索引，仅当 phone 非空时生效，避免多个 NULL 冲突）
    phoneIdx: uniqueIndex("User_phone_idx").on(table.phone).where(sql`${table.phone} IS NOT NULL`),
  })
);

export type User = InferSelectModel<typeof user>;

export const chat = pgTable(
  "Chat",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    createdAt: timestamp("createdAt").notNull(),
    title: text("title").notNull(),
    userId: uuid("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    visibility: varchar("visibility", { enum: ["public", "private"] })
      .notNull()
      .default("private"),
    agentId: uuid("agentId").references(() => agent.id, {
      onDelete: "set null",
    }),
    agentName: text("agentName"),
    pinnedAt: timestamp("pinnedAt"),
  },
  (table) => ({
    userIdIdx: index("Chat_userId_idx").on(table.userId),
    createdAtIdx: index("Chat_createdAt_idx").on(table.createdAt),
    pinnedAtIdx: index("Chat_pinnedAt_idx").on(table.pinnedAt),
  })
);

export type Chat = InferSelectModel<typeof chat>;

export const message = pgTable(
  "Message_v2",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    chatId: uuid("chatId")
      .notNull()
      .references(() => chat.id, { onDelete: "cascade" }),
    role: varchar("role").notNull(),
    parts: json("parts").notNull(),
    attachments: json("attachments").notNull(),
    createdAt: timestamp("createdAt").notNull(),
  },
  (table) => ({
    chatIdIdx: index("Message_chatId_idx").on(table.chatId),
    createdAtIdx: index("Message_createdAt_idx").on(table.createdAt),
  })
);

export type DBMessage = InferSelectModel<typeof message>;

export const vote = pgTable(
  "Vote_v2",
  {
    chatId: uuid("chatId")
      .notNull()
      .references(() => chat.id, { onDelete: "cascade" }),
    messageId: uuid("messageId")
      .notNull()
      .references(() => message.id, { onDelete: "cascade" }),
    isUpvoted: boolean("isUpvoted").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.chatId, table.messageId] }),
  })
);

export type Vote = InferSelectModel<typeof vote>;

export const document = pgTable(
  "Document",
  {
    id: uuid("id").notNull().defaultRandom(),
    createdAt: timestamp("createdAt").notNull(),
    title: text("title").notNull(),
    content: text("content"),
    kind: varchar("text", { enum: ["text", "code", "image", "html", "sheet"] })
      .notNull()
      .default("text"),
    userId: uuid("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.id, table.createdAt] }),
  })
);

export type Document = InferSelectModel<typeof document>;

export const suggestion = pgTable(
  "Suggestion",
  {
    id: uuid("id").notNull().defaultRandom(),
    documentId: uuid("documentId").notNull(),
    documentCreatedAt: timestamp("documentCreatedAt").notNull(),
    originalText: text("originalText").notNull(),
    suggestedText: text("suggestedText").notNull(),
    description: text("description"),
    isResolved: boolean("isResolved").notNull().default(false),
    userId: uuid("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("createdAt").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.id] }),
    documentRef: foreignKey({
      columns: [table.documentId, table.documentCreatedAt],
      foreignColumns: [document.id, document.createdAt],
    }),
  })
);

export type Suggestion = InferSelectModel<typeof suggestion>;

export const stream = pgTable(
  "Stream",
  {
    id: uuid("id").notNull().defaultRandom(),
    chatId: uuid("chatId").notNull(),
    createdAt: timestamp("createdAt").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.id] }),
    chatRef: foreignKey({
      columns: [table.chatId],
      foreignColumns: [chat.id],
    }).onDelete("cascade"),
  })
);

export type Stream = InferSelectModel<typeof stream>;

// Agent 可见性枚举：public=全站公开（管理员创建）, private=仅创建者可见
export const agentVisibilityEnum = pgEnum("agent_visibility", [
  "public",
  "private",
]);

export const agent = pgTable(
  "Agent",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    avatar: text("avatar").notNull().default("/icon.png"),
    systemPrompt: text("system_prompt").notNull(),
    phone: text("phone"),
    knowledgeId: text("knowledge_id"),
    starterQuestions: json("starter_questions").$type<string[]>().default([]),
    isActive: boolean("is_active").notNull().default(true),
    isDefault: boolean("is_default").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    categoryId: uuid("categoryId").references(() => category.id, {
      onDelete: "set null",
    }),
    userId: uuid("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    // 可见性：public=全站可见（管理员创建的公共OPC），private=仅创建者可见（用户自建OPC）
    visibility: agentVisibilityEnum("visibility").notNull().default("public"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (table) => ({
    defaultUnique: uniqueIndex("agent_default_idx")
      .on(table.isDefault)
      .where(sql`${table.isDefault} = true`),
    userIdIdx: index("agent_userId_idx").on(table.userId),
    visibilityIdx: index("agent_visibility_idx").on(table.visibility),
  })
);

export type Agent = InferSelectModel<typeof agent>;

export const category = pgTable("Category", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  name: text("name").notNull(),
  color: text("color").notNull().default("#6366f1"),
  sortOrder: integer("sort_order").notNull().default(0),
  colorKey: text("color_key").notNull().default("indigo"),
  userId: uuid("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export type Category = InferSelectModel<typeof category>;

export const siteConfig = pgTable("SiteConfig", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  defaultSystemPrompt: text("default_system_prompt"),
  defaultStarterQuestions: json("default_starter_questions").$type<string[]>(),
  siteName: text("site_name"),
  siteDescription: text("site_description"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export type SiteConfig = InferSelectModel<typeof siteConfig>;

export const passwordResetToken = pgTable("PasswordResetToken", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  email: varchar("email", { length: 64 }).notNull(),
  token: text("token").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  usedAt: timestamp("usedAt"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export type PasswordResetToken = InferSelectModel<typeof passwordResetToken>;

// 手机号验证码表：用于注册/登录时的短信验证码校验
export const phoneVerificationCode = pgTable(
  "PhoneVerificationCode",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    phone: varchar("phone", { length: 20 }).notNull(),
    code: varchar("code", { length: 6 }).notNull(),
    // 验证码用途：register=注册, login=登录
    purpose: varchar("purpose", { length: 16 }).notNull().default("register"),
    expiresAt: timestamp("expiresAt").notNull(),
    usedAt: timestamp("usedAt"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
  },
  (table) => ({
    phoneIdx: index("PhoneVerificationCode_phone_idx").on(table.phone),
    purposeIdx: index("PhoneVerificationCode_purpose_idx").on(table.purpose),
  })
);

export type PhoneVerificationCode = InferSelectModel<
  typeof phoneVerificationCode
>;

// 用户知识库关联表：记录用户创建的智谱知识库
// 智谱知识库本身存储在 Zhipu API 侧，此表仅记录本地关联关系（谁创建了哪个知识库）
export const userKnowledge = pgTable(
  "UserKnowledge",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    // 智谱知识库 ID（由 Zhipu API 返回）
    knowledgeId: text("knowledge_id").notNull(),
    // 知识库名称（冗余存储，避免每次都调 API 查询）
    name: text("name").notNull(),
    description: text("description"),
    // 创建者
    userId: uuid("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (table) => ({
    // 同一用户下知识库 ID 唯一
    userKbUnique: uniqueIndex("UserKnowledge_userId_knowledgeId_idx").on(
      table.userId,
      table.knowledgeId
    ),
    userIdIdx: index("UserKnowledge_userId_idx").on(table.userId),
  })
);

export type UserKnowledge = InferSelectModel<typeof userKnowledge>;
