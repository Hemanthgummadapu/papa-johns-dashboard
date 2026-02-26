create table if not exists smg_comments (
  id uuid default gen_random_uuid() primary key,
  comment_id text unique not null,
  store_id text not null,
  comment_date date,
  survey_type text,
  category text,
  comment_text text,
  scraped_at timestamptz default now()
);

create index if not exists smg_comments_store_id_idx on smg_comments(store_id);
create index if not exists smg_comments_comment_date_idx on smg_comments(comment_date desc);

