'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
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
import NavBar from '@/components/NavBar'

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
  { key: 'net_sales', label: 'Net Sales', fmt: (v: number) => `$${v?.toLocaleString()}`, color: '#3b82f6', unit: '$' as const },
  { key: 'labor_pct', label: 'Labor %', fmt: (v: number) => `${v}%`, color: '#f59e0b', unit: '%' as const },
  { key: 'food_cost_pct', label: 'Food Cost %', fmt: (v: number) => `${v}%`, color: '#8b5cf6', unit: '%' as const },
  { key: 'flm_pct', label: 'FLM %', fmt: (v: number) => `${v}%`, color: '#ec4899', unit: '%' as const },
  { key: 'doordash_sales', label: 'DoorDash (DDD)', fmt: (v: number) => `$${v?.toLocaleString()}`, color: '#f97316', unit: '$' as const, tooltip: 'DoorDash marketplace + DDDCash orders from cube [DDD Net Sales USD]' },
  { key: 'ubereats_sales', label: 'Aggregator (DD+UE+GH)', fmt: (v: number) => `$${v?.toLocaleString()}`, color: '#06b6d4', unit: '$' as const, tooltip: 'Combined DoorDash + UberEats + GrubHub from cube [TY Aggregator Delivery Net Sales USD]. May differ slightly from POS due to timing.' },
] as const
type MetricKey = (typeof METRICS)[number]['key']

/** For labor/food cost/FLM, lower is better (decrease = good). For sales, higher is better. */
function isMetricImprovement(metricKeyOrLabel: string, change: number): boolean {
  if (['labor_pct', 'food_cost_pct', 'flm_pct', 'Labor %', 'Food Cost %', 'FLM %'].includes(metricKeyOrLabel)) {
    return change < 0 // decrease is good
  }
  return change > 0 // sales/revenue: increase is good
}

/** True when lower values are better (used for best/worst and vs peak). */
function isLowerBetterMetric(metricKey: string): boolean {
  return ['labor_pct', 'food_cost_pct', 'flm_pct'].includes(metricKey)
}

const METRIC_TARGETS: Partial<Record<MetricKey, number>> = {
  flm_pct: 55,
  food_cost_pct: 25,
  labor_pct: 28.68,
}

type ChartDataPoint = Record<string, number | string>

type TrendsTab = 'chart' | 'specials'

type TooltipPayloadItem = { dataKey: string; value: number; color: string }

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

type DailyReportRaw = {
  report_date: string
  net_sales?: number | null
  labor_pct?: number | null
  food_cost_pct?: number | null
  flm_pct?: number | null
  cash_short?: number | null
  doordash_sales?: number | null
  ubereats_sales?: number | null
  stores?: { store_number?: string | number; number?: string } | null
  store_id?: string
}

type ImpactBySpecial = Record<string, SpecialImpact>
type VsLastYearLoadingBySpecial = Record<string, boolean>
type HistoryBySpecial = Record<string, SpecialHistoryRow[]>

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
  return (before > 0 ? ((after - before) / before) * 100 : 0)
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

function getYesterdayDate(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return d.toISOString().split('T')[0]
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
  const [chartData, setChartData] = useState<ChartDataPoint[]>([])
  const [loading, setLoading] = useState(false)
  const [specials, setSpecials] = useState<Special[]>([])
  const [specialsFilter, setSpecialsFilter] = useState<'active' | 'history' | 'all'>('active')
  const [addSpecialOpen, setAddSpecialOpen] = useState(false)
  const [storeFilter, setStoreFilter] = useState<string>('all')
  const [impactBySpecial, setImpactBySpecial] = useState<ImpactBySpecial>({})
  const [vsLastYearLoadingBySpecial, setVsLastYearLoadingBySpecial] = useState<VsLastYearLoadingBySpecial>({})
  const [historyBySpecial, setHistoryBySpecial] = useState<HistoryBySpecial>({})
  const [showHistoryId, setShowHistoryId] = useState<string | null>(null)
  const [trendsTab, setTrendsTab] = useState<TrendsTab>('chart')
  const [showVsLY, setShowVsLY] = useState(false)
  const [lyChartData, setLyChartData] = useState<ChartDataPoint[]>([])

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
      const data: ChartDataPoint[] = dates.map((dateStr, i) => {
        const storesList: CubeStoreRow[] = results[i]?.stores ?? []
        const point: ChartDataPoint = {
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

  // When showVsLY is true, fetch same period last year for each date in the chart
  useEffect(() => {
    if (!showVsLY || chartData.length === 0 || storesSelected.length === 0) {
      setLyChartData([])
      return
    }
    const config = periodConfig[period]
    const dates =
      config.period === 'weekly'
        ? getPrevWeeks(getLastCompleteWeek(), config.count)
        : getPrevMonths(getLastCompleteMonth(), config.count)
    const toLastYear = (d: string) => {
      if (d.includes('-W')) {
        const [y, w] = d.split('-W')
        return `${parseInt(y, 10) - 1}-W${w}`
      }
      const [y, m] = d.split('-')
      return `${parseInt(y, 10) - 1}-${m}`
    }
    const lyDates = dates.map(toLastYear)
    Promise.all(
      lyDates.map((d) =>
        fetch(`/api/cube?date=${encodeURIComponent(d)}&period=${config.period}`, { cache: 'no-store' }).then((r) => r.json())
      )
    ).then((results) => {
      const data: ChartDataPoint[] = dates.map((dateStr, i) => {
        const storesList: CubeStoreRow[] = results[i]?.stores ?? []
        const point: ChartDataPoint = { date: dateStr, label: config.period === 'weekly' ? `W${i + 1}` : formatMonthLabel(dateStr) }
        storesSelected.forEach((storeNum) => {
          const s = storesList.find((x) => String(x.storeNumber) === storeNum)
          point[`${storeNum}_ly`] = s ? getMetricFromStore(s, metric) : 0
        })
        return point
      })
      setLyChartData(data)
    }).catch(() => setLyChartData([]))
  }, [showVsLY, chartData.length, period, storesSelected, metric])

  const mergedChartData = useMemo(() => {
    if (!showVsLY || lyChartData.length !== chartData.length || lyChartData.length === 0) return chartData
    return chartData.map((pt, i) => ({
      ...pt,
      ...Object.fromEntries(storesSelected.map((s) => [`${s}_ly`, Number(lyChartData[i]?.[`${s}_ly`]) || 0])),
    }))
  }, [chartData, lyChartData, showVsLY, storesSelected])

  const activeSpecials = specials.filter((s) => s.status === 'active')
  const activeCount = activeSpecials.length

  return (
    <div
      className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)]"
    >
      <NavBar />

      {/* Single control bar — sticky below nav (only when Trends Chart tab is selected) */}
      {trendsTab === 'chart' && (
      <div
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 10,
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexWrap: 'wrap',
          position: 'sticky',
          top: 56,
          zIndex: 40,
        }}
      >
        {/* Metric chips */}
        {METRICS.map((m) => (
          <button
            key={m.key}
            type="button"
            onClick={() => setMetric(m.key)}
            title={'tooltip' in m ? m.tooltip : undefined}
            style={{
              padding: '4px 11px',
              borderRadius: 6,
              border: metric === m.key ? 'none' : '1px solid var(--border-subtle)',
              background: metric === m.key ? 'var(--brand)' : 'transparent',
              color: metric === m.key ? '#fff' : 'var(--text-tertiary)',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: "'Inter', sans-serif",
            }}
          >
            {m.label}
            {'tooltip' in m && m.tooltip && (
              <span style={{ marginLeft: 4, cursor: 'help', opacity: 0.7 }} title={m.tooltip} aria-label="Info">ⓘ</span>
            )}
          </button>
        ))}

        <div style={{ width: 1, height: 20, background: 'var(--border-subtle)', margin: '0 4px' }} />

        {/* Store chips — colored border matching STORE_COLORS */}
        {STORE_LIST.map((num) => {
          const checked = storesSelected.includes(num)
          const storeColor = STORE_COLORS[num] ?? '#888'
          return (
            <label
              key={num}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                cursor: 'pointer',
                padding: '3px 10px',
                borderRadius: 6,
                border: `2px solid ${storeColor}`,
                background: checked ? `${storeColor}20` : 'transparent',
                color: checked ? storeColor : 'var(--text-tertiary)',
                fontSize: 12,
                fontWeight: 700,
                fontFamily: "'Inter', sans-serif",
              }}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() =>
                  setStoresSelected((prev) =>
                    prev.includes(num) ? prev.filter((n) => n !== num) : [...prev, num]
                  )
                }
                style={{ accentColor: 'var(--brand)', width: 14, height: 14 }}
              />
              {num}
            </label>
          )
        })}

        <div style={{ width: 1, height: 20, background: 'var(--border-subtle)', margin: '0 4px' }} />

        {/* Period chips — pill style */}
        <div style={{ display: 'flex', gap: 2 }}>
          {(['3M', '6M', '1Y', '2Y', '3Y'] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              style={{
                padding: '4px 10px',
                borderRadius: 5,
                fontSize: 12,
                fontWeight: 600,
                fontFamily: "'Inter', sans-serif",
                background: period === p ? 'var(--brand)' : 'transparent',
                color: period === p ? '#fff' : 'var(--text-tertiary)',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              {p}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setShowVsLY((v) => !v)}
          style={{
            padding: '4px 12px',
            borderRadius: 5,
            fontSize: 12,
            fontWeight: 600,
            border: '1px solid',
            cursor: 'pointer',
            fontFamily: 'inherit',
            background: showVsLY ? 'rgba(232,68,26,0.15)' : 'transparent',
            borderColor: showVsLY ? 'var(--brand)' : 'var(--border-subtle)',
            color: showVsLY ? 'var(--brand)' : 'var(--text-tertiary)',
          }}
        >
          ⇄ vs LY
        </button>
      </div>
      )}

      {/* Sub-tab strip */}
      <div
        style={{
          background: 'var(--bg-surface)',
          borderBottom: '1px solid var(--border-subtle)',
          padding: '0 28px',
          display: 'flex',
          gap: 0,
        }}
      >
        {[
          { key: 'chart' as const, label: 'Trends Chart' },
          { key: 'specials' as const, label: 'Specials Tracker' },
        ].map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTrendsTab(key)}
            style={{
              padding: '10px 16px',
              fontSize: 13,
              fontWeight: 500,
              fontFamily: "'Inter', sans-serif",
              color: trendsTab === key ? 'var(--text-primary)' : 'var(--text-tertiary)',
              borderBottom: trendsTab === key ? '2px solid var(--brand)' : '2px solid transparent',
              background: 'none',
              cursor: 'pointer',
              marginBottom: -1,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Content area */}
      <div style={{ padding: '24px 28px', maxWidth: 1440, margin: '0 auto' }}>
        {/* Tab: Trends Chart */}
        {trendsTab === 'chart' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="border border-[var(--border-subtle)] p-4" style={{ background: 'var(--bg-card, #1a1d27)', padding: 20, borderRadius: 10 }}>
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
              <>
                {showVsLY && (
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>——</span> Current period
                    <span style={{ opacity: 0.4 }}>- - -</span> Same period last year
                  </div>
                )}
              <ResponsiveContainer width="100%" height={350}>
                <ComposedChart data={showVsLY && mergedChartData.length > 0 ? mergedChartData : chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="1 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis
                    dataKey="label"
                    stroke="rgba(255,255,255,0.35)"
                    tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.35)' }}
                  />
                  <YAxis
                    stroke="rgba(255,255,255,0.35)"
                    tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.35)' }}
                    tickFormatter={(v) => METRICS.find((x) => x.key === metric)?.fmt(Number(v)) ?? String(v)}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null
                      return (
                        <div
                          style={{
                            background: '#1a1d27',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: 8,
                            fontSize: 12,
                            padding: 12,
                          }}
                        >
                          <div className="mb-2 font-medium text-[var(--text-primary)]">{label}</div>
                          {payload.map((p: TooltipPayloadItem) => (
                            <div key={p.dataKey} className="mb-1 flex items-center gap-2">
                              <div
                                className="h-2 w-2 rounded-full"
                                style={{ background: p.color }}
                              />
                              <span className="text-[var(--text-secondary)]">Store {p.dataKey.replace(/_ly$/, '')}:</span>
                              <span className="font-semibold" style={{ color: p.color }}>
                                {METRICS.find((m) => m.key === metric)?.fmt(p.value) ?? p.value}
                              </span>
                            </div>
                          ))}
                        </div>
                      )
                    }}
                  />
                  <Legend formatter={(val) => `Store ${val}`} wrapperStyle={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }} />
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
                  {showVsLY && mergedChartData.length > 0 && storesSelected.map((storeNum) => (
                    <Line
                      key={`${storeNum}_ly`}
                      type="monotone"
                      dataKey={`${storeNum}_ly`}
                      stroke={STORE_COLORS[storeNum] ?? '#888'}
                      strokeWidth={2}
                      strokeOpacity={0.35}
                      strokeDasharray="5 5"
                      dot={false}
                      activeDot={false}
                      name={`Store ${storeNum} LY`}
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
              </>
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
                <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 8, marginBottom: 0, paddingLeft: 4 }}>
                  {throughLabel}
                </p>
              ) : null
            })()}
          </div>
          {/* Store Performance cards + best/worst row — below chart when on chart tab */}
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
            const periodStartLabel = showVsLY ? 'vs same period LY' : periodStartLabels[period]
            const getLatest = (store: string) => Number(chartData[chartData.length - 1]?.[store]) || 0
            const getStart = (store: string) => {
              if (showVsLY && lyChartData.length > 0) {
                return Number(lyChartData[lyChartData.length - 1]?.[`${store}_ly`]) || 0
              }
              return Number(chartData[0]?.[store]) || 0
            }
            const getPeak = (store: string) =>
              chartData.length ? Math.max(...chartData.map((d) => Number(d[store]) || 0)) : 0
            const lowerIsBetter = isLowerBetterMetric(metric)
            const storeStats = storesSelected.map((store) => {
              const latest = getLatest(store)
              const start = getStart(store)
              const peak = getPeak(store)
              const change = start !== 0 ? ((latest - start) / start) * 100 : 0
              const fromPeak = peak !== 0 ? ((latest - peak) / peak) * 100 : 0
              return { store, latest, start, peak, change, fromPeak }
            })
            const best = storeStats.length
              ? (lowerIsBetter
                  ? storeStats.reduce((a, b) => (a.latest <= b.latest ? a : b))
                  : storeStats.reduce((a, b) => (a.change >= b.change ? a : b)))
              : null
            const worst = storeStats.length
              ? (lowerIsBetter
                  ? storeStats.reduce((a, b) => (a.latest >= b.latest ? a : b))
                  : storeStats.reduce((a, b) => (a.change <= b.change ? a : b)))
              : null
            const avgChange = storeStats.length ? storeStats.reduce((s, x) => s + x.change, 0) / storeStats.length : 0
            const avgFromPeak = storeStats.length ? storeStats.reduce((s, x) => s + x.fromPeak, 0) / storeStats.length : 0
            const changeIsGood = (c: number) => isMetricImprovement(metric, c)
            const fromPeakIsGood = (fp: number) => (lowerIsBetter ? fp < 0 : fp >= 0)
            const targetVal = METRIC_TARGETS[metric]
            const targetLabel =
              metric === 'flm_pct' ? 'Target: <55%' : metric === 'food_cost_pct' ? 'Target: <25%' : metric === 'labor_pct' ? 'Target: <28.68%' : null
            return (
              <div className="mb-8" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 4 }}>
                  Store Performance — {selectedMetricLabel} · {period}
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                  {storeStats.map(({ store, latest, start, peak, change, fromPeak }) => {
                    const changeGood = changeIsGood(change)
                    const fromPeakGood = fromPeakIsGood(fromPeak)
                    const meetsTarget = targetVal != null ? latest < targetVal : null
                    return (
                      <div
                        key={store}
                        style={{
                          background: 'var(--bg-card, #1a1d27)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 10,
                          padding: 16,
                        }}
                      >
                        <div className="mb-3 flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full" style={{ background: STORE_COLORS[store] ?? '#888' }} />
                          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Store {store}</span>
                        </div>
                        <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>{formatMetricVal(latest)}</div>
                        {targetLabel != null && (
                          <div className="mb-1" style={{ fontSize: 10, color: meetsTarget ? '#22c55e' : '#ef4444' }}>
                            {targetLabel}
                          </div>
                        )}
                        <div className="mb-2" style={{ fontSize: 12, fontWeight: 600, color: changeGood ? '#22c55e' : '#ef4444' }}>
                          {change >= 0 ? '▲' : '▼'} {Math.abs(change).toFixed(1)}% {showVsLY ? '' : 'since '}{periodStartLabel}
                        </div>
                        <div className="mb-2">
                          <div className="mb-1 flex justify-between" style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                            <span>vs Peak</span>
                            <span style={{ color: fromPeakGood ? '#22c55e' : '#ef4444' }}>{fromPeak.toFixed(1)}%</span>
                          </div>
                          <div style={{ height: 3, borderRadius: 2, background: 'var(--border-subtle)', overflow: 'hidden' }}>
                            <div
                              style={{
                                height: '100%',
                                width: `${Math.max(0, Math.min(100, peak > 0 ? (latest / peak) * 100 : 100))}%`,
                                background: STORE_COLORS[store] ?? '#888',
                                borderRadius: 2,
                              }}
                            />
                          </div>
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>Peak: {formatMetricVal(peak)}</div>
                      </div>
                    )
                  })}
                </div>
                <div
                  style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 10,
                    padding: '12px 20px',
                    display: 'flex',
                    gap: 40,
                    flexWrap: 'wrap',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Best Performing</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                      {best ? (
                        <>Store {best.store} <span style={{ color: changeIsGood(best.change) ? '#22c55e' : '#ef4444' }}>{best.change >= 0 ? '+' : ''}{best.change.toFixed(1)}%</span></>
                      ) : (
                        '—'
                      )}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Worst Performing</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                      {worst ? (
                        <>Store {worst.store} <span style={{ color: changeIsGood(worst.change) ? '#22c55e' : '#ef4444' }}>{worst.change >= 0 ? '+' : ''}{worst.change.toFixed(1)}%</span></>
                      ) : (
                        '—'
                      )}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Avg Change All Stores</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: changeIsGood(avgChange) ? '#22c55e' : '#ef4444' }}>
                      {avgChange >= 0 ? '▲' : '▼'} {Math.abs(avgChange).toFixed(1)}%
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>All Stores vs Peak</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: fromPeakIsGood(avgFromPeak) ? '#22c55e' : '#ef4444' }}>
                      {avgFromPeak <= 0 ? '▼' : '▲'} {Math.abs(avgFromPeak).toFixed(1)}% {avgFromPeak <= 0 ? 'below peak' : 'above peak'}
                    </div>
                  </div>
                </div>
              </div>
            )
          })()}
          </div>
        )}
        {trendsTab === 'specials' && (
          <section style={{ padding: 0 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
            <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
              Specials Tracker
            </h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
              <button
                onClick={() => setAddSpecialOpen(true)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 600,
                  background: 'var(--brand)',
                  color: '#fff',
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                + Add Special
              </button>
              <div style={{ display: 'flex', gap: 2 }}>
                <button
                  onClick={() => setSpecialsFilter('active')}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 5,
                    fontSize: 12,
                    fontWeight: 600,
                    fontFamily: 'inherit',
                    background: specialsFilter === 'active' ? 'var(--brand)' : 'transparent',
                    color: specialsFilter === 'active' ? '#fff' : 'var(--text-tertiary)',
                    border: specialsFilter === 'active' ? 'none' : '1px solid var(--border-subtle)',
                    cursor: 'pointer',
                  }}
                >
                  Active ●{activeCount}
                </button>
                <button
                  onClick={() => setSpecialsFilter('history')}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 5,
                    fontSize: 12,
                    fontWeight: 600,
                    fontFamily: 'inherit',
                    background: specialsFilter === 'history' ? 'var(--brand)' : 'transparent',
                    color: specialsFilter === 'history' ? '#fff' : 'var(--text-tertiary)',
                    border: specialsFilter === 'history' ? 'none' : '1px solid var(--border-subtle)',
                    cursor: 'pointer',
                  }}
                >
                  History
                </button>
                <button
                  onClick={() => setSpecialsFilter('all')}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 5,
                    fontSize: 12,
                    fontWeight: 600,
                    fontFamily: 'inherit',
                    background: specialsFilter === 'all' ? 'var(--brand)' : 'transparent',
                    color: specialsFilter === 'all' ? '#fff' : 'var(--text-tertiary)',
                    border: specialsFilter === 'all' ? 'none' : '1px solid var(--border-subtle)',
                    cursor: 'pointer',
                  }}
                >
                  All
                </button>
              </div>
              <select
                value={storeFilter}
                onChange={(e) => setStoreFilter(e.target.value)}
                style={{
                  fontSize: 12,
                  padding: '4px 10px',
                  borderRadius: 6,
                  background: 'var(--bg-overlay)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-primary)',
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                }}
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

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
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
        )}
      </div>
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
  const style =
    verdict.color === 'green' ? { background: 'rgba(34,197,94,0.15)', color: '#22c55e' }
    : verdict.color === 'red' ? { background: 'rgba(239,68,68,0.15)', color: '#ef4444' }
    : verdict.color === 'yellow' ? { background: 'rgba(234,179,8,0.15)', color: '#eab308' }
    : verdict.color === 'blue' ? { background: 'rgba(59,130,246,0.15)', color: '#3b82f6' }
    : { background: 'rgba(107,114,128,0.15)', color: '#9ca3af' }
  return (
    <span style={{ borderRadius: 9999, padding: '2px 8px', fontSize: 11, fontWeight: 600, ...style }}>
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
    <div
      style={{
        background: 'var(--bg-card, #1a1d27)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 10,
        padding: '12px 16px',
      }}
    >
      {/* Header row — always visible, clickable to expand/collapse */}
      <div
        style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10, cursor: 'pointer' }}
        role="button"
        tabIndex={0}
        onClick={() => setExpanded((e) => !e)}
        onKeyDown={(e) => e.key === 'Enter' && setExpanded((x) => !x)}
        aria-expanded={expanded}
        aria-label={expanded ? 'Collapse special' : 'Expand special'}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{special.name}</span>
          <span
            style={{
              padding: '2px 8px',
              borderRadius: 4,
              fontSize: 11,
              fontWeight: 600,
              background: 'rgba(255,100,0,0.15)',
              color: '#ff6400',
              border: '1px solid rgba(255,100,0,0.2)',
            }}
          >
            {platformLabel}
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
            Stores: {special.store_ids.join(', ')}
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
            {special.start_date} — {special.end_date ?? 'ongoing'}
          </span>
          <span
            style={{
              fontSize: 10,
              padding: '1px 6px',
              borderRadius: 10,
              background: 'var(--bg-overlay)',
              color: 'var(--text-tertiary)',
            }}
          >
            {daysRunning} days
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <VerdictBadge verdict={verdict} />
          <span
            style={{
              display: 'inline-flex',
              width: 28,
              height: 28,
              flexShrink: 0,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 5,
              border: '1px solid var(--border-subtle)',
              background: 'var(--bg-overlay)',
              color: 'var(--text-tertiary)',
              cursor: 'pointer',
            }}
            aria-hidden
          >
            {expanded ? (
              <svg width={14} height={14} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
            ) : (
              <svg width={14} height={14} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            )}
          </span>
        </div>
      </div>

      {expanded && (
        <>
      {selectedStore !== 'all' && (
        <div style={{ marginTop: 8, fontSize: 11, fontWeight: 500, color: 'var(--brand)' }}>
          Showing: Store {selectedStore}
        </div>
      )}

      {recentMetrics.length > 0 && (
        <div
          style={{
            marginTop: 8,
            background: 'var(--bg-overlay)',
            borderRadius: 8,
            padding: '12px 16px',
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: 'var(--text-tertiary)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: 10,
            }}
          >
            {recentSectionTitle}
          </div>
          <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
            {recentMetrics.map((m) => (
              <div key={m.label}>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {m.label}
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>{m.value}</div>
                <div
                  style={{
                    fontSize: 11,
                    color: m.label === 'Labor %' ? (m.change <= 0 ? '#22c55e' : '#ef4444') : (m.change > 0 ? '#22c55e' : '#ef4444'),
                  }}
                >
                  {formatChange(m.change, m.label === 'Labor %')} {recentSectionSuffix}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {comparisonMetrics.length > 0 && (
        <table style={{ width: '100%', marginTop: 12, borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '6px 0', textAlign: 'left' }}>Metric</th>
              <th style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '6px 0', textAlign: 'right' }}>Before</th>
              <th style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '6px 0', textAlign: 'right' }}>After</th>
              <th style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '6px 0', textAlign: 'right' }}>Change</th>
            </tr>
          </thead>
          <tbody>
            {comparisonMetrics.map((m) => (
              <tr key={m.label} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                <td style={{ fontSize: 13, padding: '8px 0', color: 'var(--text-primary)' }}>{m.label}</td>
                <td style={{ fontSize: 13, padding: '8px 0', textAlign: 'right', color: 'var(--text-tertiary)' }}>{m.before}</td>
                <td style={{ fontSize: 13, padding: '8px 0', textAlign: 'right', color: 'var(--text-primary)' }}>{m.after}</td>
                <td style={{ padding: '8px 0', textAlign: 'right' }}>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '2px 8px',
                      borderRadius: 4,
                      fontSize: 11,
                      fontWeight: 600,
                      background: m.isGood ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                      color: m.isGood ? '#22c55e' : '#ef4444',
                    }}
                  >
                    {formatChange(m.change, m.isPctPoints)}
                    {!m.isGood && <span style={{ color: '#f59e0b', fontSize: 10 }}>⚠</span>}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {impact && (
        <>
          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setCompareMode('lastYear') }}
              style={{
                padding: '4px 12px',
                borderRadius: 5,
                fontSize: 11,
                fontWeight: 600,
                fontFamily: 'inherit',
                background: compareMode === 'lastYear' ? 'var(--brand)' : 'transparent',
                color: compareMode === 'lastYear' ? '#fff' : 'var(--text-tertiary)',
                border: compareMode === 'lastYear' ? 'none' : '1px solid var(--border-subtle)',
                cursor: 'pointer',
              }}
            >
              vs Same Period Last Year
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setCompareMode('lastWeek') }}
              style={{
                padding: '4px 12px',
                borderRadius: 5,
                fontSize: 11,
                fontWeight: 600,
                fontFamily: 'inherit',
                background: compareMode === 'lastWeek' ? 'var(--brand)' : 'transparent',
                color: compareMode === 'lastWeek' ? '#fff' : 'var(--text-tertiary)',
                border: compareMode === 'lastWeek' ? 'none' : '1px solid var(--border-subtle)',
                cursor: 'pointer',
              }}
            >
              vs Last Week
            </button>
          </div>
          <div style={{ marginTop: 8, background: 'var(--bg-overlay)', borderRadius: 8, padding: '12px 16px', fontSize: 12 }}>
            {compareMode === 'lastYear' ? (
              <>
                <div style={{ marginBottom: 8, fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>vs Last Year (Same Period)</div>
                {vsLastYearLoading ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-tertiary)' }}>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--border-subtle)] border-t-[var(--text-tertiary)]" />
                    Loading…
                  </div>
                ) : displayVsLastYear ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
                    <span>
                      Net Sales{' '}
                      <span style={{ color: displayVsLastYear.netSalesChange >= 0 ? '#22c55e' : '#ef4444' }}>
                        {displayVsLastYear.netSalesChange >= 0 ? '▲' : '▼'}
                        {Math.abs(displayVsLastYear.netSalesChange).toFixed(1)}%
                      </span>
                    </span>
                    <span>
                      DD{' '}
                      <span style={{ color: displayVsLastYear.ddSalesChange >= 0 ? '#22c55e' : '#ef4444' }}>
                        {displayVsLastYear.ddSalesChange >= 0 ? '▲' : '▼'}
                        {Math.abs(displayVsLastYear.ddSalesChange).toFixed(1)}%
                      </span>
                    </span>
                    <span>
                      Labor{' '}
                      <span style={{ color: displayVsLastYear.laborChange <= 0 ? '#22c55e' : '#ef4444' }}>
                        {formatChange(displayVsLastYear.laborChange, true)}
                      </span>
                    </span>
                  </div>
                ) : (
                  <span style={{ color: 'var(--text-tertiary)' }}>—</span>
                )}
              </>
            ) : (
              <>
                <div style={{ marginBottom: 8, fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>vs Last Week</div>
                {displayImpact ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
                    <span>
                      Net Sales{' '}
                      <span style={{ color: displayImpact.netSalesChange >= 0 ? '#22c55e' : '#ef4444' }}>
                        {displayImpact.netSalesChange >= 0 ? '▲' : '▼'}
                        {Math.abs(displayImpact.netSalesChange).toFixed(1)}%
                      </span>
                    </span>
                    <span>
                      DD{' '}
                      <span style={{ color: displayImpact.ddSalesChange >= 0 ? '#22c55e' : '#ef4444' }}>
                        {displayImpact.ddSalesChange >= 0 ? '▲' : '▼'}
                        {Math.abs(displayImpact.ddSalesChange).toFixed(1)}%
                      </span>
                    </span>
                    <span>
                      Labor{' '}
                      <span style={{ color: displayImpact.laborChange <= 0 ? '#22c55e' : '#ef4444' }}>
                        {formatChange(displayImpact.laborChange, true)}
                      </span>
                    </span>
                  </div>
                ) : (
                  <span style={{ color: 'var(--text-tertiary)' }}>—</span>
                )}
              </>
            )}
          </div>

          {/* Store Breakdown — collapsible */}
          <div style={{ marginTop: 12 }}>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setShowStoreBreakdown(!showStoreBreakdown) }}
              style={{ fontSize: 11, color: 'var(--brand)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}
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
                  <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-tertiary)' }}>Loading store data…</div>
                )
              }
              return (
                <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
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
                      storeVerdict.color === 'green' ? { background: 'rgba(34,197,94,0.1)', color: '#22c55e' }
                      : storeVerdict.color === 'red' ? { background: 'rgba(239,68,68,0.1)', color: '#ef4444' }
                      : storeVerdict.color === 'yellow' ? { background: 'rgba(234,179,8,0.1)', color: '#eab308' }
                      : { background: 'rgba(107,114,128,0.1)', color: '#9ca3af' }
                    return (
                      <div
                        key={storeId}
                        style={{
                          background: 'var(--bg-overlay)',
                          borderRadius: 8,
                          padding: 12,
                          borderLeft: `3px solid ${STORE_COLORS[storeId] ?? '#888'}`,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Store {storeId}</span>
                          <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4, ...verdictBg }}>
                            {storeVerdict.label}
                          </span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                            <span style={{ color: 'var(--text-tertiary)' }}>Net Sales</span>
                            <span style={{ color: storeMetrics.netSalesChange >= 0 ? '#22c55e' : '#ef4444' }}>
                              {storeMetrics.netSalesChange >= 0 ? '▲' : '▼'}
                              {Math.abs(storeMetrics.netSalesChange).toFixed(1)}% vs {compareMode === 'lastYear' ? 'LY' : 'LW'}
                            </span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                            <span style={{ color: 'var(--text-tertiary)' }}>
                              {special.platform === 'doordash' ? 'DoorDash (DDD)' : special.platform === 'ubereats' ? 'Aggregator (DD+UE+GH)' : 'Net Sales'}
                            </span>
                            <span style={{ color: primaryChange >= 0 ? '#22c55e' : '#ef4444' }}>
                              {primaryChange >= 0 ? '▲' : '▼'}
                              {Math.abs(primaryChange).toFixed(1)}% vs {compareMode === 'lastYear' ? 'LY' : 'LW'}
                            </span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                            <span style={{ color: 'var(--text-tertiary)' }}>Labor %</span>
                            <span style={{ color: storeMetrics.laborChange <= 0 ? '#22c55e' : '#ef4444' }}>
                              {formatChange(storeMetrics.laborChange, true)} vs {compareMode === 'lastYear' ? 'LY' : 'LW'}
                            </span>
                          </div>
                        </div>
                        <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-tertiary)' }}>
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

      <div style={{ marginTop: 12, padding: '12px 16px', borderRadius: 8, border: '1px solid var(--border-subtle)', ...(verdict.color === 'green' ? { background: 'rgba(34,197,94,0.08)', borderColor: 'rgba(34,197,94,0.2)' } : verdict.color === 'red' ? { background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.2)' } : verdict.color === 'yellow' ? { background: 'rgba(234,179,8,0.08)', borderColor: 'rgba(234,179,8,0.2)' } : verdict.color === 'blue' ? { background: 'rgba(59,130,246,0.08)', borderColor: 'rgba(59,130,246,0.2)' } : { background: 'var(--bg-overlay)' }) }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{verdict.label}</div>
        <div style={{ marginTop: 4, fontSize: 12, color: 'var(--text-secondary)' }}>{verdict.reason}</div>
      </div>

      <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {special.status === 'active' && (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); onAction('paused') }}
              style={{
                fontSize: 11,
                padding: '4px 10px',
                borderRadius: 5,
                background: 'var(--bg-overlay)',
                color: 'var(--text-tertiary)',
                border: '1px solid var(--border-subtle)',
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontWeight: 600,
              }}
            >
              Pause
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onAction('stopped') }}
              style={{
                fontSize: 11,
                padding: '4px 10px',
                borderRadius: 5,
                background: 'rgba(239,68,68,0.1)',
                color: '#ef4444',
                border: '1px solid rgba(239,68,68,0.2)',
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontWeight: 600,
              }}
            >
              Stop
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onAction('extended') }}
              style={{
                fontSize: 11,
                padding: '4px 10px',
                borderRadius: 5,
                background: 'var(--bg-overlay)',
                color: 'var(--text-tertiary)',
                border: '1px solid var(--border-subtle)',
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontWeight: 600,
              }}
            >
              Extend
            </button>
          </>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onLoadHistory() }}
          style={{
            fontSize: 11,
            padding: '4px 10px',
            borderRadius: 5,
            background: 'var(--bg-overlay)',
            color: 'var(--text-tertiary)',
            border: '1px solid var(--border-subtle)',
            cursor: 'pointer',
            fontFamily: 'inherit',
            fontWeight: 600,
          }}
        >
          History
        </button>
      </div>

      {showHistory && Array.isArray(history) && (
        <div style={{ marginTop: 12, padding: '12px 16px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-overlay)' }}>
          <div style={{ marginBottom: 8, fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>History</div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: 'var(--text-secondary)' }}>
            {history.map((h) => (
              <li key={h.id} style={{ marginBottom: 4 }}>
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
