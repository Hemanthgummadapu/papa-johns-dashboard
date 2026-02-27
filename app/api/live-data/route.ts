import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  try {
    // Verify environment variables
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    console.log('[live-data] SUPABASE_URL:', url?.slice(0, 40));
    console.log('[live-data] HAS_SERVICE_KEY:', !!serviceKey);

    if (!url || !serviceKey) {
      console.error('[live-data API] Missing Supabase env vars:', {
        hasUrl: !!url,
        hasKey: !!serviceKey,
      });
      return NextResponse.json(
        { success: false, error: 'Missing Supabase configuration', data: [] },
        { status: 500 }
      );
    }

    // Create Supabase client inline for this request
    const supabase = createClient(url, serviceKey, {
      db: { schema: 'public' },
      auth: { persistSession: false },
    });

    // Get the most recent data for each store from live_kpi
    // Query all records ordered by scraped_at DESC, then group by store_number
    console.log('[live-data API] Executing Supabase query on live_kpi...');
    const { data, error: queryError } = await supabase
      .from('live_kpi')
      .select('*')
      .order('scraped_at', { ascending: false });

    console.log('[live-data] query error detail:', JSON.stringify(queryError));
    console.log('[live-data] data:', JSON.stringify(data));
    
    if (queryError) {
      console.error('[live-data API] Query error:', queryError);
      console.error('[live-data API] Error code:', queryError.code);
      console.error('[live-data API] Error message:', queryError.message);
      return NextResponse.json(
        { success: false, error: queryError.message, data: [] },
        { status: 500 }
      );
    }
    
    console.log('[live-data API] Raw data from Supabase:');
    console.log(`  - Type: ${typeof data}`);
    console.log(`  - Is Array: ${Array.isArray(data)}`);
    console.log(`  - Length: ${data?.length || 0}`);
    if (data && data.length > 0) {
      console.log(`  - First record: store_number=${data[0].store_number}, scraped_at=${data[0].scraped_at}`);
      console.log(`  - Sample record keys:`, Object.keys(data[0]));
    }
    
    if (!data || !Array.isArray(data) || data.length === 0) {
      console.log('[live-data API] No data returned - returning empty response');
      return NextResponse.json({
        success: true,
        data: [],
        lastScraped: null
      });
    }
    
    // Get latest record per store using Map
    // Data is already ordered by scraped_at DESC, so first occurrence = most recent
    console.log('[live-data API] Grouping records by store_number...');
    const storeMap = new Map();
    for (const record of data) {
      if (!storeMap.has(record.store_number)) {
        storeMap.set(record.store_number, record);
      }
    }
    const latestPerStore = Array.from(storeMap.values());
    console.log(`[live-data API] Grouped into ${latestPerStore.length} unique stores`);
    
    // Format and return
    console.log('[live-data API] Formatting data...');
    const formattedData = latestPerStore.map(record => ({
      store_number: record.store_number,
      date: record.date,
      total_net_sales: record.total_net_sales,
      ly_net_sales: record.ly_net_sales,
      comp_pct: record.comp_pct,
      online_net_sales: record.online_net_sales || undefined,
      ly_online_net_sales: record.ly_online_net_sales || undefined,
      online_comp_pct: record.online_comp_pct || undefined,
      total_orders: record.total_orders,
      psa_sales: record.psa_sales || undefined,
      ticket_average: record.ticket_average,
      target_food_cost: record.target_food_cost,
      target_food_pct: record.target_food_pct,
      delivery_orders: record.delivery_orders,
      avg_make_time: record.avg_make_time,
      avg_rack_time: record.avg_rack_time,
      otd_time: record.otd_time,
      carryout_pct: record.carryout_pct,
      labor_dollars: record.labor_dollars,
      labor_pct: record.labor_pct,
      orders_to_deliver: record.orders_to_deliver || undefined,
      product_to_make: record.product_to_make || undefined,
      scraped_at: record.scraped_at,
    }));
    
    // Set lastScraped to the most recent scraped_at across all stores
    const lastScraped = latestPerStore.reduce((latest, r) => 
      r.scraped_at > latest ? r.scraped_at : latest, '');
    
    console.log('[live-data API] Final response:');
    console.log(`  - formattedData length: ${formattedData.length}`);
    console.log(`  - lastScraped: ${lastScraped}`);
    if (formattedData.length > 0) {
      console.log(`  - First formatted record:`, {
        store_number: formattedData[0].store_number,
        scraped_at: formattedData[0].scraped_at,
        total_net_sales: formattedData[0].total_net_sales
      });
    }
    
    return NextResponse.json({
      success: true,
      data: formattedData,
      lastScraped: lastScraped || null
    });
  } catch (error: any) {
    console.error('Error in live-data API:', error);
    return NextResponse.json(
      { success: false, error: error.message, data: [] },
      { status: 500 }
    );
  }
}
