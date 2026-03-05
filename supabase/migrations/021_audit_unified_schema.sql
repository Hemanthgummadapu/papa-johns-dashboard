-- Unified audit schema: summary + details (replaces per-type tables for new sync)

-- audit_summary: one row per store per period per audit type
create table if not exists audit_summary (
  id uuid default gen_random_uuid() primary key,
  store_number text not null,
  audit_type text not null,
  period_code text not null,
  year int not null,
  period_number int not null,
  week text,
  percent numeric,
  transactions int default 0,
  amount_percent numeric,
  amount numeric,
  synced_at timestamptz default now(),
  unique(store_number, period_code, week, audit_type)
);

create index if not exists idx_audit_summary_period on audit_summary(period_code);
create index if not exists idx_audit_summary_audit_type on audit_summary(audit_type);
create index if not exists idx_audit_summary_store on audit_summary(store_number);

-- audit_details: transaction-level rows
create table if not exists audit_details (
  id uuid default gen_random_uuid() primary key,
  store_number text not null,
  audit_type text not null,
  period_code text not null,
  year int not null,
  period_number int not null,
  business_date date,
  order_placed_at timestamptz,
  event_at timestamptz,
  manager_name text,
  approver_user_id text,
  order_number text,
  order_type text,
  payment_type text,
  amount numeric default 0,
  synced_at timestamptz default now(),
  unique(store_number, order_placed_at, audit_type)
);

create index if not exists idx_audit_details_period on audit_details(period_code);
create index if not exists idx_audit_details_audit_type on audit_details(audit_type);
create index if not exists idx_audit_details_store on audit_details(store_number);
create index if not exists idx_audit_details_manager on audit_details(manager_name);
create index if not exists idx_audit_details_business_date on audit_details(business_date);
create index if not exists idx_audit_details_order_placed on audit_details(order_placed_at);

-- Optional views for comparison (can be computed in API if preferred)
create or replace view period_comparison as
select
  a.store_number,
  a.audit_type,
  a.period_code as current_period,
  a.percent as current_percent,
  a.transactions as current_transactions,
  a.amount as current_amount,
  b.period_code as prev_period,
  b.percent as prev_percent,
  b.transactions as prev_transactions,
  b.amount as prev_amount
from audit_summary a
left join audit_summary b on b.store_number = a.store_number
  and b.audit_type = a.audit_type
  and b.period_number = a.period_number - 1
  and b.year = a.year
  and coalesce(b.week, '') = coalesce(a.week, '')
where a.period_number > 1
union all
select
  a.store_number,
  a.audit_type,
  a.period_code as current_period,
  a.percent as current_percent,
  a.transactions as current_transactions,
  a.amount as current_amount,
  b.period_code as prev_period,
  b.percent as prev_percent,
  b.transactions as prev_transactions,
  b.amount as prev_amount
from audit_summary a
left join audit_summary b on b.store_number = a.store_number
  and b.audit_type = a.audit_type
  and b.period_number = 13
  and b.year = a.year - 1
  and coalesce(b.week, '') = coalesce(a.week, '')
where a.period_number = 1;

create or replace view yoy_comparison as
select
  a.store_number,
  a.audit_type,
  a.period_code as current_period,
  a.year as current_year,
  a.percent as current_percent,
  a.amount as current_amount,
  b.period_code as ly_period,
  b.year as ly_year,
  b.percent as ly_percent,
  b.amount as ly_amount
from audit_summary a
left join audit_summary b on b.store_number = a.store_number
  and b.audit_type = a.audit_type
  and b.period_number = a.period_number
  and b.year = a.year - 1
  and coalesce(b.week, '') = coalesce(a.week, '');
