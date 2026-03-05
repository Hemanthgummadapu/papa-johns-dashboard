-- Add optimal hours columns for HotSchedules labor
ALTER TABLE hotschedules_labor
ADD COLUMN IF NOT EXISTS instore_optimal_hours numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS manager_optimal_hours numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS driver_optimal_hours numeric DEFAULT 0;
