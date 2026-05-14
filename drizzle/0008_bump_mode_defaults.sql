-- Phase 16: bump legacy default values for existing modes.
-- Only update rows that still hold the previous defaults so user-tuned values
-- are preserved.
UPDATE modes
SET default_config = jsonb_set(default_config, '{startingMoney}', '2000'::jsonb, true)
WHERE (default_config->>'startingMoney')::int = 1000;

UPDATE modes
SET default_config = jsonb_set(default_config, '{rebuy,amount}', '1500'::jsonb, true)
WHERE jsonb_typeof(default_config->'rebuy') = 'object'
  AND (default_config->'rebuy'->>'amount')::int = 1000;
