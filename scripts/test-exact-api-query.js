import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testQuery() {
  console.log('\n=== Testing Exact API Query ===\n');
  
  // Exact query from API
  const { data: allData, error } = await supabase
    .from('realtime_summary')
    .select('*')
    .order('scraped_at', { ascending: false });
  
  if (error) {
    console.error('❌ Error:', error);
    return;
  }
  
  console.log(`✅ Query returned ${allData?.length || 0} records\n`);
  
  if (!allData || !Array.isArray(allData) || allData.length === 0) {
    console.log('⚠️  No data returned');
    return;
  }
  
  // Group by store_number (exact logic from API)
  const storeMap = new Map();
  for (const record of allData) {
    if (record?.store_number) {
      if (!storeMap.has(record.store_number)) {
        storeMap.set(record.store_number, record);
      }
    }
  }
  
  console.log(`✅ Grouped into ${storeMap.size} stores\n`);
  
  // Show store 2481
  const store2481 = storeMap.get('2481');
  if (store2481) {
    console.log('📊 Store 2481:');
    console.log(`   Scraped At: ${store2481.scraped_at}`);
    console.log(`   Total Net Sales: $${store2481.total_net_sales}`);
    console.log(`   Labor %: ${store2481.labor_pct}%`);
    console.log(`   Date: ${store2481.date}`);
  } else {
    console.log('⚠️  Store 2481 not found in grouped results');
  }
  
  // Show all stores
  console.log('\n📋 All stores in grouped results:');
  Array.from(storeMap.entries()).forEach(([storeNum, record]) => {
    console.log(`   Store ${storeNum}: scraped_at = ${record.scraped_at}, sales = $${record.total_net_sales}`);
  });
}

testQuery().catch(console.error);

