// SMG Guest Experience debugging is temporarily disabled
export async function GET() {
  return Response.json({
    success: false,
    error: 'SMG Guest Experience is temporarily unavailable',
    message: 'This feature has been disabled'
  }, { status: 503 });
}
