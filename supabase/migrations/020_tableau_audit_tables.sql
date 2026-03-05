-- Tableau audit summary tables (one-time sync from Tableau; dashboard reads from Supabase only)

create table if not exists bad_order_summary (
  id uuid default gen_random_uuid() primary key,
  store_number text,
  bad_order_percent numeric,
  bad_order_transactions int,
  bad_order_amount_percent numeric,
  bad_order_amount numeric,
  week text,
  period text,
  synced_at timestamp default now()
);

create table if not exists zeroed_out_summary (
  id uuid default gen_random_uuid() primary key,
  store_number text,
  zeroed_out_percent numeric,
  zeroed_out_transactions int,
  zeroed_out_amount_percent numeric,
  zeroed_out_amount numeric,
  week text,
  period text,
  synced_at timestamp default now()
);

create table if not exists canceled_order_summary (
  id uuid default gen_random_uuid() primary key,
  store_number text,
  canceled_percent numeric,
  canceled_transactions int,
  canceled_amount_percent numeric,
  canceled_amount numeric,
  week text,
  period text,
  synced_at timestamp default now()
);

create table if not exists refund_order_summary (
  id uuid default gen_random_uuid() primary key,
  store_number text,
  refund_percent numeric,
  refund_transactions int,
  refund_amount_percent numeric,
  refund_amount numeric,
  week text,
  period text,
  synced_at timestamp default now()
);

create table if not exists tableau_sync_log (
  id uuid default gen_random_uuid() primary key,
  view_name text,
  rows_synced int,
  status text,
  error text,
  period text,
  week text,
  synced_at timestamp default now()
);
