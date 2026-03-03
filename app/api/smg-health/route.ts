// SMG Guest Experience health check is temporarily disabled
export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json({
    success: false,
    error: 'SMG Guest Experience is temporarily unavailable',
    message: 'This feature has been disabled'
  }, { status: 503 });
}
