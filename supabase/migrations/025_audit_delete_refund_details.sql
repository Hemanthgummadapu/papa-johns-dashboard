-- One-time cleanup: remove refund detail rows so they can be re-uploaded
-- with the fixed parser (dedup + correct Amount Refunded column).
DELETE FROM audit_details
WHERE audit_type = 'refund';
