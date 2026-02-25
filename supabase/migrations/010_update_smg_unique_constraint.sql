-- Update unique constraint to include period
-- Drop the old unique constraint
ALTER TABLE smg_scores DROP CONSTRAINT IF EXISTS smg_scores_store_number_date_key;

-- Add new unique constraint with period
ALTER TABLE smg_scores ADD CONSTRAINT smg_scores_store_number_date_period_key UNIQUE(store_number, date, period);



