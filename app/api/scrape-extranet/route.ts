import { scrapeExtranet } from '@/lib/extranet-scraper';
import { setCachedData } from '@/lib/store-cache';
import { getSupabaseAdminClient } from '@/lib/db';

export async function GET() {
  try {
    console.log('Starting extranet scrape...');
    const storeData = await scrapeExtranet();
    
    // Save to cache
    setCachedData(storeData);
    
    // Save to Supabase
    try {
      const supabaseAdmin = getSupabaseAdminClient();
      const today = new Date().toISOString().split('T')[0];
      
      // Upsert each store's data
      for (const store of storeData) {
        // Build data object with only fields that exist in the table (migration 016 may not be run)
        // Only include fields that definitely exist in the base table
        const dataToSave: any = {
          store_number: store.store_number,
          date: today,
          total_net_sales: store.total_net_sales,
          ly_net_sales: store.ly_net_sales,
          comp_pct: store.comp_pct,
          labor_pct: store.labor_pct,
          labor_dollars: store.labor_dollars,
          target_food_cost: store.target_food_cost,
          target_food_pct: store.target_food_pct,
          delivery_orders: store.delivery_orders,
          total_orders: store.total_orders,
          avg_make_time: store.avg_make_time,
          avg_rack_time: store.avg_rack_time,
          otd_time: store.otd_time,
          carryout_pct: store.carryout_pct,
          ticket_average: store.ticket_average,
          scraped_at: new Date().toISOString(),
        };
        
        // Note: Optional fields from migration 016 are not included here
        // Run migration 016 to add: online_net_sales, ly_online_net_sales, online_comp_pct, 
        // psa_sales, orders_to_deliver, product_to_make
        
        const { error } = await supabaseAdmin
          .from('realtime_summary')
          .upsert(dataToSave, {
            onConflict: 'store_number,date'
          });
        
        if (error) {
          console.error(`❌ Error saving store ${store.store_number} to Supabase:`, error.message);
          console.error('Error details:', JSON.stringify(error, null, 2));
        } else {
          console.log(`✅ Saved store ${store.store_number} to Supabase`);
        }
      }
      
      console.log(`✅ Saved ${storeData.length} stores to Supabase`);
    } catch (dbError: any) {
      console.error('Error saving to Supabase (non-fatal):', dbError.message);
      // Don't fail the request if DB save fails
    }
    
    return Response.json({ 
      success: true, 
      stores: storeData.length,
      data: storeData 
    });
  } catch (error: any) {
    console.error('Scrape error:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}

