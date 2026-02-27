import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debugQuery() {
  console.log('\n=== Debugging API Query Logic ===\n');
  
  // Simulate what the API does
  console.log('1. Current API query:');
  console.log('   .from("realtime_summary")');
  console.log('   .select("*")');
  console.log('   .order("scraped_at", { ascending: false })');
  console.log('   .limit(100)');
  console.log('');
  
  const { data, error } = await supabase
    .from('realtime_summary')
    .select('*')
    .order('scraped_at', { ascending: false })
    .limit(100);
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log(`2. Query returned ${data?.length || 0} total records\n`);
  
  // Show what the grouping logic does
  console.log('3. Grouping by store_number (current logic):');
  const storeMap = new Map();
  if (data) {
    for (const record of data) {
      if (record?.store_number) {
        if (!storeMap.has(record.store_number)) {
          storeMap.set(record.store_number, record);
          console.log(`   Store ${record.store_number}: First record found with scraped_at = ${record.scraped_at}`);
        }
      }
    }
  }
  
  console.log('\n4. Store 2481 in grouped results:');
  const store2481 = storeMap.get('2481');
  if (store2481) {
    console.log(`   Scraped At: ${store2481.scraped_at}`);
    console.log(`   Total Net Sales: $${store2481.total_net_sales}`);
    console.log(`   Labor %: ${store2481.labor_pct}%`);
  } else {
    console.log('   Not found in grouped results');
  }
  
  // Show all records for 2481 in the query result
  console.log('\n5. All records for store 2481 in query result:');
  const store2481Records = data?.filter(r => r.store_number === '2481') || [];
  store2481Records.forEach((r, i) => {
    console.log(`   Record ${i + 1}: scraped_at = ${r.scraped_at}, sales = $${r.total_net_sales}, labor = ${r.labor_pct}%`);
  });
  
  // Better approach: Get most recent per store using a subquery approach
  console.log('\n6. Better approach: Get most recent per store');
  console.log('   We need to use a different query strategy...');
}

debugQuery().catch(console.error);

