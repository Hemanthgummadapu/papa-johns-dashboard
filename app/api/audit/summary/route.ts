import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseAdminClient()
    const { searchParams } = new URL(req.url)
    const time_period = searchParams.get('time_period')
    const audit_type = searchParams.get('audit_type')
    const store = searchParams.get('store')
    const year = searchParams.get('year')

    let query = supabase.from('audit_summary').select('*').order('store_number')
    if (time_period) query = query.eq('time_period_label', time_period)
    if (audit_type) query = query.eq('audit_type', audit_type)
    if (store) query = query.eq('store_number', store)
    if (year) query = query.eq('year', parseInt(year, 10))

    const { data, error } = await query
    if (error) throw error
    return NextResponse.json({ data: data ?? [], count: data?.length ?? 0 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
