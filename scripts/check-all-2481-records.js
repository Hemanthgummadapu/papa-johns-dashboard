import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkAllRecords() {
  console.log('\n=== All records for Store 2481 ===\n');
  
  const { data, error } = await supabase
    .from('realtime_summary')
    .select('*')
    .eq('store_number', '2481')
    .order('scraped_at', { ascending: false });
  
  if (error) {
    console.error('❌ Error:', error);
    return;
  }
  
  if (!data || data.length === 0) {
    console.log('⚠️  No records found');
    return;
  }
  
  console.log(`Found ${data.length} record(s) for store 2481:\n`);
  
  data.forEach((record, index) => {
    console.log(`--- Record ${index + 1} (Most Recent: ${index === 0 ? '✅' : ''}) ---`);
    console.log(`Scraped At: ${record.scraped_at}`);
    console.log(`Date: ${record.date}`);
    console.log(`Total Net Sales: $${record.total_net_sales}`);
    console.log(`LY Net Sales: $${record.ly_net_sales}`);
    console.log(`Comp %: ${record.comp_pct}`);
    console.log(`Labor %: ${record.labor_pct}%`);
    console.log(`Labor Dollars: $${record.labor_dollars}`);
    console.log(`OTD Time: ${record.otd_time}`);
    console.log('');
  });
}

checkAllRecords().catch(console.error);

