import { scrapeExtranet } from '@/lib/extranet-scraper';

export const dynamic = 'force-dynamic';

// Main cron - runs every 15 minutes for extranet data (API key check temporarily removed for debugging)
export async function GET() {
  try {
    const storeData = await scrapeExtranet();
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

