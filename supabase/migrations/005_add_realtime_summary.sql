CREATE TABLE IF NOT EXISTS realtime_summary (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_number TEXT NOT NULL,
  date DATE NOT NULL,
  total_net_sales DECIMAL(10, 2),
  ly_net_sales DECIMAL(10, 2),
  comp_pct TEXT,
  labor_pct DECIMAL(5, 2),
  labor_dollars DECIMAL(10, 2),
  target_food_cost DECIMAL(10, 2),
  target_food_pct DECIMAL(5, 2),
  delivery_orders INTEGER,
  total_orders INTEGER,
  avg_make_time TEXT,
  avg_rack_time TEXT,
  otd_time TEXT,
  carryout_pct TEXT,
  ticket_average DECIMAL(10, 2),
  scraped_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(store_number, date)
);

CREATE INDEX IF NOT EXISTS idx_realtime_summary_store_number ON realtime_summary(store_number);
CREATE INDEX IF NOT EXISTS idx_realtime_summary_date ON realtime_summary(date);
CREATE INDEX IF NOT EXISTS idx_realtime_summary_scraped_at ON realtime_summary(scraped_at DESC);