// SMG Guest Experience scraping is temporarily disabled (called by scraper service with x-api-key)
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const apiKey = request.headers.get('x-api-key');
  const expectedKey = process.env.SCRAPER_API_KEY;
  if (expectedKey && apiKey !== expectedKey) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return Response.json({
    success: false,
    error: 'SMG Guest Experience scraping is temporarily unavailable',
    message: 'This feature has been disabled'
  }, { status: 503 });
}
