-- Phase 21e — Graph 2.0 big-bang reset.
--
-- The bet_graphs table previously stored v1 BetGraphs (no slot positions). The
-- new Graph 2.0 representation (`version: 2`, `grid: {cols, rows}`, `pos` on
-- every node) is incompatible — and the user explicitly authorized wiping all
-- existing graphs ("ganze Tabelle dropen + neu anlegen mit Slot-Format-Spalten").
--
-- This migration:
--   1. Drops bet_graphs (cascades to nothing — only FK is mode_id which is in).
--   2. Recreates it with the same column shape (graph_json remains jsonb and
--      opaque; the new shape lives entirely in the JS-side BetGraph type).
--   3. Clears sessions.bet_graphs_snapshot so running sessions don't carry old
--      v1 snapshots into the new engine.

DROP TABLE IF EXISTS "bet_graphs" CASCADE;

CREATE TABLE "bet_graphs" (
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

CREATE INDEX "bet_graphs_mode_idx" ON "bet_graphs" ("mode_id");

UPDATE "sessions" SET "bet_graphs_snapshot" = '[]'::jsonb;
