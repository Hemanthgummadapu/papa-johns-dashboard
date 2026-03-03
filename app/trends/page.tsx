'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'

const STORE_LIST = ['2081', '2021', '2259', '2292', '2481', '3011']
const STORE_COLORS: Record<string, string> = {
  '2081': '#f97316',
  '2021': '#ef4444',
  '2259': '#22c55e',
  '2292': '#eab308',
  '2481': '#a855f7',
  '3011': '#06b6d4',
}

const METRICS = [
  { key: 'net_sales', label: 'Net Sales', fmt: (v: number) => `$${v?.toLocaleString()}` },
  { key: 'labor_pct', label: 'Labor %', fmt: (v: number) => `${v}%` },
  { key: 'food_cost_pct', label: 'Food Cost %', fmt: (v: number) => `${v}%` },
  { key: 'flm_pct', label: 'FLM %', fmt: (v: number) => `${v}%` },
  { key: 'doordash_sales', label: 'DoorDash (DDD)', fmt: (v: number) => `$${v?.toLocaleString()}`, tooltip: 'DoorDash marketplace + DDDCash orders from cube [DDD Net Sales USD]' },
  { key: 'ubereats_sales', label: 'Aggregator (DD+UE+GH)', fmt: (v: number) => `$${v?.toLocaleString()}`, tooltip: 'Combined DoorDash + UberEats + GrubHub from cube [TY Aggregator Delivery Net Sales USD]. May differ slightly from POS due to timing.' },
] as const
type MetricKey = (typeof METRICS)[number]['key']

type CubeStoreRow = {
  storeNumber: string
  netSales: number | null
  laborPct: number | null
  foodCostUsd: number | null
  flmPct: number | null
  dddSales: number | null
  aggregatorSales: number | null
}

export type Special = {
  id: string
  name: string
  platform: string
  store_ids: string[]
  start_date: string
  end_date: string | null
  notes: string | null
  status: string
  created_at: string
  updated_at: string
}

type SpecialHistoryRow = {
  id: string
  special_id: string
  action: string
  notes: string | null
  created_at: string
}

type ComparisonMetrics = {
  daysRunning: number
  netSalesChange: number
  laborChange: number
  ordersChange: number
  ddSalesChange: number
  ueSalesChange: number
  before: { netSales: number; laborPct: number; dddSales: number; aggregatorSales: number }
  after: { netSales: number; laborPct: number; dddSales: number; aggregatorSales: number }
}

type SpecialImpact = ComparisonMetrics & {
  vsLastYear?: ComparisonMetrics
  rawBeforeData?: { stores?: CubeStoreRow[] }
  rawAfterData?: { stores?: CubeStoreRow[] }
  rawLyBeforeData?: { stores?: CubeStoreRow[] }
  rawLyAfterData?: { stores?: CubeStoreRow[] }
}

function calcChange(before: number, after: number): number {
  return before > 0 ? ((after - before) / before) * 100 : 0
}

function formatChange(value: number, isPercentagePoints: boolean): string {
  const arrow = value >= 0 ? '▲' : '▼'
  if (isPercentagePoints) {
    const sign = value >= 0 ? '+' : ''
    return `${arrow} ${sign}${value.toFixed(1)}pp`
  }
  return `${arrow} ${Math.abs(value).toFixed(1)}%`
}

function getStoreMetrics(
  storeId: string,
  beforeData: { stores?: CubeStoreRow[] },
  afterData: { stores?: CubeStoreRow[] },
  platform: string,
  daysRunning: number
): ComparisonMetrics | null {
  const before = beforeData?.stores?.find((s) => String(s.storeNumber) === storeId)
  const after = afterData?.stores?.find((s) => String(s.storeNumber) === storeId)
  if (!before || !after) return null
  const netSalesChange = calcChange(before.netSales ?? 0, after.netSales ?? 0)
  const p = platform.toLowerCase()
  const beforePrimary = p === 'doordash' ? (before.dddSales ?? 0) : p === 'ubereats' ? (before.aggregatorSales ?? 0) : (before.netSales ?? 0)
  const afterPrimary = p === 'doordash' ? (after.dddSales ?? 0) : p === 'ubereats' ? (after.aggregatorSales ?? 0) : (after.netSales ?? 0)
  const primaryChange = calcChange(beforePrimary, afterPrimary)
  const laborBefore = before.laborPct ?? 0
  const laborAfter = after.laborPct ?? 0
  const laborChange = laborAfter - laborBefore
  const ddSalesChange = calcChange(before.dddSales ?? 0, after.dddSales ?? 0)
  const ueSalesChange = calcChange(before.aggregatorSales ?? 0, after.aggregatorSales ?? 0)
  return {
    daysRunning,
    netSalesChange,
    laborChange,
    ordersChange: netSalesChange,
    ddSalesChange,
    ueSalesChange,
    before: {
      netSales: before.netSales ?? 0,
      laborPct: laborBefore,
      dddSales: before.dddSales ?? 0,
      aggregatorSales: before.aggregatorSales ?? 0,
    },
    after: {
      netSales: after.netSales ?? 0,
      laborPct: laborAfter,
      dddSales: after.dddSales ?? 0,
      aggregatorSales: after.aggregatorSales ?? 0,
    },
  }
}

function roundPct(v: number): number {
  return Math.round(v * 10) / 10
}

function getDefaultWeek(): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 4 - (d.getDay() || 7))
  const jan1 = new Date(d.getFullYear(), 0, 1)
  const w = Math.ceil((((d.getTime() - jan1.getTime()) / 86400000) + jan1.getDay() + 1) / 7)
  return `${d.getFullYear()}-W${String(w).padStart(2, '0')}`
}

function getDefaultMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** Last fully completed month (excludes current incomplete month). */
function getLastCompleteMonth(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = d.getMonth() // 0-indexed: Jan=0, Mar=2
  if (m === 0) return `${y - 1}-12`
  return `${y}-${String(m).padStart(2, '0')}`
}

/** Last fully completed week (excludes current incomplete week). */
function getLastCompleteWeek(): string {
  return getPrevWeekString(getDefaultWeek())
}

function getPrevWeeks(current: string, n: number): string[] {
  const [year, weekStr] = current.split('-W')
  const results: string[] = []
  let y = parseInt(year, 10)
  let w = parseInt(weekStr, 10)
  for (let i = 0; i < n; i++) {
    results.push(`${y}-W${String(w).padStart(2, '0')}`)
    w--
    if (w < 1) {
      w = 52
      y--
    }
  }
  return results.reverse()
}

function getPrevMonths(current: string, n: number): string[] {
  const parts = current.split('-').map(Number)
  const y = parts[0]
  let month = parts[1] ?? 1
  const results: string[] = []
  let year = y
  for (let i = 0; i < n; i++) {
    results.push(`${year}-${String(month).padStart(2, '0')}`)
    month--
    if (month < 1) {
      month = 12
      year--
    }
  }
  return results.reverse()
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Format YYYY-MM as "Feb 2026". */
function formatMonthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  const name = MONTH_NAMES[(m ?? 1) - 1] ?? String(m)
  return `${name} ${y}`
}

/** Format week string (e.g. 2026-W09) for footnote. */
function formatWeekLabel(weekStr: string): string {
  const [y, w] = weekStr.split('-W')
  return `Week ${parseInt(w ?? '0', 10)}, ${y}`
}

function getPrevWeekString(weekStr: string): string {
  const [year, wStr] = weekStr.split('-W')
  let y = parseInt(year, 10)
  let w = parseInt(wStr, 10)
  w--
  if (w < 1) {
    w = 52
    y--
  }
  return `${y}-W${String(w).padStart(2, '0')}`
}

function getPrevMonthString(monthStr: string): string {
  const [y, m] = monthStr.split('-').map(Number)
  let month = m - 1
  let year = y
  if (month < 1) {
    month = 12
    year--
  }
  return `${year}-${String(month).padStart(2, '0')}`
}

function getISOWeekString(dateStr: string): string {
  const d = new Date(dateStr)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 4 - (d.getDay() || 7))
  const jan1 = new Date(d.getFullYear(), 0, 1)
  const w = Math.ceil((((d.getTime() - jan1.getTime()) / 86400000) + jan1.getDay() + 1) / 7)
  return `${d.getFullYear()}-W${String(w).padStart(2, '0')}`
}

function differenceInDays(a: Date, b: Date): number {
  const ms = a.getTime() - b.getTime()
  return Math.floor(ms / 86400000)
}

function getMetricFromStore(s: CubeStoreRow, key: MetricKey): number {
  switch (key) {
    case 'net_sales':
      return s.netSales ?? 0
    case 'labor_pct':
      return roundPct(s.laborPct ?? 0)
    case 'food_cost_pct': {
      const ns = s.netSales ?? 0
      return ns && s.foodCostUsd != null ? roundPct((s.foodCostUsd / ns) * 100) : 0
    }
    case 'flm_pct':
      return roundPct(s.flmPct ?? 0)
    case 'doordash_sales':
      return s.dddSales ?? 0
    case 'ubereats_sales':
      return s.aggregatorSales ?? 0
    default:
      return 0
  }
}

function buildComparison(
  beforeData: { stores?: CubeStoreRow[] },
  afterData: { stores?: CubeStoreRow[] },
  storeIds: string[]
): ComparisonMetrics {
  const beforeStores = beforeData.stores ?? []
  const afterStores = afterData.stores ?? []
  const sum = (arr: CubeStoreRow[], ids: string[]) => {
    let netSales = 0, laborPct = 0, dd = 0, ue = 0
    let laborSum = 0, count = 0
    ids.forEach((id) => {
      const s = arr.find((x) => String(x.storeNumber) === id)
      if (s) {
        netSales += s.netSales ?? 0
        if (s.laborPct != null) {
          laborSum += s.laborPct
          count++
        }
        dd += s.dddSales ?? 0
        ue += s.aggregatorSales ?? 0
      }
    })
    laborPct = count ? laborSum / count : 0
    return { netSales, laborPct, dddSales: dd, aggregatorSales: ue }
  }
  const before = sum(beforeStores, storeIds)
  const after = sum(afterStores, storeIds)
  const netSalesChange = before.netSales ? ((after.netSales - before.netSales) / before.netSales) * 100 : 0
  const laborChange = before.laborPct != null ? after.laborPct - before.laborPct : 0
  const ddSalesChange = before.dddSales ? ((after.dddSales - before.dddSales) / before.dddSales) * 100 : 0
  const ueSalesChange = before.aggregatorSales ? ((after.aggregatorSales - before.aggregatorSales) / before.aggregatorSales) * 100 : 0
  return {
    daysRunning: 0,
    netSalesChange,
    laborChange,
    ordersChange: netSalesChange,
    ddSalesChange,
    ueSalesChange,
    before,
    after,
  }
}

function getVerdict(
  platform: string,
  metrics: ComparisonMetrics
): { label: string; color: string; reason: string } {
  const p = platform.toLowerCase()
  const primaryMetric =
    p === 'doordash' ? metrics.ddSalesChange
    : p === 'ubereats' ? metrics.ueSalesChange
    : metrics.netSalesChange

  if (metrics.daysRunning < 3)
    return {
      label: '⏳ TOO EARLY',
      color: 'gray',
      reason: 'Less than 3 days of data — check back soon',
    }
  if (primaryMetric > 10 && metrics.laborChange < 5)
    return {
      label: '✅ CONTINUE',
      color: 'green',
      reason: 'Primary metric up strongly, labor controlled',
    }
  if (primaryMetric > 10 && metrics.laborChange >= 5)
    return {
      label: '⚠️ MONITOR',
      color: 'yellow',
      reason: 'Sales up but labor increasing — watch margins',
    }
  if (primaryMetric >= 0 && primaryMetric <= 10 && metrics.ordersChange > 0)
    return {
      label: '🔄 MODIFY',
      color: 'blue',
      reason: 'Orders up but revenue flat — ticket average dropping from discount',
    }
  if (primaryMetric < -5)
    return {
      label: '❌ STOP',
      color: 'red',
      reason: 'Primary metric declining since special started — consider reversing',
    }
  return {
    label: '⏳ MONITOR',
    color: 'gray',
    reason: 'Minimal impact so far — continue monitoring',
  }
}

function getAggregateVerdict(
  platform: string,
  impact: SpecialImpact,
  storeIds: string[],
  compareMode: 'lastYear' | 'lastWeek',
  daysRunning: number
): { label: string; color: string; reason: string } {
  const beforeData = compareMode === 'lastYear' ? impact.rawLyAfterData : impact.rawBeforeData
  const afterData = compareMode === 'lastYear' ? impact.rawAfterData : impact.rawAfterData
  if (!beforeData || !afterData) {
    const base = compareMode === 'lastYear' ? impact.vsLastYear ?? impact : impact
    return base ? getVerdict(platform, base) : { label: '⏳ Loading…', color: 'gray', reason: '' }
  }
  const storeVerdicts = storeIds
    .map((storeId) => {
      const m = getStoreMetrics(storeId, beforeData, afterData, platform, daysRunning)
      return m ? { storeId, verdict: getVerdict(platform, m) } : null
    })
    .filter((x): x is { storeId: string; verdict: { label: string; color: string; reason: string } } => x !== null)
  if (storeVerdicts.length === 0) return getVerdict(platform, impact)
  const labels = storeVerdicts.map((x) => x.verdict.label)
  const allSame = labels.every((l) => l === labels[0])
  if (allSame) {
    const v = storeVerdicts[0]!.verdict
    const base = compareMode === 'lastYear' ? impact.vsLastYear ?? impact : impact
    const reason = base ? getVerdict(platform, base).reason : v.reason
    return { ...v, reason }
  }
  const byLabel: Record<string, string[]> = {}
  storeVerdicts.forEach(({ storeId, verdict }) => {
    if (!byLabel[verdict.label]) byLabel[verdict.label] = []
    byLabel[verdict.label].push(storeId)
  })
  const entries = Object.entries(byLabel).sort((a, b) => b[1].length - a[1].length)
  const first = entries[0]
  if (!first) return getVerdict(platform, impact)
  const [majorityLabel, majorityStores] = first
  const minorityEntries = entries.slice(1)
  const workingStores = minorityEntries
    .filter(([label]) => label === '✅ CONTINUE')
    .flatMap(([, ids]) => ids)
  const verdictStyle =
    majorityLabel === '❌ STOP' ? 'red'
    : majorityLabel === '✅ CONTINUE' ? 'green'
    : majorityLabel === '⚠️ MONITOR' ? 'yellow'
    : majorityLabel === '🔄 MODIFY' ? 'blue'
    : 'gray'
  const reason =
    workingStores.length > 0
      ? `${majorityLabel} for most stores — working for ${workingStores.join(', ')} only`
      : `${majorityLabel} for ${majorityStores.length} store(s); ${minorityEntries.map(([l, ids]) => `${l} for ${ids.join(', ')}`).join('; ')}`
  return { label: majorityLabel, color: verdictStyle, reason }
}

export default function TrendsPage() {
  const [metric, setMetric] = useState<MetricKey>('net_sales')
  const [storesSelected, setStoresSelected] = useState<string[]>(STORE_LIST)
  const [period, setPeriod] = useState<'3M' | '6M' | '1Y' | '2Y' | '3Y'>('6M')
  const [chartData, setChartData] = useState<Array<Record<string, number | string>>>([])
  const [loading, setLoading] = useState(false)
  const [specials, setSpecials] = useState<Special[]>([])
  const [specialsFilter, setSpecialsFilter] = useState<'active' | 'history' | 'all'>('active')
  const [addSpecialOpen, setAddSpecialOpen] = useState(false)
  const [storeFilter, setStoreFilter] = useState<string>('all')
  const [impactBySpecial, setImpactBySpecial] = useState<Record<string, SpecialImpact>>({})
  const [vsLastYearLoadingBySpecial, setVsLastYearLoadingBySpecial] = useState<Record<string, boolean>>({})
  const [historyBySpecial, setHistoryBySpecial] = useState<Record<string, SpecialHistoryRow[]>>({})
  const [showHistoryId, setShowHistoryId] = useState<string | null>(null)

  const periodConfig = {
    '3M': { count: 12, period: 'weekly' as const, label: '12 weeks' },
    '6M': { count: 6, period: 'monthly' as const, label: '6 months' },
    '1Y': { count: 12, period: 'monthly' as const, label: '12 months' },
    '2Y': { count: 24, period: 'monthly' as const, label: '24 months' },
    '3Y': { count: 36, period: 'monthly' as const, label: '36 months' },
  }

  const loadSpecials = useCallback(async () => {
    const status = specialsFilter === 'all' ? '' : specialsFilter === 'history' ? 'stopped' : specialsFilter
    const url = status ? `/api/specials?status=${status}` : '/api/specials'
    const res = await fetch(url, { cache: 'no-store' })
    const data = await res.json()
    setSpecials(Array.isArray(data) ? data : [])
  }, [specialsFilter])

  useEffect(() => {
    loadSpecials()
  }, [loadSpecials])

  const loadChart = useCallback(async () => {
    const config = periodConfig[period]
    // Exclude current incomplete period: use last complete month/week so chart ends at full data.
    const dates =
      config.period === 'weekly'
        ? getPrevWeeks(getLastCompleteWeek(), config.count)
        : getPrevMonths(getLastCompleteMonth(), config.count)
    setLoading(true)
    try {
      const results = await Promise.all(
        dates.map((d) =>
          fetch(`/api/cube?date=${encodeURIComponent(d)}&period=${config.period}`, { cache: 'no-store' }).then((r) =>
            r.json()
          )
        )
      )
      const data: Array<Record<string, number | string>> = dates.map((dateStr, i) => {
        const storesList: CubeStoreRow[] = results[i]?.stores ?? []
        const point: Record<string, number | string> = {
          date: dateStr,
          label: config.period === 'weekly' ? `W${i + 1}` : formatMonthLabel(dateStr),
        }
        storesSelected.forEach((storeNum) => {
          const s = storesList.find((x) => String(x.storeNumber) === storeNum)
          point[storeNum] = s ? getMetricFromStore(s, metric) : 0
        })
        return point
      })
      setChartData(data)
    } finally {
      setLoading(false)
    }
  }, [period, storesSelected, metric])

  useEffect(() => {
    loadChart()
  }, [loadChart])

  const activeSpecials = specials.filter((s) => s.status === 'active')
  const activeCount = activeSpecials.length

  return (
    <div className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)]">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] px-6">
        <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[var(--brand)] text-xs font-semibold text-white">
              PJ
            </div>
            <div>
              <div className="font-semibold text-[var(--text-primary)]">Papa Johns Ops</div>
              <div className="text-[11px] text-[var(--text-tertiary)]">Trends & Specials</div>
            </div>
          </div>
          <nav className="flex gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-overlay)] p-1">
            <Link
              href="/dashboard"
              className="rounded-md px-4 py-2 text-sm font-semibold text-[var(--text-tertiary)] transition hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
            >
              Dashboard
            </Link>
            <Link
              href="/trends"
              className="rounded-md px-4 py-2 text-sm font-semibold text-[var(--text-tertiary)] transition hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
            >
              Trends
            </Link>
            <Link
              href="/analytics/profitability"
              className="rounded-md px-4 py-2 text-sm font-semibold text-[var(--text-tertiary)] transition hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
            >
              Analytics
            </Link>
            <Link
              href="/dashboard"
              className="rounded-md px-4 py-2 text-sm font-semibold text-[var(--text-tertiary)] transition hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
            >
              Live
            </Link>
            <Link
              href="/dashboard"
              className="rounded-md px-4 py-2 text-sm font-semibold text-[var(--text-tertiary)] transition hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
            >
              Guest Experience
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-6 py-8">
        {/* Section 1 — Trends Chart */}
        <section className="mb-12">
          <h2 className="mb-4 text-lg font-bold text-[var(--text-primary)]">Trends Chart</h2>
          <div className="mb-4 flex flex-wrap items-end gap-6">
            <div>
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                Metric
              </div>
              <div className="flex flex-wrap gap-2">
                {METRICS.map((m) => (
                  <button
                    key={m.key}
                    onClick={() => setMetric(m.key)}
                    title={'tooltip' in m ? m.tooltip : undefined}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                      metric === m.key
                        ? 'bg-[var(--brand)] text-white'
                        : 'bg-[var(--bg-overlay)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]'
                    }`}
                  >
                    {m.label}
                    {'tooltip' in m && m.tooltip && (
                      <span className="ml-1 cursor-help opacity-70" title={m.tooltip} aria-label="Info">ⓘ</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                Stores
              </div>
              <div className="flex flex-wrap gap-2">
                {STORE_LIST.map((num) => {
                  const checked = storesSelected.includes(num)
                  return (
                    <label
                      key={num}
                      className={`flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium ${
                        checked
                          ? 'border-[var(--store-1)] bg-[var(--brand-subtle)] text-[var(--text-primary)]'
                          : 'border-[var(--border-default)] bg-[var(--bg-overlay)] text-[var(--text-tertiary)]'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setStoresSelected((prev) =>
                            prev.includes(num) ? prev.filter((n) => n !== num) : [...prev, num]
                          )
                        }
                        className="h-4 w-4 accent-[var(--brand)]"
                      />
                      {num}
                    </label>
                  )
                })}
              </div>
            </div>
            <div>
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                Period
              </div>
              <div className="flex gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-overlay)] p-1">
                {(['3M', '6M', '1Y', '2Y', '3Y'] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    className={`rounded-md px-4 py-2 text-sm font-semibold ${
                      period === p ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)]' : 'text-[var(--text-tertiary)]'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4">
            {loading ? (
              <div className="flex h-[350px] flex-col items-center justify-center gap-3 text-[var(--text-secondary)]">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--border-default)] border-t-[var(--brand)]" />
                Loading{' '}
                {period === '3M'
                  ? '12 weeks'
                  : period === '6M'
                    ? '6 months'
                    : period === '1Y'
                      ? '12 months'
                      : period === '2Y'
                        ? '24 months'
                        : '36 months'}{' '}
                of data...
              </div>
            ) : chartData.length === 0 ? (
              <div className="flex h-[350px] items-center justify-center text-[var(--text-tertiary)]">
                No data. Select at least one store.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={350}>
                <ComposedChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="1 3" stroke="var(--border-subtle)" />
                  <XAxis
                    dataKey="label"
                    stroke="var(--text-tertiary)"
                    tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }}
                  />
                  <YAxis
                    stroke="var(--text-tertiary)"
                    tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }}
                    tickFormatter={(v) => METRICS.find((x) => x.key === metric)?.fmt(Number(v)) ?? String(v)}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null
                      return (
                        <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-overlay)] p-3">
                          <div className="mb-2 text-sm font-medium text-[var(--text-primary)]">{label}</div>
                          {payload.map((p: { dataKey: string; value: number; color: string }) => (
                            <div key={p.dataKey} className="mb-1 flex items-center gap-2">
                              <div
                                className="h-2 w-2 rounded-full"
                                style={{ background: p.color }}
                              />
                              <span className="text-[var(--text-secondary)]">Store {p.dataKey}:</span>
                              <span className="font-semibold" style={{ color: p.color }}>
                                {METRICS.find((m) => m.key === metric)?.fmt(p.value) ?? p.value}
                              </span>
                            </div>
                          ))}
                        </div>
                      )
                    }}
                  />
                  <Legend formatter={(val) => `Store ${val}`} />
                  {storesSelected.map((storeNum) => (
                    <Line
                      key={storeNum}
                      type="monotone"
                      dataKey={storeNum}
                      stroke={STORE_COLORS[storeNum] ?? '#888'}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 5 }}
                    />
                  ))}
                  {activeSpecials.map((special) => {
                    const startLabel = periodConfig[period].period === 'weekly'
                      ? getISOWeekString(special.start_date)
                      : special.start_date.slice(0, 7)
                    const idx = chartData.findIndex((r) => r.date === startLabel || r.label === startLabel)
                    if (idx < 0) return null
                    const xVal = chartData[idx]?.label ?? startLabel
                    return (
                      <ReferenceLine
                        key={special.id}
                        x={xVal}
                        stroke="#f59e0b"
                        strokeDasharray="5 5"
                        label={{ value: special.name, position: 'top', fill: '#f59e0b', fontSize: 10 }}
                      />
                    )
                  })}
                </ComposedChart>
              </ResponsiveContainer>
            )}
            {!loading && chartData.length > 0 && (() => {
              const config = periodConfig[period]
              const lastDate = chartData[chartData.length - 1]?.date as string | undefined
              const throughLabel = lastDate
                ? config.period === 'weekly'
                  ? `Data through ${formatWeekLabel(lastDate)} · Current week excluded`
                  : `Data through ${formatMonthLabel(lastDate)} · Current month excluded`
                : null
              return throughLabel ? (
                <p className="mt-1 text-[10px] text-[var(--text-tertiary)]" style={{ marginBottom: 0 }}>
                  {throughLabel}
                </p>
              ) : null
            })()}
          </div>

          {/* Store Performance Scorecard — uses same chartData */}
          {!loading && chartData.length > 0 && storesSelected.length > 0 && (() => {
            const selectedMetricLabel = METRICS.find((m) => m.key === metric)?.label ?? metric
            const formatMetricVal = (v: number) => METRICS.find((m) => m.key === metric)?.fmt(v) ?? String(v)
            const periodStartLabels: Record<typeof period, string> = {
              '3M': '3 months ago',
              '6M': '6 months ago',
              '1Y': '1 year ago',
              '2Y': '2 years ago',
              '3Y': '3 years ago',
            }
            const periodStartLabel = periodStartLabels[period]

            const getLatest = (store: string) => Number(chartData[chartData.length - 1]?.[store]) || 0
            const getStart = (store: string) => Number(chartData[0]?.[store]) || 0
            const getPeak = (store: string) =>
              chartData.length ? Math.max(...chartData.map((d) => Number(d[store]) || 0)) : 0

            const storeStats = storesSelected.map((store) => {
              const latest = getLatest(store)
              const start = getStart(store)
              const peak = getPeak(store)
              const change = start !== 0 ? ((latest - start) / start) * 100 : 0
              const fromPeak = peak !== 0 ? ((latest - peak) / peak) * 100 : 0
              return { store, latest, start, peak, change, fromPeak }
            })
            const best = storeStats.length ? storeStats.reduce((a, b) => (a.change >= b.change ? a : b)) : null
            const worst = storeStats.length ? storeStats.reduce((a, b) => (a.change <= b.change ? a : b)) : null
            const avgChange = storeStats.length ? storeStats.reduce((s, x) => s + x.change, 0) / storeStats.length : 0
            const avgFromPeak = storeStats.length ? storeStats.reduce((s, x) => s + x.fromPeak, 0) / storeStats.length : 0

            const progressColor = (ratio: number, store: string) => {
              if (ratio >= 0.8) return STORE_COLORS[store] ?? '#888'
              if (ratio >= 0.6) return '#eab308'
              return '#ef4444'
            }

            return (
              <div className="mt-4 mb-8">
                <div className="mb-3 text-xs uppercase text-gray-400">
                  Store Performance — {selectedMetricLabel} · {period}
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                  {storeStats.map(({ store, latest, start, peak, change, fromPeak }) => {
                    const ratio = peak > 0 ? latest / peak : 1
                    const barColor = progressColor(ratio, store)
                    return (
                      <div key={store} className="rounded-xl border border-gray-800 bg-gray-900 p-4">
                        <div className="mb-3 flex items-center gap-2">
                          <div
                            className="h-2 w-2 rounded-full"
                            style={{ background: STORE_COLORS[store] ?? '#888' }}
                          />
                          <span className="text-sm font-bold text-white">Store {store}</span>
                        </div>
                        <div className="mb-1 text-2xl font-bold text-white">
                          {formatMetricVal(latest)}
                        </div>
                        <div
                          className={`mb-2 text-sm font-bold ${change >= 0 ? 'text-green-400' : 'text-red-400'}`}
                        >
                          {change >= 0 ? '▲' : '▼'} {Math.abs(change).toFixed(1)}% since {periodStartLabel}
                        </div>
                        <div className="mb-2">
                          <div className="mb-1 flex justify-between text-xs text-gray-400">
                            <span>vs Peak</span>
                            <span className="text-red-400">{fromPeak.toFixed(1)}%</span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-gray-700">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${Math.max(0, Math.min(100, peak > 0 ? (latest / peak) * 100 : 100))}%`,
                                background: barColor,
                              }}
                            />
                          </div>
                        </div>
                        <div className="text-xs text-gray-500">
                          Peak: {formatMetricVal(peak)}
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div className="mt-3 flex flex-wrap gap-8 rounded-xl border border-gray-800 bg-gray-900 p-4">
                  <div>
                    <div className="text-xs uppercase text-gray-400">Best Performing</div>
                    <div className="mt-1 font-bold text-white">
                      {best ? (
                        <>Store {best.store} <span className="text-green-400">{best.change >= 0 ? '+' : ''}{best.change.toFixed(1)}%</span></>
                      ) : (
                        '—'
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs uppercase text-gray-400">Worst Performing</div>
                    <div className="mt-1 font-bold text-white">
                      {worst ? (
                        <>Store {worst.store} <span className="text-red-400">{worst.change >= 0 ? '+' : ''}{worst.change.toFixed(1)}%</span></>
                      ) : (
                        '—'
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs uppercase text-gray-400">Avg Change All Stores</div>
                    <div className={`mt-1 font-bold ${avgChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {avgChange >= 0 ? '▲' : '▼'} {Math.abs(avgChange).toFixed(1)}%
                    </div>
                  </div>
                  <div>
                    <div className="text-xs uppercase text-gray-400">All Stores vs Peak</div>
                    <div className="mt-1 font-bold text-red-400">
                      ▼ {Math.abs(avgFromPeak).toFixed(1)}% below peak
                    </div>
                  </div>
                </div>
              </div>
            )
          })()}
        </section>

        {/* Section 2 — Specials Tracker */}
        <section>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-lg font-bold text-[var(--text-primary)]">SPECIALS TRACKER</h2>
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => setAddSpecialOpen(true)}
                className="rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--brand-hover)]"
              >
                + Add Special
              </button>
              <div className="flex gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-overlay)] p-1">
                <button
                  onClick={() => setSpecialsFilter('active')}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                    specialsFilter === 'active' ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)]' : 'text-[var(--text-tertiary)]'
                  }`}
                >
                  Active ●{activeCount}
                </button>
                <button
                  onClick={() => setSpecialsFilter('history')}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                    specialsFilter === 'history' ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)]' : 'text-[var(--text-tertiary)]'
                  }`}
                >
                  History
                </button>
                <button
                  onClick={() => setSpecialsFilter('all')}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                    specialsFilter === 'all' ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)]' : 'text-[var(--text-tertiary)]'
                  }`}
                >
                  All
                </button>
              </div>
              <select
                value={storeFilter}
                onChange={(e) => setStoreFilter(e.target.value)}
                className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-overlay)] px-3 py-2 text-sm text-[var(--text-primary)]"
              >
                <option value="all">All Stores</option>
                {STORE_LIST.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {addSpecialOpen && (
            <AddSpecialForm
              onClose={() => setAddSpecialOpen(false)}
              onSaved={() => {
                setAddSpecialOpen(false)
                loadSpecials()
              }}
            />
          )}

          <div className="space-y-4">
            {specials
              .filter((s) => storeFilter === 'all' || s.store_ids.includes(storeFilter))
              .map((special) => (
                <SpecialCard
                  key={special.id}
                  special={special}
                  impact={impactBySpecial[special.id]}
                  selectedStore={storeFilter}
                  vsLastYearLoading={vsLastYearLoadingBySpecial[special.id]}
                  history={historyBySpecial[special.id]}
                  showHistory={showHistoryId === special.id}
                  onLoadImpact={async () => {
                    const daysRunning = differenceInDays(new Date(), new Date(special.start_date))
                    const useWeekly = daysRunning < 14
                    let beforeData: { stores?: CubeStoreRow[] }, afterData: { stores?: CubeStoreRow[] }
                    if (useWeekly) {
                      const startWeek = getISOWeekString(special.start_date)
                      const prevWeek = getPrevWeekString(startWeek)
                      const [afterRes, beforeRes] = await Promise.all([
                        fetch(`/api/cube?date=${startWeek}&period=weekly`).then((r) => r.json()),
                        fetch(`/api/cube?date=${prevWeek}&period=weekly`).then((r) => r.json()),
                      ])
                      afterData = afterRes
                      beforeData = beforeRes
                    } else {
                      const startMonth = special.start_date.slice(0, 7)
                      const prevMonth = getPrevMonthString(startMonth)
                      const [afterRes, beforeRes] = await Promise.all([
                        fetch(`/api/cube?date=${startMonth}&period=monthly`).then((r) => r.json()),
                        fetch(`/api/cube?date=${prevMonth}&period=monthly`).then((r) => r.json()),
                      ])
                      afterData = afterRes
                      beforeData = beforeRes
                    }
                    const comp = buildComparison(beforeData, afterData, special.store_ids)
                    comp.daysRunning = daysRunning
                    setImpactBySpecial((prev) => ({
                      ...prev,
                      [special.id]: {
                        ...comp,
                        rawBeforeData: beforeData,
                        rawAfterData: afterData,
                      },
                    }))

                    setVsLastYearLoadingBySpecial((prev) => ({ ...prev, [special.id]: true }))
                    try {
                      if (useWeekly) {
                        const startWeek = getISOWeekString(special.start_date)
                        const prevWeek = getPrevWeekString(startWeek)
                        const lastYearWeek = startWeek.replace(/^(\d{4})/, (y) => String(parseInt(y, 10) - 1))
                        const lastYearPrevWeek = prevWeek.replace(/^(\d{4})/, (y) => String(parseInt(y, 10) - 1))
                        const [lyAfterRes, lyBeforeRes] = await Promise.all([
                          fetch(`/api/cube?date=${lastYearWeek}&period=weekly`).then((r) => r.json()),
                          fetch(`/api/cube?date=${lastYearPrevWeek}&period=weekly`).then((r) => r.json()),
                        ])
                        const vsLastYear = buildComparison(lyAfterRes, afterData, special.store_ids)
                        setImpactBySpecial((prev) => ({
                          ...prev,
                          [special.id]: {
                            ...prev[special.id],
                            vsLastYear,
                            rawLyBeforeData: lyBeforeRes,
                            rawLyAfterData: lyAfterRes,
                          },
                        }))
                      } else {
                        const startMonth = special.start_date.slice(0, 7)
                        const prevMonth = getPrevMonthString(startMonth)
                        const lastYearMonth = startMonth.replace(/^(\d{4})/, (y) => String(parseInt(y, 10) - 1))
                        const lastYearPrevMonth = prevMonth.replace(/^(\d{4})/, (y) => String(parseInt(y, 10) - 1))
                        const [lyAfterRes, lyBeforeRes] = await Promise.all([
                          fetch(`/api/cube?date=${lastYearMonth}&period=monthly`).then((r) => r.json()),
                          fetch(`/api/cube?date=${lastYearPrevMonth}&period=monthly`).then((r) => r.json()),
                        ])
                        const vsLastYear = buildComparison(lyAfterRes, afterData, special.store_ids)
                        setImpactBySpecial((prev) => ({
                          ...prev,
                          [special.id]: {
                            ...prev[special.id],
                            vsLastYear,
                            rawLyBeforeData: lyBeforeRes,
                            rawLyAfterData: lyAfterRes,
                          },
                        }))
                      }
                    } finally {
                      setVsLastYearLoadingBySpecial((prev) => ({ ...prev, [special.id]: false }))
                    }
                  }}
                  onLoadHistory={async () => {
                    if (showHistoryId === special.id) {
                      setShowHistoryId(null)
                      return
                    }
                    setShowHistoryId(special.id)
                    const res = await fetch(`/api/specials/${special.id}/history`)
                    const data = await res.json()
                    setHistoryBySpecial((prev) => ({ ...prev, [special.id]: data ?? [] }))
                  }}
                  onAction={async (action, notes) => {
                    await fetch(`/api/specials/${special.id}`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        action,
                        notes,
                        ...(action === 'stopped' ? { status: 'stopped' } : action === 'paused' ? { status: 'paused' } : {}),
                      }),
                    })
                    loadSpecials()
                  }}
                />
              ))}
          </div>
        </section>
      </main>
    </div>
  )
}

function AddSpecialForm({
  onClose,
  onSaved,
}: {
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState('')
  const [platform, setPlatform] = useState('doordash')
  const [storeIds, setStoreIds] = useState<string[]>(STORE_LIST)
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [endDate, setEndDate] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const toggleStore = (num: string) => {
    setStoreIds((prev) =>
      prev.includes(num) ? prev.filter((n) => n !== num) : [...prev, num]
    )
  }
  const setAllStores = () => {
    setStoreIds(STORE_LIST.length === storeIds.length ? [] : [...STORE_LIST])
  }

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/specials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          platform,
          store_ids: storeIds,
          start_date: startDate,
          end_date: endDate || null,
          notes: notes.trim() || null,
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      onSaved()
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  const platforms = [
    { key: 'doordash', label: 'DoorDash' },
    { key: 'ubereats', label: 'Uber Eats' },
    { key: 'pj_carryout', label: 'PJ Carryout' },
    { key: 'pj_delivery', label: 'PJ Delivery' },
  ]

  return (
    <div className="mb-6 rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-bold text-[var(--text-primary)]">Add Special</h3>
        <button onClick={onClose} className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">
          ✕
        </button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs text-[var(--text-tertiary)]">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-overlay)] px-3 py-2 text-[var(--text-primary)]"
            placeholder="e.g. 30% off"
          />
        </div>
        <div>
          <label className="mb-2 block text-xs text-[var(--text-tertiary)]">Platform</label>
          <div className="flex flex-wrap gap-2">
            {platforms.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => setPlatform(p.key)}
                className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                  platform === p.key ? 'bg-[var(--brand)] text-white' : 'bg-[var(--bg-overlay)] text-[var(--text-secondary)]'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="mb-2 block text-xs text-[var(--text-tertiary)]">Stores</label>
          <div className="flex flex-wrap gap-2">
            {STORE_LIST.map((n) => (
              <label key={n} className="flex cursor-pointer items-center gap-1.5 rounded-md border border-[var(--border-default)] bg-[var(--bg-overlay)] px-2.5 py-1.5 text-xs">
                <input type="checkbox" checked={storeIds.includes(n)} onChange={() => toggleStore(n)} className="h-4 w-4 accent-[var(--brand)]" />
                {n}
              </label>
            ))}
            <button type="button" onClick={setAllStores} className="rounded-md border border-[var(--border-default)] px-2.5 py-1.5 text-xs text-[var(--text-secondary)]">
              All
            </button>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs text-[var(--text-tertiary)]">Start Date</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-overlay)] px-3 py-2 text-[var(--text-primary)]"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-[var(--text-tertiary)]">End Date (optional)</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-overlay)] px-3 py-2 text-[var(--text-primary)]"
          />
        </div>
      </div>
      <div className="mt-4">
        <label className="mb-1 block text-xs text-[var(--text-tertiary)]">Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-overlay)] px-3 py-2 text-[var(--text-primary)]"
          placeholder="Optional notes"
        />
      </div>
      <div className="mt-4 flex gap-2">
        <button
          onClick={handleSave}
          disabled={saving || !name.trim()}
          className="rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save Special'}
        </button>
        <button onClick={onClose} className="rounded-lg border border-[var(--border-default)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)]">
          Cancel
        </button>
      </div>
    </div>
  )
}

function VerdictBadge({ verdict }: { verdict: { label: string; color: string } }) {
  const bg =
    verdict.color === 'green' ? 'bg-green-500/20 text-green-400'
    : verdict.color === 'red' ? 'bg-red-500/20 text-red-400'
    : verdict.color === 'yellow' ? 'bg-amber-500/20 text-amber-400'
    : verdict.color === 'blue' ? 'bg-blue-500/20 text-blue-400'
    : 'bg-gray-500/20 text-gray-400'
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${bg}`}>
      {verdict.label}
    </span>
  )
}

function SpecialCard({
  special,
  impact,
  selectedStore,
  vsLastYearLoading,
  history,
  showHistory,
  onLoadImpact,
  onLoadHistory,
  onAction,
}: {
  special: Special
  impact: SpecialImpact | undefined
  selectedStore: string
  vsLastYearLoading?: boolean
  history: SpecialHistoryRow[] | undefined
  showHistory: boolean
  onLoadImpact: () => void
  onLoadHistory: () => void
  onAction: (action: string, notes?: string) => void
}) {
  const [mounted, setMounted] = useState(false)
  const [expanded, setExpanded] = useState(true)
  const [compareMode, setCompareMode] = useState<'lastYear' | 'lastWeek'>('lastYear')
  const [showStoreBreakdown, setShowStoreBreakdown] = useState(false)
  const daysRunning = differenceInDays(new Date(), new Date(special.start_date))
  const platformLabel = special.platform.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

  const displayImpact: ComparisonMetrics | null =
    selectedStore === 'all'
      ? impact ?? null
      : impact?.rawBeforeData && impact?.rawAfterData
        ? getStoreMetrics(selectedStore, impact.rawBeforeData, impact.rawAfterData, special.platform, daysRunning)
        : null
  const displayVsLastYear: ComparisonMetrics | null =
    selectedStore === 'all'
      ? impact?.vsLastYear ?? null
      : impact?.rawLyAfterData && impact?.rawAfterData
        ? getStoreMetrics(selectedStore, impact.rawLyAfterData, impact.rawAfterData, special.platform, daysRunning)
        : null

  const verdict = impact
    ? selectedStore === 'all'
      ? getAggregateVerdict(
          special.platform,
          impact,
          special.store_ids,
          compareMode,
          daysRunning
        )
      : (() => {
          const source = compareMode === 'lastYear' ? displayVsLastYear : displayImpact
          return source ? getVerdict(special.platform, source) : { label: '⏳ Loading…', color: 'gray', reason: '' }
        })()
    : { label: '⏳ Loading…', color: 'gray', reason: '' }

  useEffect(() => {
    if (!mounted) {
      setMounted(true)
      onLoadImpact()
    }
  }, [mounted, onLoadImpact])

  const verdictBg =
    verdict.color === 'green' ? 'bg-green-500/10 border-green-500/30'
    : verdict.color === 'red' ? 'bg-red-500/10 border-red-500/30'
    : verdict.color === 'yellow' ? 'bg-amber-500/10 border-amber-500/30'
    : verdict.color === 'blue' ? 'bg-blue-500/10 border-blue-500/30'
    : 'bg-gray-500/10 border-gray-500/30'

  const recentMetrics = (() => {
    const source = compareMode === 'lastYear' ? displayVsLastYear : displayImpact
    if (!source) return []
    return [
      { label: 'Net Sales', value: source.after.netSales.toLocaleString(), change: source.netSalesChange },
      { label: 'Labor %', value: source.after.laborPct.toFixed(1) + '%', change: source.laborChange },
      { label: 'DoorDash (DDD)', value: source.after.dddSales.toLocaleString(), change: source.ddSalesChange },
    ]
  })()

  const recentSectionTitle = compareMode === 'lastYear' ? 'VS SAME PERIOD LAST YEAR' : 'VS LAST WEEK'
  const recentSectionSuffix = compareMode === 'lastYear' ? 'vs last year' : 'vs last week'

  const comparisonMetrics = (() => {
    const source = compareMode === 'lastYear' ? displayVsLastYear : displayImpact
    if (!source) return []
    return [
      { label: 'Net Sales', before: source.before.netSales.toLocaleString(), after: source.after.netSales.toLocaleString(), change: source.netSalesChange, isGood: source.netSalesChange > 0, isPctPoints: false },
      { label: 'Labor %', before: source.before.laborPct.toFixed(1) + '%', after: source.after.laborPct.toFixed(1) + '%', change: source.laborChange, isGood: source.laborChange < 0, isPctPoints: true },
      { label: 'DoorDash (DDD)', before: source.before.dddSales.toLocaleString(), after: source.after.dddSales.toLocaleString(), change: source.ddSalesChange, isGood: source.ddSalesChange > 0, isPctPoints: false },
      { label: 'Aggregator (DD+UE+GH)', before: source.before.aggregatorSales.toLocaleString(), after: source.after.aggregatorSales.toLocaleString(), change: source.ueSalesChange, isGood: source.ueSalesChange > 0, isPctPoints: false },
    ]
  })()

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
      {/* Header row — always visible, clickable to expand/collapse */}
      <div
        className="flex flex-wrap items-center justify-between gap-2 cursor-pointer"
        role="button"
        tabIndex={0}
        onClick={() => setExpanded((e) => !e)}
        onKeyDown={(e) => e.key === 'Enter' && setExpanded((x) => !x)}
        aria-expanded={expanded}
        aria-label={expanded ? 'Collapse special' : 'Expand special'}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-bold text-white">{special.name}</span>
          <span className="rounded-full bg-orange-500/20 px-2 py-0.5 text-xs text-orange-400">
            {platformLabel}
          </span>
          <span className="text-sm text-gray-400">
            Stores: {special.store_ids.join(', ')}
          </span>
          <span className="text-xs text-gray-500">
            {special.start_date} — {special.end_date ?? 'ongoing'} · {daysRunning} days
          </span>
        </div>
        <div className="flex items-center gap-2">
          <VerdictBadge verdict={verdict} />
          <span
            className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-gray-600 bg-gray-800 text-gray-400 transition hover:bg-gray-700 hover:text-white"
            aria-hidden
          >
            {expanded ? (
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
            ) : (
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            )}
          </span>
        </div>
      </div>

      {expanded && (
        <>
      {selectedStore !== 'all' && (
        <div className="mt-3 text-xs font-medium text-orange-400">
          Showing: Store {selectedStore}
        </div>
      )}

      {recentMetrics.length > 0 && (
        <div className="mt-4 rounded-lg bg-gray-800 p-3">
          <div className="mb-2 text-xs uppercase text-gray-400">{recentSectionTitle}</div>
          <div className="grid grid-cols-3 gap-3">
            {recentMetrics.map((m) => (
              <div key={m.label}>
                <div className="text-xs text-gray-400">{m.label}</div>
                <div className="font-bold text-white">{m.value}</div>
                <div className={m.label === 'Labor %' ? (m.change <= 0 ? 'text-xs text-green-400' : 'text-xs text-red-400') : (m.change > 0 ? 'text-xs text-green-400' : 'text-xs text-red-400')}>
                  {formatChange(m.change, m.label === 'Labor %')} {recentSectionSuffix}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {comparisonMetrics.length > 0 && (
        <table className="mt-4 w-full text-sm">
          <thead>
            <tr className="text-xs uppercase text-gray-400">
              <th className="py-1 text-left">Metric</th>
              <th className="text-right">Before</th>
              <th className="text-right">After</th>
              <th className="text-right">Change</th>
            </tr>
          </thead>
          <tbody>
            {comparisonMetrics.map((m) => (
              <tr key={m.label} className="border-t border-gray-800">
                <td className="py-2 text-gray-300">{m.label}</td>
                <td className="text-right text-gray-400">{m.before}</td>
                <td className="text-right text-white">{m.after}</td>
                <td className={`text-right font-bold ${m.isGood ? 'text-green-400' : 'text-red-400'}`}>
                  {formatChange(m.change, m.isPctPoints)} {m.isGood ? '✅' : '⚠️'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {impact && (
        <>
          <div className="mb-3 mt-3 flex gap-2">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setCompareMode('lastYear') }}
              className={`rounded-full border px-3 py-1 text-xs ${
                compareMode === 'lastYear'
                  ? 'border-orange-500 bg-orange-500 text-white'
                  : 'border-gray-600 text-gray-400'
              }`}
            >
              vs Same Period Last Year
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setCompareMode('lastWeek') }}
              className={`rounded-full border px-3 py-1 text-xs ${
                compareMode === 'lastWeek'
                  ? 'border-orange-500 bg-orange-500 text-white'
                  : 'border-gray-600 text-gray-400'
              }`}
            >
              vs Last Week
            </button>
          </div>
          <div className="rounded-lg bg-gray-800 p-3 text-xs">
            {compareMode === 'lastYear' ? (
              <>
                <div className="mb-2 uppercase text-gray-400">vs Last Year (Same Period)</div>
                {vsLastYearLoading ? (
                  <div className="flex items-center gap-2 text-gray-400">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-600 border-t-gray-400" />
                    Loading…
                  </div>
                ) : displayVsLastYear ? (
                  <div className="flex flex-wrap gap-4">
                    <span>
                      Net Sales{' '}
                      <span className={displayVsLastYear.netSalesChange >= 0 ? 'text-green-400' : 'text-red-400'}>
                        {displayVsLastYear.netSalesChange >= 0 ? '▲' : '▼'}
                        {Math.abs(displayVsLastYear.netSalesChange).toFixed(1)}%
                      </span>
                    </span>
                    <span>
                      DD{' '}
                      <span className={displayVsLastYear.ddSalesChange >= 0 ? 'text-green-400' : 'text-red-400'}>
                        {displayVsLastYear.ddSalesChange >= 0 ? '▲' : '▼'}
                        {Math.abs(displayVsLastYear.ddSalesChange).toFixed(1)}%
                      </span>
                    </span>
                    <span>
                      Labor{' '}
                      <span className={displayVsLastYear.laborChange <= 0 ? 'text-green-400' : 'text-red-400'}>
                        {formatChange(displayVsLastYear.laborChange, true)}
                      </span>
                    </span>
                  </div>
                ) : (
                  <span className="text-gray-500">—</span>
                )}
              </>
            ) : (
              <>
                <div className="mb-2 uppercase text-gray-400">vs Last Week</div>
                {displayImpact ? (
                  <div className="flex flex-wrap gap-4">
                    <span>
                      Net Sales{' '}
                      <span className={displayImpact.netSalesChange >= 0 ? 'text-green-400' : 'text-red-400'}>
                        {displayImpact.netSalesChange >= 0 ? '▲' : '▼'}
                        {Math.abs(displayImpact.netSalesChange).toFixed(1)}%
                      </span>
                    </span>
                    <span>
                      DD{' '}
                      <span className={displayImpact.ddSalesChange >= 0 ? 'text-green-400' : 'text-red-400'}>
                        {displayImpact.ddSalesChange >= 0 ? '▲' : '▼'}
                        {Math.abs(displayImpact.ddSalesChange).toFixed(1)}%
                      </span>
                    </span>
                    <span>
                      Labor{' '}
                      <span className={displayImpact.laborChange <= 0 ? 'text-green-400' : 'text-red-400'}>
                        {formatChange(displayImpact.laborChange, true)}
                      </span>
                    </span>
                  </div>
                ) : (
                  <span className="text-gray-500">—</span>
                )}
              </>
            )}
          </div>

          {/* Store Breakdown — collapsible */}
          <div className="mt-4">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setShowStoreBreakdown(!showStoreBreakdown) }}
              className="flex items-center gap-1 text-xs text-orange-400 hover:text-orange-300"
            >
              {showStoreBreakdown ? '▲' : '▼'} Store Breakdown
            </button>
            {showStoreBreakdown && (() => {
              const beforeData = compareMode === 'lastYear' ? impact.rawLyAfterData : impact.rawBeforeData
              const afterData = compareMode === 'lastYear' ? impact.rawAfterData : impact.rawAfterData
              const formatMetricVal = (v: number) =>
                METRICS.find((m) => m.key === 'net_sales')?.fmt(v) ?? v.toLocaleString()
              if (!beforeData || !afterData) {
                return (
                  <div className="mt-3 text-xs text-gray-500">Loading store data…</div>
                )
              }
              return (
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {special.store_ids.map((storeId) => {
                    const storeMetrics = getStoreMetrics(
                      storeId,
                      beforeData,
                      afterData,
                      special.platform,
                      daysRunning
                    )
                    if (!storeMetrics) return null
                    const storeVerdict = getVerdict(special.platform, storeMetrics)
                    const primaryChange =
                      special.platform === 'doordash'
                        ? storeMetrics.ddSalesChange
                        : special.platform === 'ubereats'
                          ? storeMetrics.ueSalesChange
                          : storeMetrics.netSalesChange
                    const verdictBg =
                      storeVerdict.color === 'green' ? 'bg-green-500/20 text-green-400'
                      : storeVerdict.color === 'red' ? 'bg-red-500/20 text-red-400'
                      : storeVerdict.color === 'yellow' ? 'bg-yellow-500/20 text-yellow-400'
                      : 'bg-gray-500/20 text-gray-400'
                    return (
                      <div
                        key={storeId}
                        className="rounded-lg border-l-2 bg-gray-800 p-3"
                        style={{ borderLeftColor: STORE_COLORS[storeId] ?? '#888' }}
                      >
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-sm font-bold text-white">Store {storeId}</span>
                          <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${verdictBg}`}>
                            {storeVerdict.label}
                          </span>
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-400">Net Sales</span>
                            <span className={storeMetrics.netSalesChange >= 0 ? 'text-green-400' : 'text-red-400'}>
                              {storeMetrics.netSalesChange >= 0 ? '▲' : '▼'}
                              {Math.abs(storeMetrics.netSalesChange).toFixed(1)}% vs {compareMode === 'lastYear' ? 'LY' : 'LW'}
                            </span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-400">
                              {special.platform === 'doordash' ? 'DoorDash (DDD)' : special.platform === 'ubereats' ? 'Aggregator (DD+UE+GH)' : 'Net Sales'}
                            </span>
                            <span className={primaryChange >= 0 ? 'text-green-400' : 'text-red-400'}>
                              {primaryChange >= 0 ? '▲' : '▼'}
                              {Math.abs(primaryChange).toFixed(1)}% vs {compareMode === 'lastYear' ? 'LY' : 'LW'}
                            </span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-400">Labor %</span>
                            <span className={storeMetrics.laborChange <= 0 ? 'text-green-400' : 'text-red-400'}>
                              {formatChange(storeMetrics.laborChange, true)} vs {compareMode === 'lastYear' ? 'LY' : 'LW'}
                            </span>
                          </div>
                        </div>
                        <div className="mt-2 text-xs text-gray-500">
                          Before: {formatMetricVal(storeMetrics.before.netSales)} → After: {formatMetricVal(storeMetrics.after.netSales)}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })()}
          </div>
        </>
      )}

      <div className={`mt-4 rounded-lg border p-3 ${verdictBg}`}>
        <div className="font-bold">{verdict.label}</div>
        <div className="mt-1 text-sm text-gray-300">{verdict.reason}</div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {special.status === 'active' && (
          <>
            <button
              onClick={() => onAction('paused')}
              className="rounded-lg border border-gray-600 bg-gray-800 px-3 py-1.5 text-sm text-gray-300 hover:bg-gray-700"
            >
              Pause
            </button>
            <button
              onClick={() => onAction('stopped')}
              className="rounded-lg border border-gray-600 bg-gray-800 px-3 py-1.5 text-sm text-gray-300 hover:bg-gray-700"
            >
              Stop
            </button>
            <button
              onClick={() => onAction('extended')}
              className="rounded-lg border border-gray-600 bg-gray-800 px-3 py-1.5 text-sm text-gray-300 hover:bg-gray-700"
            >
              Extend
            </button>
          </>
        )}
        <button
          onClick={onLoadHistory}
          className="rounded-lg border border-gray-600 bg-gray-800 px-3 py-1.5 text-sm text-gray-300 hover:bg-gray-700"
        >
          History
        </button>
      </div>

      {showHistory && Array.isArray(history) && (
        <div className="mt-4 rounded-lg border border-gray-700 bg-gray-800/50 p-3">
          <div className="mb-2 text-xs font-semibold uppercase text-gray-400">History</div>
          <ul className="space-y-1 text-sm text-gray-300">
            {history.map((h) => (
              <li key={h.id}>
                {new Date(h.created_at).toLocaleString()} — {h.action}
                {h.notes ? `: ${h.notes}` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}
        </>
      )}
    </div>
  )
}
