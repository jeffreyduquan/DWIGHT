ALTER TABLE "modes" ADD COLUMN "market_templates" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "market_templates" jsonb DEFAULT '[]'::jsonb NOT NULL;