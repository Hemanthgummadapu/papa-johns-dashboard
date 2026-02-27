import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function queryStore2481() {
  console.log('\n=== Querying realtime_summary for Store 2481 ===\n');
  
  const { data, error } = await supabase
    .from('realtime_summary')
    .select('*')
    .eq('store_number', '2481')
    .order('scraped_at', { ascending: false })
    .limit(1)
    .single();
  
  if (error) {
    console.error('❌ Error:', error);
    return;
  }
  
  if (!data) {
    console.log('⚠️  No data found for store 2481');
    return;
  }
  
  console.log('📊 RAW ROW - All Fields and Values:\n');
  console.log(JSON.stringify(data, null, 2));
  
  console.log('\n\n⏰ SCRAPED_AT TIMESTAMP:');
  console.log(`   ${data.scraped_at}`);
  console.log(`   (${new Date(data.scraped_at).toLocaleString()})`);
  
  console.log('\n\n📋 Field-by-Field Breakdown:\n');
  const fields = [
    { key: 'id', label: 'ID' },
    { key: 'store_number', label: 'Store Number' },
    { key: 'date', label: 'Date' },
    { key: 'total_net_sales', label: 'Total Net Sales' },
    { key: 'ly_net_sales', label: 'LY Net Sales' },
    { key: 'comp_pct', label: 'Comp %' },
    { key: 'labor_pct', label: 'Labor %' },
    { key: 'labor_dollars', label: 'Labor Dollars' },
    { key: 'target_food_cost', label: 'Target Food Cost' },
    { key: 'target_food_pct', label: 'Target Food %' },
    { key: 'delivery_orders', label: 'Delivery Orders' },
    { key: 'total_orders', label: 'Total Orders' },
    { key: 'avg_make_time', label: 'Avg Make Time' },
    { key: 'avg_rack_time', label: 'Avg Rack Time' },
    { key: 'otd_time', label: 'OTD Time' },
    { key: 'carryout_pct', label: 'Carryout %' },
    { key: 'ticket_average', label: 'Ticket Average' },
    { key: 'scraped_at', label: 'Scraped At' },
    { key: 'created_at', label: 'Created At' },
  ];
  
  fields.forEach(field => {
    const value = data[field.key];
    console.log(`   ${field.label.padEnd(20)}: ${value !== null && value !== undefined ? value : 'NULL'}`);
  });
}

queryStore2481().catch(console.error);

