// SMG Guest Experience data is temporarily unavailable
export async function GET() {
  return Response.json({
    success: false,
    error: 'SMG Guest Experience data is temporarily unavailable',
    stores: [],
    last_scraped: null
  }, { status: 503 });
}
