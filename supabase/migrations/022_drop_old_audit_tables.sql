-- Drop old per-type audit tables; unified schema uses audit_summary and audit_details only.
-- Safe to run: tables are empty (no data synced yet).

drop table if exists bad_order_summary;
drop table if exists zeroed_out_summary;
drop table if exists canceled_order_summary;
drop table if exists refund_order_summary;
