import { scrapeExtranet } from '@/lib/extranet-scraper';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const parsePct = (value: any): number | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return value;
  const cleaned = String(value).replace('%', '').replace('+', '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
};

// Main cron - runs every 15 minutes for extranet data (called by scraper service with x-api-key)
export async function GET(request: Request) {
  const apiKey = request.headers.get('x-api-key');
  const expectedKey = process.env.SCRAPER_API_KEY;
  if (expectedKey && apiKey !== expectedKey) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const storeData = await scrapeExtranet();

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const today = new Date().toISOString().split('T')[0];

    for (const store of storeData) {
      const { error } = await supabase
        .from('live_kpi')
        .insert({
          store_number: store.store_number,
          date: today,
          total_net_sales: store.total_net_sales,
          ly_net_sales: store.ly_net_sales,
          comp_pct: parsePct(store.comp_pct),
          labor_pct: store.labor_pct,
          labor_dollars: store.labor_dollars,
          target_food_cost: store.target_food_cost,
          delivery_orders: store.delivery_orders,
          total_orders: store.total_orders,
          avg_make_time: store.avg_make_time,
          avg_rack_time: store.avg_rack_time,
          otd_time: store.otd_time,
          carryout_pct: parsePct(store.carryout_pct),
          ticket_average: store.ticket_average,
          online_net_sales: (store as any).online_net_sales ?? null,
          scraped_at: new Date().toISOString(),
        });
      if (error) console.error(`Error saving store ${store.store_number}:`, error.message);
      else console.log(`✅ Saved store ${store.store_number} to live_kpi`);
    }

    return Response.json({
      success: true,
      stores: storeData.length,
      message: 'Extranet scrape completed successfully'
    });
  } catch (error: any) {
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

