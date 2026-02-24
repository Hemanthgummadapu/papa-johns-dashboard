import { scrapeExtranet } from '@/lib/extranet-scraper';
import { setCachedData } from '@/lib/store-cache';

export async function GET() {
  try {
    console.log('Starting extranet scrape...');
    const storeData = await scrapeExtranet();
    
    // Save to cache
    setCachedData(storeData);
    
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

