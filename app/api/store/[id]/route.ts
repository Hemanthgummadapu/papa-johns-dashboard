import { getStoreData } from '@/lib/store-cache';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const data = getStoreData(params.id);
  if (!data) return NextResponse.json({ error: 'Store not found or not yet scraped' }, { status: 404 });
  return NextResponse.json(data);
}



