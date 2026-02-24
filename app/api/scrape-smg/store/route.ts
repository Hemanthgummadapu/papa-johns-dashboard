// SMG Guest Experience scraping is temporarily disabled
export async function POST() {
  return Response.json({
    success: false,
    error: 'SMG Guest Experience scraping is temporarily unavailable',
    message: 'This feature has been disabled'
  }, { status: 503 });
}
