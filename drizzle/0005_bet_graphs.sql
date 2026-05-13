-- Phase 6 -- BetGraph foundation.
-- Adds the new `bet_graphs` table (mode-level visual-graph definitions) and a
-- per-session snapshot column so that running sessions don't retro-change.
-- Kept additive on purpose: legacy market_templates remain in place during the
-- side-by-side rollout and will be dropped in a follow-up migration.

CREATE TABLE IF NOT EXISTS "bet_graphs" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "mode_id" uuid NOT NULL,
    "name" text NOT NULL,
    "description" text,
    "graph_json" jsonb NOT NULL,
    "order_index" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "bet_graphs_mode_id_fk" FOREIGN KEY ("mode_id") REFERENCES "modes"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "bet_graphs_mode_idx" ON "bet_graphs" ("mode_id");

ALTER TABLE "sessions"
    ADD COLUMN IF NOT EXISTS "bet_graphs_snapshot" jsonb DEFAULT '[]'::jsonb NOT NULL;
