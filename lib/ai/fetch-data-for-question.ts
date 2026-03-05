import { getSupabaseAdminClient } from '@/lib/db'

type AuditDetailRow = {
  store_number?: string | null
  audit_type?: string | null
  manager_name?: string | null
  approver_name?: string | null
  amount?: number | null
  payment_type?: string | null
  reason?: string | null
  business_date?: string | null
  order_type?: string | null
  time_period_label?: string | null
}

function summarizeByManager(details: AuditDetailRow[] | null): Record<string, unknown>[] {
  const map: Record<string, { manager: string; store: string; incidents: number; total_amount: number; types: Set<string>; cash_incidents: number }> = {}
  ;(details ?? []).forEach((d) => {
    const key = `${d.manager_name ?? ''}__${d.store_number ?? ''}`
    if (!map[key]) {
      map[key] = {
        manager: String(d.manager_name ?? ''),
        store: String(d.store_number ?? ''),
        incidents: 0,
        total_amount: 0,
        types: new Set(),
        cash_incidents: 0,
      }
    }
    map[key].incidents += 1
    map[key].total_amount += Number(d.amount) || 0
    if (d.audit_type) map[key].types.add(String(d.audit_type))
    if (/cash/i.test(String(d.payment_type ?? ''))) map[key].cash_incidents += 1
  })
  return Object.values(map)
    .map((m) => ({ ...m, types: Array.from(m.types) }))
    .sort((a, b) => b.incidents - a.incidents)
    .slice(0, 20)
}

function summarizeByStore(details: AuditDetailRow[] | null): Record<string, unknown>[] {
  const map: Record<string, { store: string; bad_order: number; zeroed_out: number; canceled: number; refund: number; total_amount: number }> = {}
  ;(details ?? []).forEach((d) => {
    const st = String(d.store_number ?? '')
    if (!map[st]) {
      map[st] = { store: st, bad_order: 0, zeroed_out: 0, canceled: 0, refund: 0, total_amount: 0 }
    }
    const t = String(d.audit_type ?? '')
    if (t === 'bad_order') map[st].bad_order += 1
    else if (t === 'zeroed_out') map[st].zeroed_out += 1
    else if (t === 'canceled') map[st].canceled += 1
    else if (t === 'refund') map[st].refund += 1
    map[st].total_amount += Number(d.amount) || 0
  })
  return Object.values(map).sort((a, b) => b.total_amount - a.total_amount)
}

export async function fetchDataForQuestion(
  dataSources: string[],
  timePeriod: string
): Promise<Record<string, unknown>> {
  const supabase = getSupabaseAdminClient()
  const data: Record<string, unknown> = {}

  const periods = [timePeriod, 'current_period', 'last_period'].filter((p, i, a) => a.indexOf(p) === i)

  for (const source of dataSources) {
    try {
      switch (source) {
        case 'audit_details': {
          const { data: details } = await supabase
            .from('audit_details')
            .select('store_number, audit_type, manager_name, approver_name, amount, payment_type, reason, business_date, order_type, time_period_label')
            .in('time_period_label', periods)
            .limit(500)
          const list = (details ?? []) as AuditDetailRow[]
          const cashTransactions = list.filter((d) => /cash/i.test(String(d.payment_type ?? ''))).slice(0, 50)
          data.audit = {
            managerSummary: summarizeByManager(list),
            storeSummary: summarizeByStore(list),
            cashTransactions,
            totalIncidents: list.length,
            periodLabel: timePeriod,
          }
          break
        }
        case 'audit_summary': {
          const { data: summary } = await supabase
            .from('audit_summary')
            .select('*')
            .eq('time_period_label', timePeriod)
          data.auditSummary = summary ?? []
          break
        }
        case 'smg_scores': {
          const { data: smg } = await supabase
            .from('smg_scores')
            .select('*')
            .limit(100)
          data.smgScores = smg ?? []
          break
        }
        case 'smg_comments': {
          const { data: comments } = await supabase
            .from('smg_comments')
            .select('store_number, comment, rating, created_at')
            .order('created_at', { ascending: false })
            .limit(50)
          data.smgComments = comments ?? []
          break
        }
        case 'live_kpi': {
          const { data: kpi } = await supabase
            .from('live_kpi')
            .select('*')
            .order('scraped_at', { ascending: false })
            .limit(100)
          data.liveKpi = kpi ?? []
          break
        }
        case 'specials': {
          const { data: specials } = await supabase.from('specials').select('*').order('start_date', { ascending: false }).limit(50)
          data.specials = specials ?? []
          break
        }
        case 'specials_history': {
          const { data: history } = await supabase
            .from('specials_history')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(100)
          data.specialsHistory = history ?? []
          break
        }
        default:
          break
      }
    } catch (_) {
      data[source] = { error: 'Failed to fetch' }
    }
  }

  return data
}
