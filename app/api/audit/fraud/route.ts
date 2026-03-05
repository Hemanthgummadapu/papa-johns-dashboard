import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/db'

export const dynamic = 'force-dynamic'

const HIGH_VALUE_THRESHOLD = 50

type Row = {
  store_number?: string | null
  manager_name?: string | null
  customer_name?: string | null
  customer_number?: string | null
  audit_type?: string | null
  payment_type?: string | null
  amount?: number | null
  reason?: string | null
  business_date?: string | null
  order_type?: string | null
  time_period_label?: string | null
}

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseAdminClient()
    const { searchParams } = new URL(req.url)
    const time_period = searchParams.get('time_period')
    const store = searchParams.get('store')
    if (!time_period) {
      return NextResponse.json({ error: 'time_period is required' }, { status: 400 })
    }

    const periodCompare = time_period === 'current_period' ? 'last_period' : time_period === 'last_period' ? 'current_period' : null

    const { data: rows, error } = await supabase
      .from('audit_details')
      .select('*')
      .eq('time_period_label', time_period)
    if (error) throw error
    const currentRows = (rows ?? []) as Row[]
    let compareRows: Row[] = []
    if (periodCompare) {
      const { data: compareData, error: compareErr } = await supabase
        .from('audit_details')
        .select('*')
        .eq('time_period_label', periodCompare)
      if (!compareErr) compareRows = (compareData ?? []) as Row[]
    }

    const filterStore = (r: Row) => !store || r.store_number === store

    // FLAG 1: Repeat Customer Abuse — 2+ incidents, customer_name not null
    const byCustomer: Record<string, { customer_name: string; customer_number: string; incidents: number; total_amount: number; types: Set<string>; stores: Set<string> }> = {}
    for (const r of currentRows.filter((x) => x.customer_name != null && String(x.customer_name).trim() !== '' && filterStore(x))) {
      const customer_name = (r.customer_name ?? '').trim()
      const customer_number = (r.customer_number ?? '').trim()
      const key = `${customer_name}\x00${customer_number}`
      if (!byCustomer[key]) byCustomer[key] = { customer_name, customer_number, incidents: 0, total_amount: 0, types: new Set(), stores: new Set() }
      byCustomer[key].incidents += 1
      byCustomer[key].total_amount += Number(r.amount) || 0
      if (r.audit_type) byCustomer[key].types.add(String(r.audit_type))
      if (r.store_number) byCustomer[key].stores.add(String(r.store_number))
    }
    const repeatCustomer = Object.values(byCustomer)
      .filter((v) => v.incidents >= 2)
      .map((v) => ({
        customer_name: v.customer_name || null,
        customer_number: v.customer_number || null,
        incidents: v.incidents,
        total_amount: v.total_amount,
        types: Array.from(v.types),
        stores: Array.from(v.stores),
      }))
      .sort((a, b) => b.incidents - a.incidents)

    // FLAG 2: Cash Order Cancellations
    const cashRows = currentRows.filter(
      (r) =>
        filterStore(r) &&
        /cash/i.test(String(r.payment_type ?? '')) &&
        ['bad_order', 'canceled', 'zeroed_out'].includes(String(r.audit_type ?? ''))
    )
    const byCash: Record<string, { store_number: string; manager_name: string; cash_incidents: number; total_amount: number; audit_type: string }> = {}
    for (const r of cashRows) {
      const store_number = String(r.store_number ?? '')
      const manager_name = (r.manager_name ?? '').trim()
      const audit_type = String(r.audit_type ?? '')
      const key = `${store_number}\x00${manager_name}\x00${audit_type}`
      if (!byCash[key]) byCash[key] = { store_number, manager_name, cash_incidents: 0, total_amount: 0, audit_type }
      byCash[key].cash_incidents += 1
      byCash[key].total_amount += Number(r.amount) || 0
    }
    const cashCancellations = Object.values(byCash).sort((a, b) => b.cash_incidents - a.cash_incidents)

    // FLAG 3: Manager Incident Trend — current vs last period
    const currByManager: Record<string, { count: number; manager_name: string; store_number: string; audit_type: string }> = {}
    for (const r of currentRows.filter(filterStore)) {
      const manager_name = (r.manager_name ?? 'Unknown').trim()
      const store_number = String(r.store_number ?? '')
      const audit_type = String(r.audit_type ?? '')
      const key = `${manager_name}\x00${store_number}\x00${audit_type}`
      if (!currByManager[key]) currByManager[key] = { count: 0, manager_name, store_number, audit_type }
      currByManager[key].count += 1
    }
    const prevByManager: Record<string, number> = {}
    for (const r of compareRows.filter(filterStore)) {
      const key = `${(r.manager_name ?? 'Unknown').trim()}\x00${r.store_number}\x00${r.audit_type}`
      prevByManager[key] = (prevByManager[key] ?? 0) + 1
    }
    const managerTrend = Object.entries(currByManager)
      .map(([, v]) => {
        const key = `${v.manager_name}\x00${v.store_number}\x00${v.audit_type}`
        const last_incidents = prevByManager[key] ?? 0
        const increase = v.count - last_incidents
        if (increase <= 0) return null
        return { manager_name: v.manager_name, store_number: v.store_number, audit_type: v.audit_type, current_incidents: v.count, last_incidents, increase }
      })
      .filter(Boolean) as Array<{ manager_name: string; store_number: string; audit_type: string; current_incidents: number; last_incidents: number; increase: number }>
    managerTrend.sort((a, b) => b.increase - a.increase)

    // FLAG 4: Store Performance vs Last Period — total incidents increased >20%
    const currByStore: Record<string, Record<string, number>> = {}
    for (const r of currentRows.filter(filterStore)) {
      const st = String(r.store_number ?? '')
      if (!currByStore[st]) currByStore[st] = {}
      currByStore[st][String(r.audit_type ?? '')] = (currByStore[st][String(r.audit_type)] ?? 0) + 1
    }
    const prevByStore: Record<string, Record<string, number>> = {}
    for (const r of compareRows.filter(filterStore)) {
      const st = String(r.store_number ?? '')
      if (!prevByStore[st]) prevByStore[st] = {}
      prevByStore[st][String(r.audit_type ?? '')] = (prevByStore[st][String(r.audit_type)] ?? 0) + 1
    }
    const storePerformance = Object.entries(currByStore).map(([store_number, currTypes]) => {
      const prevTypes = prevByStore[store_number] ?? {}
      const allTypes = new Set([...Object.keys(currTypes), ...Object.keys(prevTypes)])
      const metrics = Array.from(allTypes).map((audit_type) => {
        const current = currTypes[audit_type] ?? 0
        const last = prevTypes[audit_type] ?? 0
        const pctChange = last === 0 ? (current > 0 ? 100 : 0) : Math.round(((current - last) / last) * 100)
        return { audit_type, current, last, pctChange }
      })
      const currTotal = Object.values(currTypes).reduce((a, b) => a + b, 0)
      const lastTotal = Object.values(prevTypes).reduce((a, b) => a + b, 0)
      const totalPctChange = lastTotal === 0 ? (currTotal > 0 ? 100 : 0) : ((currTotal - lastTotal) / lastTotal) * 100
      const gettingWorse = totalPctChange > 20
      return { store_number, metrics, gettingWorse, currTotal, lastTotal }
    }).filter((s) => s.currTotal > 0 || s.lastTotal > 0).sort((a, b) => (b.gettingWorse ? 1 : 0) - (a.gettingWorse ? 1 : 0))

    // FLAG 5: High Value Single Transactions (> $50)
    const highValue = currentRows
      .filter((r) => filterStore(r) && (Number(r.amount) || 0) > HIGH_VALUE_THRESHOLD)
      .map((r) => ({
        store_number: r.store_number,
        manager_name: r.manager_name,
        customer_name: r.customer_name,
        amount: Number(r.amount) || 0,
        audit_type: r.audit_type,
        reason: r.reason,
        business_date: r.business_date,
        order_type: r.order_type,
      }))
      .sort((a, b) => b.amount - a.amount)

    // FLAG 6: Same Manager 3+ Audit Types
    const byManagerStore: Record<string, { manager_name: string; store_number: string; types: Set<string>; total_incidents: number; total_amount: number }> = {}
    for (const r of currentRows.filter(filterStore)) {
      const manager_name = (r.manager_name ?? 'Unknown').trim()
      const store_number = String(r.store_number ?? '')
      const key = `${manager_name}\x00${store_number}`
      if (!byManagerStore[key]) byManagerStore[key] = { manager_name, store_number, types: new Set(), total_incidents: 0, total_amount: 0 }
      byManagerStore[key].types.add(String(r.audit_type ?? ''))
      byManagerStore[key].total_incidents += 1
      byManagerStore[key].total_amount += Number(r.amount) || 0
    }
    const sameManagerAllTypes = Object.values(byManagerStore)
      .filter((v) => v.types.size >= 2)
      .map((v) => ({
        manager_name: v.manager_name,
        store_number: v.store_number,
        type_count: v.types.size,
        types: Array.from(v.types).filter(Boolean),
        total_incidents: v.total_incidents,
        total_amount: v.total_amount,
      }))
      .sort((a, b) => b.type_count - a.type_count || b.total_incidents - a.total_incidents)

    // Severity counts for summary bar (simple heuristic)
    const highRisk = highValue.length + sameManagerAllTypes.filter((x) => x.type_count >= 3).length
    const mediumRisk = repeatCustomer.length + cashCancellations.length + managerTrend.length
    const lowRisk = storePerformance.filter((s) => !s.gettingWorse).length

    return NextResponse.json({
      repeatCustomer,
      cashCancellations,
      managerTrend,
      storePerformance,
      highValue,
      sameManagerAllTypes,
      summary: { highRisk, mediumRisk, lowRisk },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
