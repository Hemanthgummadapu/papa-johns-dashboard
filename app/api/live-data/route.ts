import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Disable all caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    // Verify environment variables
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !serviceKey) {
      return NextResponse.json(
        { success: false, error: 'Missing Supabase configuration', data: [] },
        { 
          status: 500,
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate',
            'Pragma': 'no-cache'
          }
        }
      );
    }

    // Create Supabase client inline for this request
    const supabase = createClient(url, serviceKey, {
      db: { schema: 'public' },
      auth: { persistSession: false },
    });

    // Get the most recent data for each store from live_kpi
    const { data, error: queryError } = await supabase
      .from('live_kpi')
      .select('*')
      .order('scraped_at', { ascending: false })
      .limit(100);

    if (queryError) {
      return NextResponse.json(
        { success: false, error: queryError.message, data: [] },
        { 
          status: 500,
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate',
            'Pragma': 'no-cache'
          }
        }
      );
    }
    
    if (!data || !Array.isArray(data) || data.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        lastScraped: null
      }, {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          'Pragma': 'no-cache'
        }
      });
    }
    
    // Get latest per store - data is DESC so first occurrence = most recent
    const storeMap = new Map();
    for (const record of data) {
      if (!storeMap.has(record.store_number)) {
        storeMap.set(record.store_number, record);
      }
    }
    const latestPerStore = Array.from(storeMap.values());
    
    // Format and return
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
    
    return NextResponse.json({
      success: true,
      data: formattedData,
      lastScraped: lastScraped || null
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache'
      }
    });
  } catch (error: any) {
    console.error('Error in live-data API:', error);
    return NextResponse.json(
      { success: false, error: error.message, data: [] },
      { 
        status: 500,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          'Pragma': 'no-cache'
        }
      }
    );
  }
}
