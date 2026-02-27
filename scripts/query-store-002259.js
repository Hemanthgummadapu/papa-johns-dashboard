import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { readFileSync } from 'fs';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function queryStore() {
  const storeId = '002259';
  
  console.log(`\n=== Querying SMG Scores for Store ${storeId} ===\n`);
  
  const { data, error } = await supabase
    .from('smg_scores')
    .select('*')
    .eq('store_id', storeId)
    .order('scraped_at', { ascending: false })
    .limit(1);

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  if (!data || data.length === 0) {
    console.log('⚠️  No data found for store', storeId);
    return;
  }

  const record = data[0];
  
  // Build focus object
  const focus = {
    accuracy_current: record.focus_accuracy_current,
    accuracy_vs_previous: record.focus_accuracy_vs_previous,
    wait_time_current: record.focus_wait_time_current,
    wait_time_vs_previous: record.focus_wait_time_vs_previous,
  };

  // Build doing object
  const doing = {
    osat: {
      my_score: record.osat_my_score,
      vs_last_period: record.osat_vs_last_period,
      pj_score: record.osat_pj_score,
      my_score_vs_pj: record.osat_vs_pj,
    },
    accuracy: {
      my_score: record.accuracy_my_score,
      vs_last_period: record.accuracy_vs_last_period,
      pj_score: record.accuracy_pj_score,
      my_score_vs_pj: record.accuracy_vs_pj,
    },
    csc: {
      my_score: record.csc_my_score,
      vs_last_period: record.csc_vs_last_period,
      pj_score: record.csc_pj_score,
      my_score_vs_pj: record.csc_vs_pj,
    },
    comp_orders: {
      my_score: record.comp_orders_my_score,
      vs_last_period: record.comp_orders_vs_last_period,
      pj_score: record.comp_orders_pj_score,
      my_score_vs_pj: record.comp_orders_vs_pj,
    },
    comp_sales: {
      my_score: record.comp_sales_my_score,
      vs_last_period: record.comp_sales_vs_last_period,
      pj_score: record.comp_sales_pj_score,
      my_score_vs_pj: record.comp_sales_vs_pj,
    },
  };

  console.log('📊 FOCUS OBJECT:');
  console.log(JSON.stringify(focus, null, 2));
  
  console.log('\n📊 DOING OBJECT:');
  console.log(JSON.stringify(doing, null, 2));
  
  console.log('\n📋 FULL RECORD (all fields):');
  console.log(JSON.stringify(record, null, 2));
  
  console.log(`\n✅ Scraped at: ${record.scraped_at}`);
  console.log(`✅ Period: ${record.period}`);
}

queryStore().catch(console.error);

