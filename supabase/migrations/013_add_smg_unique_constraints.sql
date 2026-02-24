-- Simplify SMG scores: always keep exactly 2 rows per store (previous and current)
-- Unique constraint: (store_number, period) ensures exactly one row per store per period

-- Drop old constraints and indexes
ALTER TABLE smg_scores DROP CONSTRAINT IF EXISTS smg_scores_store_number_period_start_date_key;
ALTER TABLE smg_scores DROP CONSTRAINT IF EXISTS smg_scores_store_period_unique;
DROP INDEX IF EXISTS smg_scores_unique_idx;
DROP INDEX IF EXISTS smg_scores_current_unique_idx;

-- Add clean unique constraint for both periods
ALTER TABLE smg_scores
ADD CONSTRAINT smg_scores_store_period_unique 
UNIQUE (store_number, period);

