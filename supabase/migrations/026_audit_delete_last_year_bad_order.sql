-- One-time cleanup: remove last_year bad_order and zeroed_out rows so they can be
-- re-uploaded in one go (bad orders: fixed parser dedup; zeroed out: fresh load).
DELETE FROM audit_details
WHERE time_period_label = 'last_year'
  AND audit_type IN ('bad_order', 'zeroed_out');
