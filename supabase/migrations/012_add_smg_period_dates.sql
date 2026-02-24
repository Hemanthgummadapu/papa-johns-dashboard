-- Add period date range columns to smg_scores
ALTER TABLE smg_scores
ADD COLUMN IF NOT EXISTS period_start_date date,
ADD COLUMN IF NOT EXISTS period_end_date date;

-- Drop the old unique constraint
ALTER TABLE smg_scores DROP CONSTRAINT IF EXISTS smg_scores_store_number_date_period_key;

-- Create new unique constraint on (store_number, period_start_date)
-- This ensures previous period data is never overwritten once saved
-- and current period data gets updated in place
ALTER TABLE smg_scores 
ADD CONSTRAINT smg_scores_store_number_period_start_date_key 
UNIQUE(store_number, period_start_date);

-- Create index for faster queries by period
CREATE INDEX IF NOT EXISTS idx_smg_scores_period_start_date ON smg_scores(period_start_date DESC);
CREATE INDEX IF NOT EXISTS idx_smg_scores_period ON smg_scores(period);


