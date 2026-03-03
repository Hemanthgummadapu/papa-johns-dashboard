import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!url || !serviceKey) {
      console.error('[scraper-status] Missing Supabase configuration')
      return NextResponse.json(
        { live: null, smg: null, session_expired: false },
        { status: 500 }
      )
    }

    const supabase = createClient(url, serviceKey, {
      db: { schema: 'public' },
      auth: { persistSession: false },
    })

    const { data, error } = await supabase
      .from('scraper_status')
      .select('*')
      .in('id', ['live_kpi', 'smg'])

    if (error) {
      console.error('[scraper-status] Supabase error:', error)
      return NextResponse.json({ live: null, smg: null, session_expired: false })
    }

    const live = data?.find((r) => r.id === 'live_kpi') ?? null
    const smg = data?.find((r) => r.id === 'smg') ?? null

    const sessionExpired =
      (live && (live as any).session_expired === true) ||
      (smg && (smg as any).session_expired === true)

    return NextResponse.json({ live, smg, session_expired: sessionExpired })
  } catch (err: any) {
    console.error('[scraper-status] Error:', err)
    return NextResponse.json({ live: null, smg: null, session_expired: false })
  }
}
