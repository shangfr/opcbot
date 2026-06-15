CREATE TABLE IF NOT EXISTS "SiteConfig" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"default_system_prompt" text,
	"default_starter_questions" json,
	"site_name" text,
	"site_description" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
