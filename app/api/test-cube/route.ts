import { discoverMeasures } from '@/lib/cube';

export async function GET() {
  try {
    const result = await discoverMeasures();
    return Response.json({ success: true, data: result });
  } catch (error: any) {
    return Response.json({ 
      success: false, 
      error: error.message,
      status: error.response?.status,
      details: error.response?.data
    }, { status: 500 });
  }
}




