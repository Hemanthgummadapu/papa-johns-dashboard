// Test the API query directly to see what's happening
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testAPIQuery() {
  console.log('\n=== Testing API Query Logic ===\n');
  
  // Simulate the exact API query
  const { data, error } = await supabase
    .from('realtime_summary')
    .select('*')
    .order('scraped_at', { ascending: false });
  
  if (error) {
    console.error('❌ Query error:', error);
    return;
  }
  
  console.log(`✅ Query returned ${data?.length || 0} records\n`);
  
  if (!data || data.length === 0) {
    console.log('⚠️  No data returned');
    return;
  }
  
  // Simulate the grouping logic
  const storeMap = new Map();
  for (const record of data) {
    if (!storeMap.has(record.store_number)) {
      storeMap.set(record.store_number, record);
    }
  }
  const latestPerStore = Array.from(storeMap.values());
  
  console.log(`✅ Grouped into ${latestPerStore.length} stores\n`);
  
  // Calculate lastScraped
  const lastScraped = latestPerStore.reduce((latest, r) => 
    r.scraped_at > latest ? r.scraped_at : latest, '');
  
  console.log('📊 Results:');
  latestPerStore.forEach(store => {
    console.log(`  Store ${store.store_number}: scraped_at = ${store.scraped_at}, sales = $${store.total_net_sales}`);
  });
  
  console.log(`\n✅ Last Scraped: ${lastScraped}`);
}

testAPIQuery().catch(console.error);

