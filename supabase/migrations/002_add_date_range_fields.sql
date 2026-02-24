-- Add date range and delivery sales fields to daily_reports
ALTER TABLE daily_reports 
ADD COLUMN IF NOT EXISTS report_date_end DATE,
ADD COLUMN IF NOT EXISTS doordash_sales DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS ubereats_sales DECIMAL(10, 2);

-- Update unique constraint to allow same date range for same store
ALTER TABLE daily_reports DROP CONSTRAINT IF EXISTS daily_reports_store_id_report_date_key;
CREATE UNIQUE INDEX IF NOT EXISTS daily_reports_store_date_range_unique 
ON daily_reports(store_id, report_date, COALESCE(report_date_end, report_date));

