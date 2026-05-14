-- Phase 18a: drop modes.slug (no longer used by the application).
-- The slug column is removed together with its unique index.
DROP INDEX IF EXISTS "modes_slug_uniq";
ALTER TABLE "modes" DROP COLUMN IF EXISTS "slug";
