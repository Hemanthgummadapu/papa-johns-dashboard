-- Add Papa John's benchmark fields from ranking table
ALTER TABLE smg_scores ADD COLUMN IF NOT EXISTS pj_osat numeric;
ALTER TABLE smg_scores ADD COLUMN IF NOT EXISTS pj_taste numeric;
ALTER TABLE smg_scores ADD COLUMN IF NOT EXISTS pj_accuracy numeric;
ALTER TABLE smg_scores ADD COLUMN IF NOT EXISTS pj_wait_time numeric;
ALTER TABLE smg_scores ADD COLUMN IF NOT EXISTS pj_driver numeric;

-- Update existing comparison fields to be numeric instead of text where appropriate
-- osat_vs_last_period and osat_vs_papa_johns should be numeric (they're deltas like +6.7, +2.9)
-- PostgreSQL can cast strings with +/- signs directly to numeric
ALTER TABLE smg_scores ALTER COLUMN osat_vs_last_period TYPE numeric USING 
  CASE 
    WHEN osat_vs_last_period IS NULL THEN NULL
    ELSE osat_vs_last_period::numeric
  END;

ALTER TABLE smg_scores ALTER COLUMN osat_vs_papa_johns TYPE numeric USING 
  CASE 
    WHEN osat_vs_papa_johns IS NULL THEN NULL
    ELSE osat_vs_papa_johns::numeric
  END;

ALTER TABLE smg_scores ALTER COLUMN accuracy_vs_last_period TYPE numeric USING 
  CASE 
    WHEN accuracy_vs_last_period IS NULL THEN NULL
    ELSE accuracy_vs_last_period::numeric
  END;

ALTER TABLE smg_scores ALTER COLUMN accuracy_vs_papa_johns TYPE numeric USING 
  CASE 
    WHEN accuracy_vs_papa_johns IS NULL THEN NULL
    ELSE accuracy_vs_papa_johns::numeric
  END;

-- Add computed fields (taste_vs_papa_johns, wait_time_vs_papa_johns, driver_vs_papa_johns)
ALTER TABLE smg_scores ADD COLUMN IF NOT EXISTS taste_vs_papa_johns numeric;
ALTER TABLE smg_scores ADD COLUMN IF NOT EXISTS wait_time_vs_papa_johns numeric;
ALTER TABLE smg_scores ADD COLUMN IF NOT EXISTS driver_vs_papa_johns numeric;

