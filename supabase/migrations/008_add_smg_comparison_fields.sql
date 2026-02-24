-- Add comparison fields for "How are we doing?" section
ALTER TABLE smg_scores ADD COLUMN IF NOT EXISTS osat_vs_last_period text;
ALTER TABLE smg_scores ADD COLUMN IF NOT EXISTS osat_papa_johns_score numeric;
ALTER TABLE smg_scores ADD COLUMN IF NOT EXISTS osat_vs_papa_johns text;
ALTER TABLE smg_scores ADD COLUMN IF NOT EXISTS accuracy_vs_last_period text;
ALTER TABLE smg_scores ADD COLUMN IF NOT EXISTS accuracy_papa_johns_score numeric;
ALTER TABLE smg_scores ADD COLUMN IF NOT EXISTS accuracy_vs_papa_johns text;
ALTER TABLE smg_scores ADD COLUMN IF NOT EXISTS wait_time_vs_last_period text;
ALTER TABLE smg_scores ADD COLUMN IF NOT EXISTS wait_time_papa_johns_score numeric;
ALTER TABLE smg_scores ADD COLUMN IF NOT EXISTS wait_time_vs_papa_johns text;
ALTER TABLE smg_scores ADD COLUMN IF NOT EXISTS taste_vs_last_period text;
ALTER TABLE smg_scores ADD COLUMN IF NOT EXISTS taste_papa_johns_score numeric;
ALTER TABLE smg_scores ADD COLUMN IF NOT EXISTS taste_vs_papa_johns text;
ALTER TABLE smg_scores ADD COLUMN IF NOT EXISTS driver_vs_last_period text;
ALTER TABLE smg_scores ADD COLUMN IF NOT EXISTS driver_papa_johns_score numeric;
ALTER TABLE smg_scores ADD COLUMN IF NOT EXISTS driver_vs_papa_johns text;
ALTER TABLE smg_scores ADD COLUMN IF NOT EXISTS focus_alerts text;


