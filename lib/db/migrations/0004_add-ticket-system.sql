-- ============================================================
-- 工单（Ticket）系统迁移：复刻 OPC 的分组+卡片模式，扩展任务管理字段
-- ============================================================

-- Create ticket_priority enum type
DO $$ BEGIN
  CREATE TYPE "ticket_priority" AS ENUM('low', 'medium', 'high', 'urgent');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

-- Create ticket_status enum type
DO $$ BEGIN
  CREATE TYPE "ticket_status" AS ENUM('pending', 'in_progress', 'completed', 'closed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

-- Create ticket_visibility enum type
DO $$ BEGIN
  CREATE TYPE "ticket_visibility" AS ENUM('public', 'private');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

-- Create TicketCategory table (任务类型分类，对应 OPC 的 Category 分组)
CREATE TABLE IF NOT EXISTS "TicketCategory" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "color" text NOT NULL DEFAULT '#6366f1',
  "sort_order" integer NOT NULL DEFAULT 0,
  "color_key" text NOT NULL DEFAULT 'indigo',
  "userId" uuid NOT NULL REFERENCES "User"("id") ON DELETE cascade,
  "createdAt" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "TicketCategory_userId_idx" ON "TicketCategory" USING btree ("userId");--> statement-breakpoint

-- Create Ticket table (工单，对应 OPC 的 Agent 表)
CREATE TABLE IF NOT EXISTS "Ticket" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "title" text NOT NULL,
  "description" text NOT NULL,
  "content" text,
  "priority" "ticket_priority" NOT NULL DEFAULT 'medium',
  "status" "ticket_status" NOT NULL DEFAULT 'pending',
  "progress" integer NOT NULL DEFAULT 0,
  "assignee" text,
  "due_date" timestamp,
  "categoryId" uuid REFERENCES "TicketCategory"("id") ON DELETE set null,
  "userId" uuid NOT NULL REFERENCES "User"("id") ON DELETE cascade,
  "visibility" "ticket_visibility" NOT NULL DEFAULT 'public',
  "is_active" boolean NOT NULL DEFAULT true,
  "sort_order" integer NOT NULL DEFAULT 0,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "ticket_userId_idx" ON "Ticket" USING btree ("userId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ticket_status_idx" ON "Ticket" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ticket_priority_idx" ON "Ticket" USING btree ("priority");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ticket_visibility_idx" ON "Ticket" USING btree ("visibility");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ticket_due_date_idx" ON "Ticket" USING btree ("due_date");--> statement-breakpoint

-- ============================================================
-- 工单系统产品优化扩展表
-- ============================================================

-- Create ticket_activity_type enum type
DO $$ BEGIN
  CREATE TYPE "ticket_activity_type" AS ENUM('created', 'updated', 'status_changed', 'priority_changed', 'assignee_changed', 'commented', 'deleted');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

-- Create TicketComment table (工单评论)
CREATE TABLE IF NOT EXISTS "TicketComment" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "ticketId" uuid NOT NULL REFERENCES "Ticket"("id") ON DELETE cascade,
  "userId" uuid NOT NULL REFERENCES "User"("id") ON DELETE cascade,
  "content" text NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "TicketComment_ticketId_idx" ON "TicketComment" USING btree ("ticketId");--> statement-breakpoint

-- Create TicketActivity table (工单活动日志)
CREATE TABLE IF NOT EXISTS "TicketActivity" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "ticketId" uuid NOT NULL REFERENCES "Ticket"("id") ON DELETE cascade,
  "userId" uuid NOT NULL REFERENCES "User"("id") ON DELETE cascade,
  "type" "ticket_activity_type" NOT NULL,
  "summary" text NOT NULL,
  "old_value" text,
  "new_value" text,
  "createdAt" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "TicketActivity_ticketId_idx" ON "TicketActivity" USING btree ("ticketId");--> statement-breakpoint

-- Create TicketTag table (工单标签)
CREATE TABLE IF NOT EXISTS "TicketTag" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "color" text NOT NULL DEFAULT '#6366f1',
  "userId" uuid NOT NULL REFERENCES "User"("id") ON DELETE cascade,
  "createdAt" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

-- Create TicketTagRelation table (工单-标签多对多关联)
CREATE TABLE IF NOT EXISTS "TicketTagRelation" (
  "ticketId" uuid NOT NULL REFERENCES "Ticket"("id") ON DELETE cascade,
  "tagId" uuid NOT NULL REFERENCES "TicketTag"("id") ON DELETE cascade,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  PRIMARY KEY ("ticketId", "tagId")
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ticket_tag_relation_ticket_idx" ON "TicketTagRelation" USING btree ("ticketId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ticket_tag_relation_tag_idx" ON "TicketTagRelation" USING btree ("tagId");--> statement-breakpoint
