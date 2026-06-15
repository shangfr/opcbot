ALTER TABLE "Category" ADD COLUMN "sort_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "Category" ADD COLUMN "color_key" text DEFAULT 'indigo' NOT NULL;--> statement-breakpoint
ALTER TABLE "Chat" ADD COLUMN "agentName" text;