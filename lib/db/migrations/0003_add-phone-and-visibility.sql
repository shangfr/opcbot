-- Add phone column to User table for phone-based registration/login
ALTER TABLE "User" ADD COLUMN "phone" varchar(20);--> statement-breakpoint

-- Create partial unique index on phone (only for non-NULL values)
CREATE UNIQUE INDEX IF NOT EXISTS "User_phone_idx" ON "User" USING btree ("phone") WHERE "User"."phone" IS NOT NULL;--> statement-breakpoint

-- Create agent_visibility enum type
DO $$ BEGIN
  CREATE TYPE "agent_visibility" AS ENUM('public', 'private');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

-- Add visibility column to Agent table (default 'public' for backward compatibility)
ALTER TABLE "Agent" ADD COLUMN "visibility" "agent_visibility" NOT NULL DEFAULT 'public';--> statement-breakpoint

-- Add indexes for Agent userId and visibility
CREATE INDEX IF NOT EXISTS "agent_userId_idx" ON "Agent" USING btree ("userId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_visibility_idx" ON "Agent" USING btree ("visibility");--> statement-breakpoint

-- Create PhoneVerificationCode table for SMS verification codes
CREATE TABLE IF NOT EXISTS "PhoneVerificationCode" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "phone" varchar(20) NOT NULL,
  "code" varchar(6) NOT NULL,
  "purpose" varchar(16) NOT NULL DEFAULT 'register',
  "expiresAt" timestamp NOT NULL,
  "usedAt" timestamp,
  "createdAt" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "PhoneVerificationCode_phone_idx" ON "PhoneVerificationCode" USING btree ("phone");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "PhoneVerificationCode_purpose_idx" ON "PhoneVerificationCode" USING btree ("purpose");--> statement-breakpoint

-- Create UserKnowledge table: tracks which user created which Zhipu knowledge base
CREATE TABLE IF NOT EXISTS "UserKnowledge" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "knowledge_id" text NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "userId" uuid NOT NULL REFERENCES "User"("id") ON DELETE cascade,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "UserKnowledge_userId_knowledgeId_idx" ON "UserKnowledge" USING btree ("userId", "knowledge_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "UserKnowledge_userId_idx" ON "UserKnowledge" USING btree ("userId");
