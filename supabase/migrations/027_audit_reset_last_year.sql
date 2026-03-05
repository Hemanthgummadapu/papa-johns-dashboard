-- Full reset of last_year audit_details so all last_year CSVs can be re-uploaded fresh.
-- Run this once, then re-upload all last_year CSVs (Bad Order, Zeroed Out, etc.).
DELETE FROM audit_details
WHERE time_period_label = 'last_year';
