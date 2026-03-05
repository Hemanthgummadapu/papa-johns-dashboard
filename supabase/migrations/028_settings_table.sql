-- Key-value store for app settings (e.g. extranet session state for Railway)
create table if not exists settings (
  key text primary key,
  value text,
  updated_at timestamptz default now()
);
