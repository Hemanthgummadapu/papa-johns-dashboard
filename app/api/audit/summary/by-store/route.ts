import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/db'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 1000

async function fetchAllForPeriodByStore(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  time_period: string
): Promise<{ store_number: string; audit_type: string; amount: number }[]> {
  const out: { store_number: string; audit_type: string; amount: number }[] = []
  let offset = 0
  while (true) {
    const { data, error } = await supabase
      .from('audit_details')
      .select('store_number, audit_type, amount')
      .eq('time_period_label', time_period)
      .range(offset, offset + PAGE_SIZE - 1)
    if (error) throw error
    const chunk = (data ?? []) as { store_number: string; audit_type: string; amount: number }[]
    out.push(...chunk)
    if (chunk.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }
  return out
}

/**
 * GET ?time_period=current_period
 * Returns one row per store from audit_details:
 * { store_number, bad_order, zeroed_out, canceled, refund, total_amount }
 * Query by time_period_label only; no date filtering. Paginates to fetch all rows.
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseAdminClient()
    const { searchParams } = new URL(req.url)
    const time_period = searchParams.get('time_period')
    if (!time_period) {
      return NextResponse.json({ error: 'time_period is required' }, { status: 400 })
    }

    const list = await fetchAllForPeriodByStore(supabase, time_period)

    const byStore: Record<string, { bad_order: number; zeroed_out: number; canceled: number; refund: number; total_amount: number }> = {}
    for (const r of list) {
      const store = String(r.store_number ?? '').trim()
      if (!store) continue
      if (!byStore[store]) {
        byStore[store] = { bad_order: 0, zeroed_out: 0, canceled: 0, refund: 0, total_amount: 0 }
      }
      const t = String(r.audit_type ?? '')
      if (t === 'bad_order') byStore[store].bad_order += 1
      else if (t === 'zeroed_out') byStore[store].zeroed_out += 1
      else if (t === 'canceled') byStore[store].canceled += 1
      else if (t === 'refund') byStore[store].refund += 1
      byStore[store].total_amount += Number(r.amount) || 0
    }
    const dataOut = Object.entries(byStore)
      .map(([store_number, counts]) => ({
        store_number,
        bad_order: counts.bad_order,
        zeroed_out: counts.zeroed_out,
        canceled: counts.canceled,
        refund: counts.refund,
        total_amount: counts.total_amount,
      }))
      .sort((a, b) => a.store_number.localeCompare(b.store_number))

    return NextResponse.json({ data: dataOut })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
