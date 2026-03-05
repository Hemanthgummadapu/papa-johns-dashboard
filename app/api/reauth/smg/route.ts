import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST() {
  return NextResponse.json({
    success: false,
    message: 'SMG reauth must be done locally — run: npx tsx scripts/smg-auto-session.ts',
  }, { status: 400 })
}
