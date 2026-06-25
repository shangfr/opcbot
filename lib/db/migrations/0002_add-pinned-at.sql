ALTER TABLE "Chat" ADD COLUMN "pinnedAt" timestamp;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "Chat_pinnedAt_idx" ON "Chat" USING btree ("pinnedAt");