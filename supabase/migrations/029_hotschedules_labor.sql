-- HotSchedules labor data from Tableau (Hotschedules-Store Level view)
CREATE TABLE IF NOT EXISTS hotschedules_labor (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  store_number text NOT NULL,
  week text NOT NULL,
  week_bd text NOT NULL,
  instore_scheduled_hours numeric DEFAULT 0,
  instore_actual_hours numeric DEFAULT 0,
  instore_forecasted_hours numeric DEFAULT 0,
  manager_scheduled_hours numeric DEFAULT 0,
  manager_actual_hours numeric DEFAULT 0,
  manager_forecasted_hours numeric DEFAULT 0,
  driver_scheduled_hours numeric DEFAULT 0,
  driver_actual_hours numeric DEFAULT 0,
  driver_forecasted_hours numeric DEFAULT 0,
  total_scheduled_hours numeric GENERATED ALWAYS AS
    (instore_scheduled_hours + manager_scheduled_hours + driver_scheduled_hours) STORED,
  total_actual_hours numeric GENERATED ALWAYS AS
    (instore_actual_hours + manager_actual_hours + driver_actual_hours) STORED,
  synced_at timestamptz DEFAULT now(),
  UNIQUE(store_number, week)
);
