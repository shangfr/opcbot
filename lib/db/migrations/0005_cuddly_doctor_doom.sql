DO $$ BEGIN
 CREATE TYPE "public"."agent_visibility" AS ENUM('public', 'private');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."ticket_activity_type" AS ENUM('created', 'updated', 'status_changed', 'priority_changed', 'assignee_changed', 'commented', 'deleted');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."ticket_priority" AS ENUM('low', 'medium', 'high', 'urgent');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."ticket_status" AS ENUM('pending', 'in_progress', 'completed', 'closed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."ticket_visibility" AS ENUM('public', 'private');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."user_role" AS ENUM('user', 'moderator', 'admin');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "PhoneVerificationCode" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone" varchar(20) NOT NULL,
	"code" varchar(6) NOT NULL,
	"purpose" varchar(16) DEFAULT 'register' NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"usedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Ticket" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"content" text,
	"priority" "ticket_priority" DEFAULT 'medium' NOT NULL,
	"status" "ticket_status" DEFAULT 'pending' NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"assignee" text,
	"phone" text,
	"due_date" timestamp,
	"categoryId" uuid,
	"userId" uuid NOT NULL,
	"visibility" "ticket_visibility" DEFAULT 'public' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "TicketActivity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticketId" uuid NOT NULL,
	"userId" uuid NOT NULL,
	"type" "ticket_activity_type" NOT NULL,
	"summary" text NOT NULL,
	"old_value" text,
	"new_value" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "TicketCategory" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"color" text DEFAULT '#6366f1' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"color_key" text DEFAULT 'indigo' NOT NULL,
	"userId" uuid NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "TicketComment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticketId" uuid NOT NULL,
	"userId" uuid NOT NULL,
	"content" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "TicketTag" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"color" text DEFAULT '#6366f1' NOT NULL,
	"userId" uuid NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "TicketTagRelation" (
	"ticketId" uuid NOT NULL,
	"tagId" uuid NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "TicketTagRelation_ticketId_tagId_pk" PRIMARY KEY("ticketId","tagId")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "UserKnowledge" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"knowledge_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"userId" uuid NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "Agent" ADD COLUMN "visibility" "agent_visibility" DEFAULT 'public' NOT NULL;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "role" "user_role" DEFAULT 'user' NOT NULL;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "phone" varchar(20);--> statement-breakpoint
ALTER TABLE "Ticket" ADD COLUMN "phone" varchar(20);--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_categoryId_TicketCategory_id_fk" FOREIGN KEY ("categoryId") REFERENCES "public"."TicketCategory"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "TicketActivity" ADD CONSTRAINT "TicketActivity_ticketId_Ticket_id_fk" FOREIGN KEY ("ticketId") REFERENCES "public"."Ticket"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "TicketActivity" ADD CONSTRAINT "TicketActivity_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "TicketCategory" ADD CONSTRAINT "TicketCategory_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "TicketComment" ADD CONSTRAINT "TicketComment_ticketId_Ticket_id_fk" FOREIGN KEY ("ticketId") REFERENCES "public"."Ticket"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "TicketComment" ADD CONSTRAINT "TicketComment_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "TicketTag" ADD CONSTRAINT "TicketTag_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "TicketTagRelation" ADD CONSTRAINT "TicketTagRelation_ticketId_Ticket_id_fk" FOREIGN KEY ("ticketId") REFERENCES "public"."Ticket"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "TicketTagRelation" ADD CONSTRAINT "TicketTagRelation_tagId_TicketTag_id_fk" FOREIGN KEY ("tagId") REFERENCES "public"."TicketTag"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "UserKnowledge" ADD CONSTRAINT "UserKnowledge_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "PhoneVerificationCode_phone_idx" ON "PhoneVerificationCode" USING btree ("phone");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "PhoneVerificationCode_purpose_idx" ON "PhoneVerificationCode" USING btree ("purpose");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ticket_userId_idx" ON "Ticket" USING btree ("userId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ticket_status_idx" ON "Ticket" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ticket_priority_idx" ON "Ticket" USING btree ("priority");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ticket_visibility_idx" ON "Ticket" USING btree ("visibility");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ticket_due_date_idx" ON "Ticket" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ticket_tag_relation_ticket_idx" ON "TicketTagRelation" USING btree ("ticketId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ticket_tag_relation_tag_idx" ON "TicketTagRelation" USING btree ("tagId");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "UserKnowledge_userId_knowledgeId_idx" ON "UserKnowledge" USING btree ("userId","knowledge_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "UserKnowledge_userId_idx" ON "UserKnowledge" USING btree ("userId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_userId_idx" ON "Agent" USING btree ("userId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_visibility_idx" ON "Agent" USING btree ("visibility");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "User_phone_idx" ON "User" USING btree ("phone") WHERE "User"."phone" IS NOT NULL;