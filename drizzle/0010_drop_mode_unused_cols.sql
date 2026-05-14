-- Phase 19c: drop unused mode columns.
-- These were filled with defaults since Phase 17 but never read by the runtime.
ALTER TABLE "modes" DROP COLUMN IF EXISTS "description";
ALTER TABLE "modes" DROP COLUMN IF EXISTS "terminology";
ALTER TABLE "modes" DROP COLUMN IF EXISTS "default_config";
