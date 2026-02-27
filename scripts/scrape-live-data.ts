import { scrapeExtranet } from '../lib/extranet-scraper';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function scrapeAndSave() {
  try {
    console.log('=== Starting live data scrape ===');
    const storeData = await scrapeExtranet();
    
    console.log(`✅ Scraped ${storeData.length} stores`);
    
    // Save to Supabase (live_kpi table)
    const today = new Date().toISOString().split('T')[0];
    
    for (const store of storeData) {
      // Build data object with only fields that exist in live_kpi
      // Convert percentage strings to numeric where needed
      const parsePct = (value: string | number | null | undefined): number | null => {
        if (value === null || value === undefined) return null;
        if (typeof value === 'number') return value;
        const cleaned = value.replace('%', '').replace('+', '').trim();
        const num = parseFloat(cleaned);
        return Number.isNaN(num) ? null : num;
      };

      const dataToSave: any = {
        store_number: store.store_number,
        date: today,
        total_net_sales: store.total_net_sales,
        ly_net_sales: store.ly_net_sales,
        comp_pct: parsePct(store.comp_pct as any),
        labor_pct: store.labor_pct,
        labor_dollars: store.labor_dollars,
        target_food_cost: store.target_food_cost,
        delivery_orders: store.delivery_orders,
        total_orders: store.total_orders,
        avg_make_time: store.avg_make_time,
        avg_rack_time: store.avg_rack_time,
        otd_time: store.otd_time,
        carryout_pct: parsePct(store.carryout_pct as any),
        ticket_average: store.ticket_average,
        online_net_sales: (store as any).online_net_sales ?? null,
        scraped_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('live_kpi')
        .insert(dataToSave);

      if (error) {
        console.error(`❌ Error saving store ${store.store_number}:`, error.message);
      } else {
        console.log(`✅ Saved store ${store.store_number} to live_kpi`);
      }
    }
    
    console.log(`✅ Live data scrape completed - ${storeData.length} stores saved`);
  } catch (error: any) {
    console.error('❌ Live data scrape failed:', error.message);
    process.exit(1);
  }
}

scrapeAndSave();

