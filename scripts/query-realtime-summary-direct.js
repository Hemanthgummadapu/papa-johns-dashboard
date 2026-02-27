// Query realtime_summary table directly to see what's actually stored
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function queryTable() {
  console.log('\n=== Querying realtime_summary table ===\n');
  console.log('SQL equivalent: SELECT store_number, scraped_at, total_net_sales, labor_pct');
  console.log('                FROM realtime_summary');
  console.log('                ORDER BY store_number, scraped_at DESC\n');
  
  const { data, error } = await supabase
    .from('realtime_summary')
    .select('store_number, scraped_at, total_net_sales, labor_pct')
    .order('store_number', { ascending: true })
    .order('scraped_at', { ascending: false });
  
  if (error) {
    console.error('❌ Error:', error);
    return;
  }
  
  if (!data || data.length === 0) {
    console.log('⚠️  No data found in realtime_summary table');
    return;
  }
  
  console.log(`✅ Found ${data.length} total records\n`);
  
  // Group by store to show all records per store
  const byStore = {};
  data.forEach(record => {
    const store = record.store_number;
    if (!byStore[store]) {
      byStore[store] = [];
    }
    byStore[store].push(record);
  });
  
  console.log('📊 Records grouped by store_number:\n');
  Object.keys(byStore).sort().forEach(store => {
    console.log(`Store ${store}:`);
    byStore[store].forEach((record, i) => {
      const date = new Date(record.scraped_at).toLocaleString();
      console.log(`  ${i + 1}. scraped_at: ${date}`);
      console.log(`     total_net_sales: $${record.total_net_sales}`);
      console.log(`     labor_pct: ${record.labor_pct}%`);
      console.log('');
    });
  });
  
  console.log('\n📋 Most recent record per store (what API should return):\n');
  Object.keys(byStore).sort().forEach(store => {
    const mostRecent = byStore[store][0]; // First is most recent due to DESC order
    const date = new Date(mostRecent.scraped_at).toLocaleString();
    console.log(`Store ${store}:`);
    console.log(`  scraped_at: ${date}`);
    console.log(`  total_net_sales: $${mostRecent.total_net_sales}`);
    console.log(`  labor_pct: ${mostRecent.labor_pct}%`);
    console.log('');
  });
}

queryTable().catch(console.error);

