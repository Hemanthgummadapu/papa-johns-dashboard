import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseAdminClient()
    const { searchParams } = new URL(req.url)
    const period = searchParams.get('period')
    const store = searchParams.get('store')

    let query = supabase.from('period_comparison').select('*')
    if (period) query = query.eq('current_period', period)
    if (store) query = query.eq('store_number', store)

    const { data, error } = await query
    if (error) throw error
    const rows = (data ?? []) as Array<{
      current_percent?: number | null
      prev_percent?: number | null
      [k: string]: unknown
    }>
    const withChange = rows.map((r) => {
      const curr = Number(r.current_percent) || 0
      const prev = Number(r.prev_percent) ?? null
      const percent_change =
        prev != null && prev !== 0 ? ((curr - prev) / prev) * 100 : null
      return { ...r, percent_change }
    })
    return NextResponse.json({ data: withChange })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
