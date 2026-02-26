create table if not exists smg_scores (
  id uuid default gen_random_uuid() primary key,
  store_id text not null,
  period text not null default 'current',
  scraped_at timestamptz default now(),

  -- Focus section
  focus_accuracy_current numeric,
  focus_accuracy_vs_previous numeric,
  focus_wait_time_current numeric,
  focus_wait_time_vs_previous numeric,

  -- How are we doing
  osat_my_score numeric,
  osat_vs_last_period numeric,
  osat_pj_score numeric,
  osat_vs_pj numeric,

  accuracy_my_score numeric,
  accuracy_vs_last_period numeric,
  accuracy_pj_score numeric,
  accuracy_vs_pj numeric,

  csc_my_score numeric,
  csc_vs_last_period numeric,
  csc_pj_score numeric,
  csc_vs_pj numeric,

  comp_orders_my_score numeric,
  comp_orders_vs_last_period numeric,
  comp_orders_pj_score numeric,
  comp_orders_vs_pj numeric,

  comp_sales_my_score numeric,
  comp_sales_vs_last_period numeric,
  comp_sales_pj_score numeric,
  comp_sales_vs_pj numeric,

  -- Ranking
  ranking_store_responses integer,
  ranking_store_osat numeric,
  ranking_store_taste_of_food numeric,
  ranking_store_accuracy_of_order numeric,
  ranking_store_wait_time numeric,
  ranking_store_friendliness numeric,

  ranking_pj_responses integer,
  ranking_pj_osat numeric,
  ranking_pj_taste_of_food numeric,
  ranking_pj_accuracy_of_order numeric,
  ranking_pj_wait_time numeric,
  ranking_pj_friendliness numeric,

  unique(store_id, period)
);

