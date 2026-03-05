import { scrapeExtranet } from '@/lib/extranet-scraper';

export const dynamic = 'force-dynamic';

// Main cron - runs every 15 minutes for extranet data (called by scraper service with x-api-key)
export async function GET(request: Request) {
  const apiKey = request.headers.get('x-api-key');
  const expectedKey = process.env.SCRAPER_API_KEY;
  if (expectedKey && apiKey !== expectedKey) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

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

