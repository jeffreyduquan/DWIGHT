-- Phase 11.2: drop legacy `EITHER` value from confirmation_mode enum.
--
-- Safety:
--   1) Backfill any session/mode jsonb still using EITHER → PEERS (semantically
--      identical under the Phase 11 "GM counts as peer" rule).
--   2) Recreate the enum with only GM | PEERS. Postgres has no DROP VALUE,
--      so we rename the old type, create a fresh one, then drop the old one.
--
-- The enum is referenced only via jsonb in DWIGHT (no real column uses it),
-- so no `ALTER COLUMN ... USING` step is required.
--
-- ⚠ Pre-flight: run `node scripts/check-confirmation-mode.mjs` first to confirm
--   no live session relies on EITHER. The script aborts the deploy otherwise.

BEGIN;

UPDATE "sessions"
SET "config" = jsonb_set("config", '{confirmationMode}', '"PEERS"')
WHERE "config"->>'confirmationMode' = 'EITHER';

UPDATE "modes"
SET "default_config" = jsonb_set("default_config", '{confirmationMode}', '"PEERS"')
WHERE "default_config"->>'confirmationMode' = 'EITHER';

ALTER TYPE "confirmation_mode" RENAME TO "confirmation_mode_old";
CREATE TYPE "confirmation_mode" AS ENUM ('GM', 'PEERS');
DROP TYPE "confirmation_mode_old";

COMMIT;
