import { exec } from 'child_process'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST() {
  return new Promise<NextResponse>((resolve) => {
    exec(
      'cd /Users/hemanthgummadapu/papa-johns-dashboard && npx tsx scripts/smg-auto-session.ts && node scripts/test-smg-one-store.js',
      { maxBuffer: 10 * 1024 * 1024 },
      (error) => {
        if (error) {
          resolve(NextResponse.json({ success: false, error: error.message }, { status: 500 }))
        } else {
          resolve(NextResponse.json({ success: true }))
        }
      }
    )
  })
}


