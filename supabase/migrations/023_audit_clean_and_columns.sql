-- Clean bad rows from Tableau "Selected Stores" filter
delete from audit_summary where store_number = 'Selected Stores';
delete from audit_details where store_number = 'Selected Stores';

-- Add missing columns to audit_details
alter table audit_details
  add column if not exists approver_name text,
  add column if not exists reason text,
  add column if not exists customer_name text,
  add column if not exists customer_number text,
  add column if not exists order_status text,
  add column if not exists amount_charged numeric,
  add column if not exists tips_amount numeric,
  add column if not exists is_bad_order boolean,
  add column if not exists percentage_voided numeric,
  add column if not exists week text;

-- Ensure approver_user_id, order_number, order_type, payment_type exist (they do in 021)
-- No-op if already present

-- Fix audit_summary unique constraint: one row per store + period + audit_type (drop week from key)
alter table audit_summary
  drop constraint if exists audit_summary_store_number_period_code_week_audit_type_key;

alter table audit_summary
  add constraint audit_summary_unique unique (store_number, period_code, audit_type);
