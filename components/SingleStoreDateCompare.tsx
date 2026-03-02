'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'

type StoreUI = {
  id: string
  number: string
  name: string
  location: string
}

type Metric = {
  key: string
  label: string
  fmt: (v: number) => string
  color: string
  unit: '$' | '%'
}

type CubeStore = {
  storeNumber: string
  netSales: number | null
  lyNetSales: number | null
  laborPct: number | null
  foodCostUsd: number | null
  flmPct: number | null
  dddSales: number | null
  aggregatorSales: number | null
  grossSales?: number
  deliveryOrders?: number | null
  onlineOrders?: number | null
  carryoutOrders?: number | null
  aggregatorOrders?: number | null
  totalOrders?: number | null
  avgTicket?: number
  avgDiscount?: number
  appSales?: number | null
  webSales?: number | null
  onlineSales?: number | null
  phoneSales?: number | null
  carryoutPct?: number
  deliveryPct?: number
  onlinePct?: number
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

function getPrevWeek(current: string): string {
  const [y, w] = current.split('-W').map((x, i) => (i === 0 ? parseInt(x, 10) : parseInt(x, 10)))
  if (w <= 1) return `${y - 1}-W52`
  return `${y}-W${String(w - 1).padStart(2, '0')}`
}

function getPrevMonth(current: string): string {
  const [y, m] = current.split('-').map(Number)
  if (m <= 1) return `${y - 1}-12`
  return `${y}-${String(m - 1).padStart(2, '0')}`
}

function getLast7Days(): string[] {
  const dates: string[] = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  // Get Monday of current week
  const dayOfWeek = today.getDay()
  const monday = new Date(today)
  monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1))
  
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    dates.push(d.toISOString().split('T')[0])
  }
  return dates
}

function getWeekDays(): string[] {
  return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
}

function getMonthWeeks(year: number, month: number): { dates: string[], labels: string[] } {
  const firstDay = new Date(year, month - 1, 1)
  const lastDay = new Date(year, month, 0)
  const weeks: { dates: string[], labels: string[] } = { dates: [], labels: [] }
  
  let currentDate = new Date(firstDay)
  let weekNum = 1
  
  while (currentDate <= lastDay) {
    const weekStart = new Date(currentDate)
    let weekEnd = new Date(currentDate)
    weekEnd.setDate(weekEnd.getDate() + 6)
    if (weekEnd > lastDay) weekEnd = lastDay
    
    weeks.dates.push(weekStart.toISOString().split('T')[0])
    weeks.labels.push(`Week ${weekNum}`)
    
    currentDate.setDate(currentDate.getDate() + 7)
    weekNum++
  }
  
  return weeks
}

function getYearMonths(year: number): { dates: string[], labels: string[] } {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const dates: string[] = []
  const labels: string[] = []
  
  for (let m = 1; m <= 12; m++) {
    dates.push(`${year}-${String(m).padStart(2, '0')}`)
    labels.push(months[m - 1])
  }
  
  return { dates, labels }
}

function getPctChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0
  return ((current - previous) / previous) * 100
}

function isImprovement(metricKey: string, pctChange: number): boolean {
  const lowerIsBetter = ['labor_pct', 'food_cost_pct', 'flm_pct', 'avg_discount']
  return lowerIsBetter.includes(metricKey) ? pctChange < 0 : pctChange > 0
}

function getLastYearDate(date: string, period: string): string {
  if (period === 'daily') {
    return date.replace(/^(\d{4})/, (y) => String(parseInt(y) - 1))
  }
  if (period === 'monthly') {
    return date.replace(/^(\d{4})/, (y) => String(parseInt(y) - 1))
  }
  if (period === 'yearly') {
    return date.replace(/^(\d{4})/, (y) => String(parseInt(y) - 1))
  }
  if (period === 'weekly') {
    // For weekly, extract year and subtract 1
    const match = date.match(/^(\d{4})-W(\d+)$/)
    if (match) {
      const year = parseInt(match[1])
      const week = match[2]
      return `${year - 1}-W${week}`
    }
  }
  return date
}

function formatValue(v: number, unit: '$' | '%'): string {
  if (unit === '$') {
    return `$${v.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
  }
  return `${v.toFixed(1)}%`
}

type SingleStoreDateCompareProps = {
  store: StoreUI
  cubeData: CubeStore[] | null
  cubePeriod: 'daily' | 'weekly' | 'monthly' | 'yearly'
  cubeDate: string
  metrics: Metric[]
  storeColor: string
}

const COMPARE_METRICS = ['net_sales', 'labor_pct', 'food_cost_pct', 'flm_pct', 'doordash_sales', 'ubereats_sales', 'avg_ticket', 'avg_discount'] as const

export default function SingleStoreDateCompare({
  store,
  cubeData,
  cubePeriod,
  cubeDate,
  metrics,
  storeColor,
}: SingleStoreDateCompareProps) {
  const [dateMode, setDateMode] = useState<'lastWeek' | 'lastMonth' | 'lastYear'>('lastYear')
  const [expandedMetric, setExpandedMetric] = useState<string | null>(null)
  const [currWeekData, setCurrWeekData] = useState<CubeStore[] | null>(null)
  const [prevWeekData, setPrevWeekData] = useState<CubeStore[] | null>(null)
  const [currMonthData, setCurrMonthData] = useState<CubeStore[] | null>(null)
  const [prevMonthData, setPrevMonthData] = useState<CubeStore[] | null>(null)
  const [lastYearData, setLastYearData] = useState<CubeStore[] | null>(null)
  const [loadingPrev, setLoadingPrev] = useState(false)

  const currentStore = useMemo(() => {
    if (dateMode === 'lastYear') return cubeData?.find((s) => String(s.storeNumber) === store.number) ?? null
    if (dateMode === 'lastWeek') return currWeekData?.find((s) => String(s.storeNumber) === store.number) ?? null
    if (dateMode === 'lastMonth') return currMonthData?.find((s) => String(s.storeNumber) === store.number) ?? null
    return cubeData?.find((s) => String(s.storeNumber) === store.number) ?? null
  }, [cubeData, currWeekData, currMonthData, dateMode, store.number])

  // Fetch current week + previous week when "vs Previous Week" is selected
  useEffect(() => {
    if (dateMode !== 'lastWeek') return
    const currWeek = getDefaultWeek()
    const prevWeek = getPrevWeek(currWeek)
    setLoadingPrev(true)
    Promise.all([
      fetch(`/api/cube?date=${encodeURIComponent(currWeek)}&period=weekly`, { cache: 'no-store' }).then((r) => r.json()),
      fetch(`/api/cube?date=${encodeURIComponent(prevWeek)}&period=weekly`, { cache: 'no-store' }).then((r) => r.json()),
    ])
      .then(([j1, j2]) => {
        if (j1.success && Array.isArray(j1.stores)) setCurrWeekData(j1.stores)
        if (j2.success && Array.isArray(j2.stores)) setPrevWeekData(j2.stores)
      })
      .finally(() => setLoadingPrev(false))
  }, [dateMode])

  // Fetch current month + previous month when "vs Previous Month" is selected
  useEffect(() => {
    if (dateMode !== 'lastMonth') return
    const currMonth = getDefaultMonth()
    const prevMonth = getPrevMonth(currMonth)
    setLoadingPrev(true)
    Promise.all([
      fetch(`/api/cube?date=${encodeURIComponent(currMonth)}&period=monthly`, { cache: 'no-store' }).then((r) => r.json()),
      fetch(`/api/cube?date=${encodeURIComponent(prevMonth)}&period=monthly`, { cache: 'no-store' }).then((r) => r.json()),
    ])
      .then(([j1, j2]) => {
        if (j1.success && Array.isArray(j1.stores)) setCurrMonthData(j1.stores)
        if (j2.success && Array.isArray(j2.stores)) setPrevMonthData(j2.stores)
      })
      .finally(() => setLoadingPrev(false))
  }, [dateMode])

  // Fetch same period last year when "vs Same Period Last Year" is selected
  useEffect(() => {
    if (dateMode !== 'lastYear') {
      setLastYearData(null)
      return
    }
    setLoadingPrev(true)
    const lastYearDate = getLastYearDate(cubeDate, cubePeriod)
    fetch(`/api/cube?date=${encodeURIComponent(lastYearDate)}&period=${cubePeriod}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((json) => {
        if (json.success && Array.isArray(json.stores)) {
          setLastYearData(json.stores)
        }
      })
      .finally(() => setLoadingPrev(false))
  }, [dateMode, cubeDate, cubePeriod])


  const comparisonData = useMemo(() => {
    if (!currentStore) return null

    const netSales = currentStore.netSales ?? 0
    const foodCostPct = netSales && currentStore.foodCostUsd != null ? roundPct((currentStore.foodCostUsd / netSales) * 100) : 0

    let prevStore: CubeStore | null = null
    if (dateMode === 'lastYear' && lastYearData) {
      prevStore = lastYearData.find((s) => String(s.storeNumber) === store.number) ?? null
    } else if (dateMode === 'lastWeek' && prevWeekData) {
      prevStore = prevWeekData.find((s) => String(s.storeNumber) === store.number) ?? null
    } else if (dateMode === 'lastMonth' && prevMonthData) {
      prevStore = prevMonthData.find((s) => String(s.storeNumber) === store.number) ?? null
    }

    const currentValues: Record<string, number> = {
      net_sales: netSales,
      labor_pct: roundPct(currentStore.laborPct ?? 0),
      food_cost_pct: foodCostPct,
      flm_pct: roundPct(currentStore.flmPct ?? 0),
      doordash_sales: currentStore.dddSales ?? 0,
      ubereats_sales: currentStore.aggregatorSales ?? 0,
      avg_ticket: currentStore.avgTicket ?? 0,
      avg_discount: currentStore.avgDiscount ?? 0,
    }

    const prevNetSales = prevStore?.netSales ?? prevStore?.lyNetSales ?? 0
    const prevFoodCostPct =
      prevStore && prevStore.foodCostUsd != null && prevNetSales
        ? roundPct((prevStore.foodCostUsd / prevNetSales) * 100)
        : 0

    const prevValues: Record<string, number> = {
      net_sales: prevNetSales,
      labor_pct: roundPct(prevStore?.laborPct ?? 0),
      food_cost_pct: prevFoodCostPct,
      flm_pct: roundPct(prevStore?.flmPct ?? 0),
      doordash_sales: prevStore?.dddSales ?? 0,
      ubereats_sales: prevStore?.aggregatorSales ?? 0,
      avg_ticket: prevStore?.avgTicket ?? 0,
      avg_discount: prevStore?.avgDiscount ?? 0,
    }

    const allMetrics = COMPARE_METRICS.map((key) => {
      const curr = currentValues[key] ?? 0
      const prev = prevValues[key] ?? 0
      const hasPrev = dateMode === 'lastYear' ? lastYearData !== null : true
      const prevVal = hasPrev ? prev : curr
      const pctChange = hasPrev && prevVal !== 0 ? getPctChange(curr, prevVal) : 0
      return {
        key,
        current: curr,
        previous: hasPrev ? prevVal : 0,
        hasPrevious: hasPrev,
        pctChange,
        isImprovement: isImprovement(key, pctChange),
      }
    })

    return { allMetrics }
  }, [currentStore, dateMode, prevWeekData, prevMonthData, lastYearData, store.number])

  // Summary for Net Sales only (primary metric)
  const summaryForNetSales = useMemo(() => {
    if (!comparisonData) return null
    const m = comparisonData.allMetrics.find((x) => x.key === 'net_sales')
    if (!m) return null
    const hasPrev = m.hasPrevious
    const prev = m.previous
    const pctChange = hasPrev && prev !== 0 ? getPctChange(m.current, prev) : 0
    return {
      current: m.current,
      previous: hasPrev ? prev : 0,
      hasPrevious: hasPrev,
      pctChange,
      isImprovement: isImprovement('net_sales', pctChange),
    }
  }, [comparisonData])

  // Prepare data for metric cards
  const allMetricsWithDetails = useMemo(() => {
    if (!comparisonData) return []
    const currencyFmt = (v: number) => `$${Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    return COMPARE_METRICS.map((key) => {
      const m = comparisonData.allMetrics.find((x) => x.key === key)
      const metricObj = metrics.find((x) => x.key === key)
      const label = metricObj?.label ?? (key === 'avg_ticket' ? 'Avg Ticket' : key === 'avg_discount' ? 'Avg Discount' : key)
      const fmt = metricObj?.fmt ?? (key === 'avg_ticket' || key === 'avg_discount' ? currencyFmt : (v: number) => v.toString())
      return {
        key,
        label,
        current: m?.current ?? 0,
        previous: m?.hasPrevious ? (m?.previous ?? 0) : 0,
        hasPrevious: m?.hasPrevious ?? false,
        pctChange: m?.pctChange ?? 0,
        isImprovement: m?.isImprovement ?? false,
        unit: (metricObj?.unit ?? '$') as '$' | '%',
        fmt,
      }
    })
  }, [comparisonData, metrics])

  const getPeriodLabel = () => {
    switch (dateMode) {
      case 'lastWeek':
        return 'vs Previous Week'
      case 'lastMonth':
        return 'vs Previous Month'
      case 'lastYear':
        return 'vs Same Period Last Year'
      default:
        return ''
    }
  }

  const netSalesMetricObj = metrics.find((m) => m.key === 'net_sales') || metrics[0]

  if (!currentStore) {
    return (
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 20, marginBottom: 24 }}>
        <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 15, color: 'var(--text-primary)', marginBottom: 8 }}>
          {store.name} — Date Comparison
          </div>
        <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Load cube data to see comparison.</div>
      </div>
    )
  }

  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 20, marginBottom: 24 }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{ width: 3, height: 24, borderRadius: 2, background: storeColor }} />
          <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 15, color: 'var(--text-primary)' }}>
            {store.name} — Date Comparison
          </div>
        </div>

        {/* Tab Pills */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {(['lastWeek', 'lastMonth', 'lastYear'] as const).map((key) => (
            <button
              key={key}
              onClick={() => setDateMode(key)}
              style={{
                padding: '8px 20px',
                borderRadius: 20,
                border: `1px solid ${dateMode === key ? 'var(--brand)' : 'var(--border-default)'}`,
                cursor: 'pointer',
                fontFamily: "'Inter', sans-serif",
                fontSize: 13,
                fontWeight: 600,
                letterSpacing: '0.04em',
                background: dateMode === key ? 'var(--bg-elevated)' : 'transparent',
                color: dateMode === key ? 'var(--text-primary)' : 'var(--text-tertiary)',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                if (dateMode !== key) {
                  e.currentTarget.style.background = 'var(--bg-overlay)'
                  e.currentTarget.style.borderColor = 'var(--border-strong)'
                }
              }}
              onMouseLeave={(e) => {
                if (dateMode !== key) {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.borderColor = 'var(--border-default)'
                }
              }}
            >
              {key === 'lastWeek' ? 'vs Previous Week' : key === 'lastMonth' ? 'vs Previous Month' : 'vs Same Period Last Year'}
            </button>
          ))}
        </div>
      </div>

      {loadingPrev && (
        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>Loading comparison data…</div>
      )}

      {!loadingPrev && comparisonData && summaryForNetSales && (
        <>
          {/* 3x2 Grid of Metric Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
            {allMetricsWithDetails.map((metric) => (
              <div
                key={metric.key}
                onClick={() => setExpandedMetric(metric.key)}
                style={{
                  background: metric.isImprovement
                    ? 'linear-gradient(135deg, #0a1628 0%, #111827 100%)'
                    : 'linear-gradient(135deg, #1a0a0a 0%, #111827 100%)',
                  borderRadius: 12,
                  padding: 20,
                  cursor: 'pointer',
                  border: '1px solid var(--border-subtle)',
                  transition: 'all 0.2s',
                  boxShadow: 'none',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(249, 115, 22, 0.1), 0 4px 6px -2px rgba(249, 115, 22, 0.05)'
                  e.currentTarget.style.borderColor = 'rgba(249, 115, 22, 0.3)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = 'none'
                  e.currentTarget.style.borderColor = 'var(--border-subtle)'
                }}
              >
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: "'Inter', sans-serif", fontWeight: 500 }}>
                    {metric.label}
                  </span>
                  <span
              style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '4px 10px',
                      borderRadius: 20,
                      background: metric.isImprovement ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                      color: metric.isImprovement ? '#22c55e' : '#ef4444',
                fontFamily: "'Inter', sans-serif",
              }}
            >
                    {metric.pctChange > 0 ? '▲' : '▼'} {Math.abs(metric.pctChange).toFixed(1)}%
                  </span>
            </div>

                {/* Current value */}
                <div style={{ fontSize: 20, fontWeight: 700, color: 'white', marginBottom: 4, fontFamily: "'JetBrains Mono', monospace" }}>
                  {formatValue(metric.current, metric.unit)}
      </div>

                {/* Comparison value */}
                <div style={{ fontSize: 12, color: '#e5e7eb', marginBottom: 12, fontFamily: "'Inter', sans-serif" }}>
                  vs {metric.hasPrevious ? formatValue(metric.previous, metric.unit) : '—'}
      </div>

                {/* Mini bar chart */}
                <ResponsiveContainer width="100%" height={90}>
                  <BarChart
                    data={[
                      { name: 'Current', value: metric.current },
                      { name: 'Previous', value: metric.hasPrevious ? metric.previous : 0 },
                    ]}
                    barSize={36}
                    barCategoryGap="0%"
                    barGap={0}
                  >
              <XAxis
                      dataKey="name"
                      tick={{ fill: '#e5e7eb', fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis hide domain={[0, Math.max(metric.current, metric.hasPrevious ? metric.previous : metric.current, 1) * 1.3]} />
                    <Tooltip
                      contentStyle={{
                        background: '#111827',
                        border: '1px solid #374151',
                        borderRadius: '6px',
                        fontSize: '11px',
                      }}
                      formatter={(v: number | undefined) => formatValue(v ?? 0, metric.unit)}
                    />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      <Cell fill="#f97316" stroke="#0f1117" strokeWidth={2} />
                      <Cell fill="#3b82f6" stroke="#4b5563" strokeWidth={1} />
                    </Bar>
                  </BarChart>
          </ResponsiveContainer>
              </div>
            ))}
      </div>

          {/* Summary Row - Net Sales Only */}
      <div
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 12,
          padding: '16px 20px',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr 1.5fr',
          gap: 16,
          alignItems: 'center',
        }}
      >
        <div>
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: "'Inter', sans-serif", fontWeight: 500, letterSpacing: '0.12em', marginBottom: 4 }}>CURRENT</div>
          <div style={{ fontSize: 22, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-primary)' }}>
                {netSalesMetricObj.fmt(summaryForNetSales.current)}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: "'Inter', sans-serif", fontWeight: 500, letterSpacing: '0.12em', marginBottom: 4 }}>CHANGE</div>
          <div
            style={{
              fontSize: 22,
              fontWeight: 600,
              fontFamily: "'JetBrains Mono', monospace",
                  color: summaryForNetSales.isImprovement ? 'var(--success-text)' : 'var(--danger-text)',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
                <span>{summaryForNetSales.isImprovement ? '▲' : '▼'}</span>
            <span>
                  {summaryForNetSales.hasPrevious
                    ? `${summaryForNetSales.pctChange >= 0 ? '+' : ''}${roundPct(summaryForNetSales.pctChange)}%`
                    : '—'}
            </span>
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: "'Inter', sans-serif", fontWeight: 500, letterSpacing: '0.12em', marginBottom: 4 }}>COMPARISON</div>
          <div style={{ fontSize: 22, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-secondary)' }}>
                {summaryForNetSales.hasPrevious ? netSalesMetricObj.fmt(summaryForNetSales.previous) : '—'}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: "'Inter', sans-serif", fontWeight: 500, letterSpacing: '0.12em', marginBottom: 4 }}>PERIOD</div>
          <div style={{ fontSize: 13, fontFamily: "'Inter', sans-serif", color: 'var(--text-secondary)' }}>{getPeriodLabel()}</div>
        </div>
      </div>
        </>
      )}

      {/* Expanded Metric Modal */}
      {expandedMetric && (() => {
        const m = allMetricsWithDetails.find((x) => x.key === expandedMetric)
        if (!m) return null
            return (
              <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.7)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 50,
            }}
            onClick={() => setExpandedMetric(null)}
          >
            <div
              style={{
                background: 'var(--bg-elevated)',
                borderRadius: 16,
                padding: 32,
                width: 600,
                border: '1px solid var(--border-subtle)',
                transition: 'all 0.2s',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                <h3 style={{ fontSize: 20, fontWeight: 700, color: 'white', fontFamily: "'Inter', sans-serif" }}>{m.label}</h3>
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    padding: '4px 12px',
                    borderRadius: 16,
                    background: m.isImprovement ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                    color: m.isImprovement ? '#22c55e' : '#ef4444',
                    fontFamily: "'Inter', sans-serif",
                  }}
                >
                  {m.pctChange > 0 ? '▲' : '▼'} {Math.abs(m.pctChange).toFixed(1)}%
                </span>
              </div>

              <div style={{ display: 'flex', gap: 32, marginBottom: 32 }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4, fontFamily: "'Inter', sans-serif" }}>CURRENT</div>
                  <div style={{ fontSize: 36, fontWeight: 700, color: '#f97316', fontFamily: "'JetBrains Mono', monospace" }}>
                    {formatValue(m.current, m.unit)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4, fontFamily: "'Inter', sans-serif" }}>PREVIOUS</div>
                  <div style={{ fontSize: 36, fontWeight: 700, color: 'var(--text-tertiary)', fontFamily: "'JetBrains Mono', monospace" }}>
                    {formatValue(m.previous, m.unit)}
                  </div>
                </div>
              </div>

              <ResponsiveContainer width="100%" height={240}>
                <BarChart
                  data={[
                    { name: 'Current Period', value: m.current },
                    { name: 'Previous Period', value: m.hasPrevious ? m.previous : 0 },
                  ]}
                  barSize={80}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: '#9ca3af' }} />
                  <YAxis
                    tick={{ fill: '#9ca3af' }}
                    tickFormatter={(v) => formatValue(v, m.unit)}
                  />
                  <Tooltip
                    contentStyle={{
                      background: '#111827',
                      border: '1px solid #374151',
                      borderRadius: '8px',
                    }}
                    formatter={(v: number | undefined) => [formatValue(v ?? 0, m.unit), m.label]}
                  />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                    <Cell fill="#f97316" />
                    <Cell fill="#3b82f6" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>

              <button
                onClick={() => setExpandedMetric(null)}
                style={{
                  marginTop: 24,
                  width: '100%',
                  padding: '8px',
                  color: 'var(--text-tertiary)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 8,
                  background: 'transparent',
                  cursor: 'pointer',
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 14,
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'white'
                  e.currentTarget.style.borderColor = 'var(--border-default)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--text-tertiary)'
                  e.currentTarget.style.borderColor = 'var(--border-subtle)'
                }}
              >
                Close
              </button>
                </div>
              </div>
            )
      })()}
    </div>
  )
}

