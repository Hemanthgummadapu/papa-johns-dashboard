CREATE TABLE smg_scores (
  id uuid default gen_random_uuid() primary key,
  store_number text,
  date date,
  osat numeric,
  accuracy_of_order numeric,
  accuracy_vs_previous text,
  wait_time numeric,
  wait_time_vs_previous text,
  taste_of_food numeric,
  driver_friendliness numeric,
  cases_new integer,
  cases_in_progress integer,
  cases_resolved integer,
  cases_escalated integer,
  scraped_at timestamptz default now(),
  UNIQUE(store_number, date)
);

CREATE INDEX IF NOT EXISTS idx_smg_scores_store_number ON smg_scores(store_number);
CREATE INDEX IF NOT EXISTS idx_smg_scores_date ON smg_scores(date DESC);


