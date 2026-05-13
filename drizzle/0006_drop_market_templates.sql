-- Phase 9: drop legacy market_templates jsonb columns.
-- BetGraphs are now the only market-definition mechanism.

ALTER TABLE "modes" DROP COLUMN IF EXISTS "market_templates";
ALTER TABLE "sessions" DROP COLUMN IF EXISTS "market_templates";
