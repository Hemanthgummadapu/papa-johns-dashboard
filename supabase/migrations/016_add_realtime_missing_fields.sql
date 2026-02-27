-- Add missing fields to realtime_summary table that are scraped but not yet stored
ALTER TABLE realtime_summary 
ADD COLUMN IF NOT EXISTS online_net_sales DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS ly_online_net_sales DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS online_comp_pct TEXT,
ADD COLUMN IF NOT EXISTS psa_sales DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS orders_to_deliver INTEGER,
ADD COLUMN IF NOT EXISTS product_to_make INTEGER;

