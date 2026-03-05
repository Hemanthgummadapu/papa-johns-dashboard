import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/db'

export const dynamic = 'force-dynamic'

const VIEW_TO_AUDIT_TYPE: Record<string, string> = {
  'bad-orders': 'bad_order',
  'zeroed-out': 'zeroed_out',
  'canceled-orders': 'canceled',
  'refund-orders': 'refund',
}

const VIEW_TO_LEGACY_KEYS: Record<string, { percent: string; transactions: string; amountPercent: string; amount: string }> = {
  'bad-orders': {
    percent: 'bad_order_percent',
    transactions: 'bad_order_transactions',
    amountPercent: 'bad_order_amount_percent',
    amount: 'bad_order_amount',
  },
  'zeroed-out': {
    percent: 'zeroed_out_percent',
    transactions: 'zeroed_out_transactions',
    amountPercent: 'zeroed_out_amount_percent',
    amount: 'zeroed_out_amount',
  },
  'canceled-orders': {
    percent: 'canceled_percent',
    transactions: 'canceled_transactions',
    amountPercent: 'canceled_amount_percent',
    amount: 'canceled_amount',
  },
  'refund-orders': {
    percent: 'refund_percent',
    transactions: 'refund_transactions',
    amountPercent: 'refund_amount_percent',
    amount: 'refund_amount',
  },
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ view: string }> }
) {
  const { view } = await context.params
  const auditType = VIEW_TO_AUDIT_TYPE[view]
  const legacy = VIEW_TO_LEGACY_KEYS[view]
  if (!auditType || !legacy) return NextResponse.json({ error: 'Unknown view' }, { status: 404 })

  try {
    const supabase = getSupabaseAdminClient()
    const { searchParams } = new URL(req.url)
    const week = searchParams.get('week')
    const period = searchParams.get('period')

    let query = supabase
      .from('audit_summary')
      .select('*')
      .eq('audit_type', auditType)
      .order('store_number')
    if (week) query = query.eq('week', week)
    if (period) query = query.eq('period_code', period)

    const { data, error } = await query
    if (error) throw error

    const rows = (data ?? []).map((r: Record<string, unknown>) => ({
      store_number: r.store_number,
      [legacy.percent]: r.percent,
      [legacy.transactions]: r.transactions,
      [legacy.amountPercent]: r.amount_percent,
      [legacy.amount]: r.amount,
      week: r.week,
      period: r.period_code,
      synced_at: r.synced_at,
    }))

    return NextResponse.json({ data: rows, count: rows.length })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
