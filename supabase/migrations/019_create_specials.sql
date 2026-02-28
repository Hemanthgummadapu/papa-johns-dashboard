-- Specials: active and past promotions to track impact
CREATE TABLE IF NOT EXISTS specials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('doordash', 'ubereats', 'pj_carryout', 'pj_delivery')),
  store_ids TEXT[] NOT NULL DEFAULT '{}',
  start_date DATE NOT NULL,
  end_date DATE,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'stopped')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- History of actions on each special
CREATE TABLE IF NOT EXISTS specials_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  special_id UUID NOT NULL REFERENCES specials(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('started', 'paused', 'stopped', 'extended')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_specials_status ON specials(status);
CREATE INDEX IF NOT EXISTS idx_specials_start_date ON specials(start_date);
CREATE INDEX IF NOT EXISTS idx_specials_history_special_id ON specials_history(special_id);

-- RLS: allow anon/service to read and write for dashboard (adjust as needed for auth)
ALTER TABLE specials ENABLE ROW LEVEL SECURITY;
ALTER TABLE specials_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for specials" ON specials FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for specials_history" ON specials_history FOR ALL USING (true) WITH CHECK (true);
