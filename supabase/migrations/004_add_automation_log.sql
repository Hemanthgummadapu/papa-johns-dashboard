-- Create automation_log table
CREATE TABLE IF NOT EXISTS automation_log (
  id uuid default gen_random_uuid() primary key,
  timestamp timestamptz default now(),
  store_number text,
  date_start date,
  date_end date,
  source text, -- 'email' | 'manual_upload' | 'api'
  status text, -- 'success' | 'failed' | 'processing'
  net_sales numeric,
  sheet_row integer,
  error_message text,
  created_at timestamptz default now()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_automation_log_timestamp ON automation_log(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_automation_log_status ON automation_log(status);

