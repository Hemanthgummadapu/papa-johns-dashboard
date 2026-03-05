import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/db'

export const dynamic = 'force-dynamic'

const LIMIT = 500

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseAdminClient()
    const { searchParams } = new URL(req.url)
    const time_period = searchParams.get('time_period')
    const audit_type = searchParams.get('audit_type')
    const store = searchParams.get('store')
    const manager = searchParams.get('manager')
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const page = Math.max(0, parseInt(searchParams.get('page') || '0', 10))
    const offset = page * LIMIT

    let query = supabase
      .from('audit_details')
      .select('*', { count: 'exact' })
      .order('business_date', { ascending: false })
      .range(offset, offset + LIMIT - 1)

    if (time_period) query = query.eq('time_period_label', time_period)
    if (audit_type) query = query.eq('audit_type', audit_type)
    if (store) query = query.eq('store_number', store)
    if (manager) query = query.ilike('manager_name', `%${manager}%`)
    if (from) query = query.gte('business_date', from)
    if (to) query = query.lte('business_date', to)

    const { data, error, count } = await query
    if (error) throw error
    return NextResponse.json({
      data: data ?? [],
      count: data?.length ?? 0,
      total: count ?? 0,
      page,
      limit: LIMIT,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
