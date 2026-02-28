import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data, error } = await supabase
      .from('scraper_status')
      .select('*')
      .in('id', ['live_kpi', 'smg'])

    if (error) {
      console.error('[scraper-status] Supabase error:', error)
      return NextResponse.json({ live: null, smg: null })
    }

    const live = data?.find((r) => r.id === 'live_kpi') ?? null
    const smg = data?.find((r) => r.id === 'smg') ?? null

    return NextResponse.json({ live, smg })
  } catch (err: any) {
    console.error('[scraper-status] Error:', err)
    return NextResponse.json({ live: null, smg: null })
  }
}
