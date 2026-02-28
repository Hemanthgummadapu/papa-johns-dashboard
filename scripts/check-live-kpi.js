#!/usr/bin/env node
/**
 * Query live_kpi table and show what's in the DB
 */
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(url, key, {
  db: { schema: 'public' },
  auth: { persistSession: false },
});

async function main() {
  const { data, error } = await supabase
    .from('live_kpi')
    .select('*')
    .order('scraped_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('Query error:', error);
    process.exit(1);
  }

  console.log('\n=== live_kpi table ===');
  console.log('Total rows returned:', data?.length ?? 0);
  console.log('');

  if (!data || data.length === 0) {
    console.log('No rows in live_kpi.');
    return;
  }

  // Group by store, show latest per store
  const byStore = {};
  for (const row of data) {
    const sn = row.store_number;
    if (!byStore[sn]) byStore[sn] = [];
    byStore[sn].push(row);
  }

  console.log('--- Latest record per store ---\n');
  for (const [storeNum, rows] of Object.entries(byStore)) {
    const latest = rows[0];
    console.log(`Store ${storeNum}:`);
    console.log('  scraped_at:', latest.scraped_at);
    console.log('  date:', latest.date);
    console.log('  total_net_sales:', latest.total_net_sales);
    console.log('  ly_net_sales:', latest.ly_net_sales);
    console.log('  comp_pct:', latest.comp_pct);
    console.log('  labor_pct:', latest.labor_pct);
    console.log('  labor_dollars:', latest.labor_dollars);
    console.log('  delivery_orders:', latest.delivery_orders);
    console.log('  carryout_pct:', latest.carryout_pct);
    console.log('  target_food_cost:', latest.target_food_cost);
    console.log('  otd_time:', latest.otd_time);
    console.log('  avg_make_time:', latest.avg_make_time);
    console.log('');
  }

  console.log('--- All scraped_at timestamps (newest first) ---');
  const timestamps = [...new Set(data.map((r) => r.scraped_at))];
  timestamps.slice(0, 10).forEach((t) => console.log(' ', t));
  if (timestamps.length > 10) console.log('  ... and', timestamps.length - 10, 'more');
}

main().catch(console.error);


 * Query live_kpi table and show what's in the DB
 */
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(url, key, {
  db: { schema: 'public' },
  auth: { persistSession: false },
});

async function main() {
  const { data, error } = await supabase
    .from('live_kpi')
    .select('*')
    .order('scraped_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('Query error:', error);
    process.exit(1);
  }

  console.log('\n=== live_kpi table ===');
  console.log('Total rows returned:', data?.length ?? 0);
  console.log('');

  if (!data || data.length === 0) {
    console.log('No rows in live_kpi.');
    return;
  }

  // Group by store, show latest per store
  const byStore = {};
  for (const row of data) {
    const sn = row.store_number;
    if (!byStore[sn]) byStore[sn] = [];
    byStore[sn].push(row);
  }

  console.log('--- Latest record per store ---\n');
  for (const [storeNum, rows] of Object.entries(byStore)) {
    const latest = rows[0];
    console.log(`Store ${storeNum}:`);
    console.log('  scraped_at:', latest.scraped_at);
    console.log('  date:', latest.date);
    console.log('  total_net_sales:', latest.total_net_sales);
    console.log('  ly_net_sales:', latest.ly_net_sales);
    console.log('  comp_pct:', latest.comp_pct);
    console.log('  labor_pct:', latest.labor_pct);
    console.log('  labor_dollars:', latest.labor_dollars);
    console.log('  delivery_orders:', latest.delivery_orders);
    console.log('  carryout_pct:', latest.carryout_pct);
    console.log('  target_food_cost:', latest.target_food_cost);
    console.log('  otd_time:', latest.otd_time);
    console.log('  avg_make_time:', latest.avg_make_time);
    console.log('');
  }

  console.log('--- All scraped_at timestamps (newest first) ---');
  const timestamps = [...new Set(data.map((r) => r.scraped_at))];
  timestamps.slice(0, 10).forEach((t) => console.log(' ', t));
  if (timestamps.length > 10) console.log('  ... and', timestamps.length - 10, 'more');
}

main().catch(console.error);

