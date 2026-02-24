-- Add period_label column to daily_reports for year-over-year comparisons
ALTER TABLE daily_reports 
ADD COLUMN IF NOT EXISTS period_label TEXT;

-- Add index for faster queries by period
CREATE INDEX IF NOT EXISTS idx_daily_reports_period_label ON daily_reports(period_label);

