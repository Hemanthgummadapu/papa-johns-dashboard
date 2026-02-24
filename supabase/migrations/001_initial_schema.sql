-- Create stores table
CREATE TABLE IF NOT EXISTS stores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_number INTEGER UNIQUE NOT NULL,
  name TEXT NOT NULL,
  location TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create daily_reports table
CREATE TABLE IF NOT EXISTS daily_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  report_date DATE NOT NULL,
  net_sales DECIMAL(10, 2),
  labor_pct DECIMAL(5, 2),
  food_cost_pct DECIMAL(5, 2),
  flm_pct DECIMAL(5, 2),
  cash_short DECIMAL(10, 2),
  raw_pdf_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(store_id, report_date)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_daily_reports_store_id ON daily_reports(store_id);
CREATE INDEX IF NOT EXISTS idx_daily_reports_report_date ON daily_reports(report_date);
CREATE INDEX IF NOT EXISTS idx_stores_store_number ON stores(store_number);

