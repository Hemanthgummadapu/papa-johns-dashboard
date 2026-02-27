CREATE TABLE IF NOT EXISTS live_kpi (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  store_number text NOT NULL,
  date text,
  total_net_sales numeric,
  ly_net_sales numeric,
  comp_pct numeric,
  labor_pct numeric,
  labor_dollars numeric,
  otd_time text,
  avg_make_time text,
  avg_rack_time text,
  delivery_orders integer,
  carryout_pct numeric,
  target_food_cost numeric,
  total_orders integer,
  ticket_average numeric,
  online_net_sales numeric,
  scraped_at timestamptz DEFAULT now()
);

-- No RLS, fully open for service role
ALTER TABLE live_kpi ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON live_kpi FOR ALL USING (true);


