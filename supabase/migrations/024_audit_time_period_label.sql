-- Add time_period_label so we know which sync pulled each row
-- Values: 'current_period' | 'last_period' | 'last_year'
alter table audit_summary
  add column if not exists time_period_label text;

alter table audit_details
  add column if not exists time_period_label text;

-- Drop the old unique constraint and replace
alter table audit_summary
  drop constraint if exists audit_summary_unique;

alter table audit_summary
  add constraint audit_summary_unique
  unique (store_number, audit_type, time_period_label);
