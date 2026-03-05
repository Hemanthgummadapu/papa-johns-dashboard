import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/db'

export const dynamic = 'force-dynamic'

function getComparisonPeriod(timePeriod: string): string | null {
  if (timePeriod === 'current_period') return 'last_period'
  if (timePeriod === 'last_period') return 'current_period'
  if (timePeriod === 'last_year') return 'last_period'
  return null
}

const PAGE_SIZE = 1000

async function fetchAllForPeriod(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  time_period: string,
  selectCols = 'audit_type, amount'
): Promise<{ audit_type: string; amount: number }[]> {
  const out: { audit_type: string; amount: number }[] = []
  let offset = 0
  while (true) {
    const { data, error } = await supabase
      .from('audit_details')
      .select(selectCols)
      .eq('time_period_label', time_period)
      .range(offset, offset + PAGE_SIZE - 1)
    if (error) throw error
    const chunk = (data ?? []) as unknown as { audit_type: string; amount: number }[]
    out.push(...chunk)
    if (chunk.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }
  return out
}

/**
 * GET ?time_period=current_period
 * Returns aggregates from audit_details:
 * - data: [{ audit_type, total_incidents (COUNT(*)), total_amount (SUM(amount)) }] for selected period
 * No date filtering, no distinct — straight count by time_period_label and audit_type.
 * Paginates to fetch all rows (Supabase default limit is 1000).
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseAdminClient()
    const { searchParams } = new URL(req.url)
    const time_period = searchParams.get('time_period')
    if (!time_period) {
      return NextResponse.json({ error: 'time_period is required' }, { status: 400 })
    }

    const list = await fetchAllForPeriod(supabase, time_period)

    const byType: Record<string, { total_incidents: number; total_amount: number }> = {}
    for (const r of list) {
      const t = String(r.audit_type ?? '')
      if (!byType[t]) byType[t] = { total_incidents: 0, total_amount: 0 }
      byType[t].total_incidents += 1
      byType[t].total_amount += Number(r.amount) || 0
    }
    const dataOut = Object.entries(byType).map(([audit_type, agg]) => ({
      audit_type,
      total_incidents: agg.total_incidents,
      total_amount: agg.total_amount,
    }))

    let comparison: typeof dataOut = []
    const compPeriod = getComparisonPeriod(time_period)
    if (compPeriod) {
      const compRows = await fetchAllForPeriod(supabase, compPeriod)
      const compByType: Record<string, { total_incidents: number; total_amount: number }> = {}
      for (const r of compRows) {
        const t = String(r.audit_type ?? '')
        if (!compByType[t]) compByType[t] = { total_incidents: 0, total_amount: 0 }
        compByType[t].total_incidents += 1
        compByType[t].total_amount += Number(r.amount) || 0
      }
      comparison = Object.entries(compByType).map(([audit_type, agg]) => ({
        audit_type,
        total_incidents: agg.total_incidents,
        total_amount: agg.total_amount,
      }))
    }

    const comparisonLabel =
      compPeriod === 'current_period' ? 'Current' : compPeriod === 'last_period' ? 'Last Period' : 'Last Year'

    return NextResponse.json({
      data: dataOut,
      comparisonPeriod: compPeriod ?? undefined,
      comparisonLabel,
      comparison,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
