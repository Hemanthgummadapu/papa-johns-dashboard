-- Create a function to get the most recent record per store using DISTINCT ON
-- This guarantees we get the single most recent row per store_number
-- SQL equivalent: SELECT DISTINCT ON (store_number) * FROM realtime_summary ORDER BY store_number, scraped_at DESC
CREATE OR REPLACE FUNCTION get_latest_realtime_data()
RETURNS SETOF realtime_summary AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT ON (store_number) *
  FROM realtime_summary
  ORDER BY store_number, scraped_at DESC;
END;
$$ LANGUAGE plpgsql;

