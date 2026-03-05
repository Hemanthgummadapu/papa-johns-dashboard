export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json({
    hasScraperKey: !!process.env.SCRAPER_API_KEY,
    keyLength: process.env.SCRAPER_API_KEY?.length,
    keyFirst5: process.env.SCRAPER_API_KEY?.substring(0, 5),
  });
}
