'use client'

import { useEffect, useState } from 'react'
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  LabelList,
} from 'recharts'
import { TrendingUp, Package, Users, Bell } from 'lucide-react'

const PROFIT_STORE_ALL = 'all'
const PROFIT_STORES = ['2021', '2081', '2259', '2292', '2481', '3011']
const PROFIT_STORE_NAMES: Record<string, string> = {
  '2021': 'Tapo',
  '2081': 'Chatsworth',
  '2259': 'Canoga Park',
  '2292': 'Westhills',
  '2481': 'Madera',
  '3011': 'Northridge',
}

type CubeStoreRowProfit = {
  storeNumber: string
  netSales: number | null
  lyNetSales: number | null
  laborPct: number | null
  totalLaborPct?: number | null
  actualFoodPct?: number | null
  flmPct?: number | null
  foodVariancePct?: number | null
  targetFoodPct?: number | null
  restaurantLevelEbitda: number | null
}

type ProfitTrendPoint = {
  periodLabel: string
  date: string
  year: number
  period: number
  laborPct: number | null
  foodCostPct: number | null
  flmPct: number | null
  foodVariancePct: number | null
  targetFoodPct: number | null
  netSales: number | null
  lyNetSales: number | null
  compPct: number | null
  restaurantLevelEbitda: number | null
}

export function ProfitEbitdaSection() {
  const [profitStore, setProfitStore] = useState<string>(PROFIT_STORES[0])
  const [profitRange, setProfitRange] = useState<'last3' | 'last6' | 'lySame'>('last3')
  const [profitMetricToggles, setProfitMetricToggles] = useState({
    netSales: true,
    ebitda: true,
    labor: true,
    foodCost: true,
    flm: true,
  })
  const [profitTrendDataByStore, setProfitTrendDataByStore] = useState<Record<string, ProfitTrendPoint[]>>({})
  const [profitLoading, setProfitLoading] = useState(false)

  useEffect(() => {
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentPeriod = now.getMonth() + 1

    const getPeriodsForRange = (range: 'last3' | 'last6' | 'lySame'): { year: number; period: number }[] => {
      if (range === 'last3') {
        return Array.from({ length: 3 }, (_, i) => ({ year: currentYear, period: currentPeriod - 2 + i })).filter(
          (p) => p.period >= 1 && p.period <= 12
        )
      }
      if (range === 'last6') {
        const out: { year: number; period: number }[] = []
        for (let i = 5; i >= 0; i--) {
          let period = currentPeriod - i
          let year = currentYear
          while (period < 1) {
            period += 12
            year--
          }
          while (period > 12) {
            period -= 12
            year++
          }
          out.push({ year, period })
        }
        return out
      }
      return Array.from({ length: 3 }, (_, i) => ({ year: currentYear - 1, period: currentPeriod - 2 + i })).filter(
        (p) => p.period >= 1 && p.period <= 12
      )
    }

    const periods = getPeriodsForRange(profitRange)
    if (periods.length === 0) {
      setProfitTrendDataByStore({})
      return
    }

    let cancelled = false
    setProfitLoading(true)
    const fetches = periods.map(({ year, period }) => {
      const date = `${year}-${String(period).padStart(2, '0')}`
      return fetch(`/api/cube?date=${encodeURIComponent(date)}&period=monthly`, { cache: 'no-store', credentials: 'include' })
        .then((r) => r.json())
        .then((json): { year: number; period: number; stores: CubeStoreRowProfit[] } => {
          const stores = json?.success && Array.isArray(json.stores) ? (json.stores as CubeStoreRowProfit[]) : []
          return { year, period, stores }
        })
    })

    Promise.all(fetches)
      .then((results) => {
        if (cancelled) return
        const byStore: Record<string, ProfitTrendPoint[]> = {}
        for (const storeNum of PROFIT_STORES) byStore[storeNum] = []
        for (const { year, period, stores } of results) {
          const periodLabel = `P${period}'${String(year).slice(-2)}`
          for (const storeNum of PROFIT_STORES) {
            const store = stores.find((s) => String(s.storeNumber) === storeNum) ?? null
            const compPct =
              store && store.lyNetSales != null && store.lyNetSales > 0 && store.netSales != null
                ? ((store.netSales - store.lyNetSales) / store.lyNetSales) * 100
                : null
            byStore[storeNum].push({
              periodLabel,
              date: `${year}-${String(period).padStart(2, '0')}`,
              year,
              period,
              laborPct: store ? (store.totalLaborPct ?? store.laborPct) ?? null : null,
              foodCostPct: store ? (store.actualFoodPct ?? null) : null,
              flmPct: store ? (store.flmPct ?? null) : null,
              foodVariancePct: store ? (store.foodVariancePct ?? null) : null,
              targetFoodPct: store ? (store.targetFoodPct ?? null) : null,
              netSales: store?.netSales ?? null,
              lyNetSales: store?.lyNetSales ?? null,
              compPct,
              restaurantLevelEbitda: store?.restaurantLevelEbitda ?? null,
            })
          }
        }
        setProfitTrendDataByStore(byStore)
      })
      .catch(() => {
        if (!cancelled) setProfitTrendDataByStore({})
      })
      .finally(() => {
        if (!cancelled) setProfitLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [profitRange])

  const isAllStores = profitStore === PROFIT_STORE_ALL
  const singleStoreData = (profitTrendDataByStore[profitStore] ?? []) as ProfitTrendPoint[]
  const allStoresHaveData = PROFIT_STORES.every((s) => (profitTrendDataByStore[s] ?? []).length > 0)
  const hasData = isAllStores ? allStoresHaveData : singleStoreData.length > 0
  const dataForChart = isAllStores ? [] : singleStoreData
  const storeName = PROFIT_STORE_NAMES[profitStore] ?? profitStore
  const nPeriods = dataForChart.length
  const chartData = dataForChart.map((d) => ({
    ...d,
    netSales: d.netSales ?? undefined,
    restaurantLevelEbitda: d.restaurantLevelEbitda ?? undefined,
    laborPct: d.laborPct ?? undefined,
    foodCostPct: d.foodCostPct ?? undefined,
    flmPct: d.flmPct ?? undefined,
  }))
  const latest = dataForChart[dataForChart.length - 1]
  const allDollars = dataForChart.flatMap((d) =>
    [d.netSales ?? 0, d.restaurantLevelEbitda ?? 0].filter((v) => !Number.isNaN(v))
  )
  const maxDollar = Math.max(0, ...allDollars)
  const minDollar = Math.min(0, ...allDollars)
  const dollarMax = maxDollar > 0 ? Math.ceil(maxDollar / 10000) * 10000 + 5000 : 100000
  const dollarMin = minDollar < 0 ? Math.floor(minDollar / 10000) * 10000 - 5000 : 0
  const fmtUsd = (n: number | null | undefined) =>
    n != null && !Number.isNaN(n) ? `$${Math.round(n).toLocaleString()}` : '—'
  const fmtPct = (n: number | null | undefined) => (n != null && !Number.isNaN(n) ? `${n.toFixed(1)}%` : '—')
  const metricPills = [
    { key: 'netSales' as const, label: 'Net Sales', color: '#22c55e' },
    { key: 'ebitda' as const, label: 'EBITDA', color: '#3b82f6' },
    { key: 'labor' as const, label: 'Labor %', color: '#ef4444' },
    { key: 'foodCost' as const, label: 'Food Cost %', color: '#f97316' },
    { key: 'flm' as const, label: 'FLM %', color: '#eab308' },
  ]

  return (
    <section>
      <div
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 10,
          padding: '12px 16px',
          marginBottom: 16,
          display: 'flex',
          gap: 24,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <div
            style={{
              fontSize: 10,
              color: 'var(--text-tertiary)',
              fontFamily: "'Inter', sans-serif",
              fontWeight: 600,
              letterSpacing: '0.12em',
              marginBottom: 6,
            }}
          >
            STORE
          </div>
          <select
            value={profitStore}
            onChange={(e) => setProfitStore(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid var(--border-default)',
              background: 'var(--bg-overlay)',
              color: 'var(--text-primary)',
              fontFamily: "'Inter', sans-serif",
              fontSize: 13,
              minWidth: 140,
            }}
          >
            <option value={PROFIT_STORE_ALL}>All Stores</option>
            {PROFIT_STORES.map((s) => (
              <option key={s} value={s}>
                {s} · {PROFIT_STORE_NAMES[s] ?? ''}
              </option>
            ))}
          </select>
        </div>
        <div>
          <div
            style={{
              fontSize: 10,
              color: 'var(--text-tertiary)',
              fontFamily: "'Inter', sans-serif",
              fontWeight: 600,
              letterSpacing: '0.12em',
              marginBottom: 6,
            }}
          >
            RANGE
          </div>
          <div
            style={{
              display: 'flex',
              gap: 4,
              background: 'var(--bg-overlay)',
              borderRadius: 8,
              padding: 4,
              border: '1px solid var(--border-subtle)',
            }}
          >
            {[
              { key: 'last3' as const, label: 'Last 3 Periods' },
              { key: 'last6' as const, label: 'Last 6 Periods' },
              { key: 'lySame' as const, label: 'LY Same Periods' },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setProfitRange(key)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 8,
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 12,
                  fontWeight: 600,
                  background: profitRange === key ? 'var(--bg-elevated)' : 'transparent',
                  color: profitRange === key ? 'var(--text-primary)' : 'var(--text-tertiary)',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {profitLoading && (
        <div
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 12,
            padding: 40,
            textAlign: 'center',
            marginBottom: 24,
          }}
        >
          <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 15, color: 'var(--text-primary)', marginBottom: 12 }}>
            Loading…
          </div>
          <div
            style={{
              width: 24,
              height: 24,
              border: '2px solid var(--brand)',
              borderTopColor: 'transparent',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
              margin: '0 auto',
            }}
          />
        </div>
      )}

      {!profitLoading && hasData && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            <div style={{ order: 0, marginBottom: 12 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {metricPills.map(({ key, label, color }) => (
                  <button
                    key={key}
                    onClick={() => setProfitMetricToggles((t) => ({ ...t, [key]: !t[key] }))}
                    style={{
                      padding: '4px 12px',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      fontFamily: "'Inter', sans-serif",
                      cursor: 'pointer',
                      border: profitMetricToggles[key] ? 'none' : '1px solid var(--border-subtle)',
                      background: profitMetricToggles[key] ? 'var(--brand)' : 'transparent',
                      color: profitMetricToggles[key] ? '#fff' : 'var(--text-tertiary)',
                    }}
                  >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {!isAllStores && latest && (() => {
            const previous = dataForChart.length >= 2 ? dataForChart[dataForChart.length - 2] : null
            const vs = (
              curr: number | null | undefined,
              prev: number | null | undefined,
              higherIsBetter: boolean
            ) => {
              if (curr == null || prev == null || Number.isNaN(curr) || Number.isNaN(prev))
                return { arrow: '', color: 'var(--text-primary)' as const }
              const improved = higherIsBetter ? curr > prev : curr < prev
              const same = curr === prev
              if (same) return { arrow: '', color: 'var(--text-primary)' as const }
              return {
                arrow: improved ? ' ↑' : ' ↓',
                color: improved ? ('var(--success-text)' as const) : ('var(--danger-text)' as const),
              }
            }
            const netSalesVs = vs(latest?.netSales ?? null, previous?.netSales ?? null, true)
            const ebitdaCurr = latest?.restaurantLevelEbitda ?? null
            const ebitdaPrev = previous?.restaurantLevelEbitda ?? null
            const ebitdaVs = (() => {
              if (ebitdaCurr == null) return { arrow: '', color: 'var(--text-primary)' as const }
              const improved = ebitdaPrev != null && !Number.isNaN(ebitdaPrev) ? ebitdaCurr > ebitdaPrev : false
              const same = ebitdaPrev != null && ebitdaCurr === ebitdaPrev
              const ebitdaColor = ebitdaCurr >= 0 ? ('var(--success-text)' as const) : ('var(--danger-text)' as const)
              if (same) return { arrow: '', color: ebitdaColor }
              return { arrow: improved ? ' ↑' : ' ↓', color: improved ? ('var(--success-text)' as const) : ('var(--danger-text)' as const) }
            })()
            const laborVs = vs(latest?.laborPct ?? null, previous?.laborPct ?? null, false)
            const foodVs = vs(latest?.foodCostPct ?? null, previous?.foodCostPct ?? null, false)
            const flmVs = vs(latest?.flmPct ?? null, previous?.flmPct ?? null, true)
            const compVs = vs(latest?.compPct ?? null, previous?.compPct ?? null, true)
            return (
              <div
                style={{
                  order: 1,
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 10,
                  padding: '12px 20px',
                  marginBottom: 16,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
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
                  LATEST PERIOD — {latest?.periodLabel ?? '—'}
                  {previous ? ` vs ${previous.periodLabel}` : ''}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 32, alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 4 }}>NET SALES</div>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 18, fontWeight: 700, color: netSalesVs.color }}>
                      {fmtUsd(latest?.netSales)}
                      {netSalesVs.arrow}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 4 }}>EBITDA</div>
                    <div
                      style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 18,
                        fontWeight: 700,
                        color:
                          ebitdaCurr != null
                            ? ebitdaCurr >= 0
                              ? 'var(--success-text)'
                              : 'var(--danger-text)'
                            : 'var(--text-primary)',
                      }}
                    >
                      {fmtUsd(latest?.restaurantLevelEbitda)}
                      {ebitdaVs.arrow && <span style={{ color: ebitdaVs.color }}>{ebitdaVs.arrow}</span>}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontStyle: 'italic', marginTop: 4 }}>
                      * EBITDA is a rolling total, not period-specific
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 4 }}>LABOR %</div>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 18, fontWeight: 700, color: laborVs.color }}>
                      {fmtPct(latest?.laborPct)}
                      {laborVs.arrow}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 4 }}>FOOD COST %</div>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 18, fontWeight: 700, color: foodVs.color }}>
                      {fmtPct(latest?.foodCostPct)}
                      {foodVs.arrow}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 4 }}>FLM %</div>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 18, fontWeight: 700, color: flmVs.color }}>
                      {fmtPct(latest?.flmPct)}
                      {flmVs.arrow}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 4 }}>COMP %</div>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 18, fontWeight: 700, color: compVs.color }}>
                      {latest?.compPct != null ? `${latest.compPct.toFixed(1)}%` : '—'}
                      {compVs.arrow}
                    </div>
                  </div>
                </div>
              </div>
            )
          })()}

          {isAllStores ? (
            <div style={{ order: 2, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
              {PROFIT_STORES.map((storeNum) => {
                const miniData = (profitTrendDataByStore[storeNum] ?? []).map((d) => ({
                  ...d,
                  netSales: d.netSales ?? undefined,
                  restaurantLevelEbitda: d.restaurantLevelEbitda ?? undefined,
                  laborPct: d.laborPct ?? undefined,
                  foodCostPct: d.foodCostPct ?? undefined,
                  flmPct: d.flmPct ?? undefined,
                }))
                const miniDollars = miniData.flatMap((d) =>
                  [d.netSales ?? 0, d.restaurantLevelEbitda ?? 0].filter((v) => !Number.isNaN(v))
                )
                const miniMax = Math.max(0, ...miniDollars)
                const miniMin = Math.min(0, ...miniDollars)
                const miniDollarMax = miniMax > 0 ? Math.ceil(miniMax / 10000) * 10000 + 5000 : 100000
                const miniDollarMin = miniMin < 0 ? Math.floor(miniMin / 10000) * 10000 - 5000 : 0
                return (
                  <div
                    key={storeNum}
                    style={{
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 12,
                      padding: 12,
                    }}
                  >
                    <div
                      style={{
                        fontFamily: "'Inter', sans-serif",
                        fontWeight: 700,
                        fontSize: 14,
                        color: 'var(--text-primary)',
                        marginBottom: 8,
                      }}
                    >
                      {storeNum} · {PROFIT_STORE_NAMES[storeNum] ?? storeNum}
                    </div>
                    <div style={{ height: 200 }}>
                      <ResponsiveContainer width="100%" height={200}>
                        <ComposedChart data={miniData} margin={{ top: 8, right: 8, left: 4, bottom: 4 }}>
                          <CartesianGrid strokeDasharray="2 2" stroke="var(--border-subtle)" />
                          <XAxis dataKey="periodLabel" tick={{ fontSize: 9, fill: 'var(--text-secondary)' }} />
                          <YAxis
                            yAxisId="left"
                            orientation="left"
                            domain={[miniDollarMin, miniDollarMax]}
                            tick={{ fontSize: 8, fill: 'var(--text-tertiary)' }}
                            tickFormatter={(v) => (v >= 1000 || v <= -1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`)}
                          />
                          <YAxis
                            yAxisId="right"
                            orientation="right"
                            domain={[-50, 100]}
                            tick={{ fontSize: 8, fill: 'var(--text-tertiary)' }}
                            tickFormatter={(v) => `${v}%`}
                          />
                          <Tooltip
                            contentStyle={{
                              background: 'var(--bg-surface)',
                              border: '1px solid var(--border-subtle)',
                              borderRadius: 8,
                              fontSize: 11,
                            }}
                            formatter={(v: unknown) => [
                              typeof v === 'number' && !Number.isNaN(v)
                                ? Math.abs(v) >= 100
                                  ? `$${Math.round(v).toLocaleString()}`
                                  : `${v.toFixed(1)}%`
                                : '—',
                              '',
                            ]}
                          />
                          {profitMetricToggles.netSales && (
                            <Line
                              yAxisId="left"
                              type="monotone"
                              dataKey="netSales"
                              name="Net Sales"
                              stroke="#22c55e"
                              strokeWidth={1.5}
                              dot={{ r: 3 }}
                              connectNulls
                            />
                          )}
                          {profitMetricToggles.ebitda && (
                            <Line
                              yAxisId="left"
                              type="monotone"
                              dataKey="restaurantLevelEbitda"
                              name="EBITDA"
                              stroke="#3b82f6"
                              strokeWidth={1.5}
                              dot={{ r: 3 }}
                              connectNulls
                            />
                          )}
                          {profitMetricToggles.labor && (
                            <Line
                              yAxisId="right"
                              type="monotone"
                              dataKey="laborPct"
                              name="Labor %"
                              stroke="#ef4444"
                              strokeWidth={1.5}
                              dot={{ r: 3 }}
                              connectNulls
                            />
                          )}
                          {profitMetricToggles.foodCost && (
                            <Line
                              yAxisId="right"
                              type="monotone"
                              dataKey="foodCostPct"
                              name="Food Cost %"
                              stroke="#f97316"
                              strokeWidth={1.5}
                              dot={{ r: 3 }}
                              connectNulls
                            />
                          )}
                          {profitMetricToggles.flm && (
                            <Line
                              yAxisId="right"
                              type="monotone"
                              dataKey="flmPct"
                              name="FLM %"
                              stroke="#eab308"
                              strokeWidth={1.5}
                              strokeDasharray="4 4"
                              dot={{ r: 3 }}
                              connectNulls
                            />
                          )}
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div
              style={{
                order: 2,
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 12,
                padding: 20,
                marginBottom: 24,
              }}
            >
              <div style={{ marginBottom: 4 }}>
                <div
                  style={{
                    fontFamily: "'Inter', sans-serif",
                    fontWeight: 600,
                    fontSize: 15,
                    color: 'var(--text-primary)',
                    marginBottom: 4,
                  }}
                >
                  {storeName} — Trailing {nPeriods} Periods
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', fontFamily: "'Inter', sans-serif", marginBottom: 16 }}>
                  Net Income vs. Controllables
                </div>
              </div>
              <div style={{ height: 420 }}>
                <ResponsiveContainer width="100%" height={420}>
                  <ComposedChart data={chartData} margin={{ top: 24, right: 24, left: 8, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                    <XAxis dataKey="periodLabel" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
                    <YAxis
                      yAxisId="left"
                      orientation="left"
                      domain={[dollarMin, dollarMax]}
                      tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }}
                      tickFormatter={(v) => (v >= 1000 || v <= -1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`)}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      domain={[-50, 100]}
                      tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <ReferenceLine yAxisId="left" y={0} stroke="var(--border-default)" strokeDasharray="2 2" />
                    <Tooltip
                      contentStyle={{
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null
                        const p = payload[0]?.payload as (typeof chartData)[0]
                        if (!p) return null
                        return (
                          <div style={{ padding: 6 }}>
                            <div style={{ fontWeight: 600, marginBottom: 6 }}>{p.periodLabel}</div>
                            {profitMetricToggles.netSales && <div>Net Sales: {fmtUsd(p.netSales)}</div>}
                            {profitMetricToggles.ebitda && (
                              <div>
                                <div>EBITDA: {fmtUsd(p.restaurantLevelEbitda)}</div>
                                <div
                                  style={{
                                    fontSize: 10,
                                    color: 'var(--text-tertiary)',
                                    fontStyle: 'italic',
                                    marginTop: 2,
                                  }}
                                >
                                  EBITDA data is not period-filtered — shown as reference only
                                </div>
                              </div>
                            )}
                            {profitMetricToggles.labor && <div>Labor %: {fmtPct(p.laborPct)}</div>}
                            {profitMetricToggles.foodCost && <div>Food Cost %: {fmtPct(p.foodCostPct)}</div>}
                            {profitMetricToggles.flm && <div>FLM %: {fmtPct(p.flmPct)}</div>}
                          </div>
                        )
                      }}
                    />
                    {profitMetricToggles.netSales && (
                      <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="netSales"
                        name="Net Sales"
                        stroke="#22c55e"
                        strokeWidth={2}
                        dot={{ r: 4 }}
                        connectNulls
                      >
                        <LabelList
                          dataKey="netSales"
                          position="top"
                          formatter={(v: unknown) =>
                            typeof v === 'number' && !Number.isNaN(v) ? `$${Math.round(v).toLocaleString()}` : ''
                          }
                        />
                      </Line>
                    )}
                    {profitMetricToggles.ebitda && (
                      <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="restaurantLevelEbitda"
                        name="EBITDA"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        dot={{ r: 4 }}
                        connectNulls
                      >
                        <LabelList
                          dataKey="restaurantLevelEbitda"
                          position="top"
                          formatter={(v: unknown) =>
                            typeof v === 'number' && !Number.isNaN(v) ? `$${Math.round(v).toLocaleString()}` : ''
                          }
                        />
                      </Line>
                    )}
                    {profitMetricToggles.labor && (
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="laborPct"
                        name="Labor %"
                        stroke="#ef4444"
                        strokeWidth={2}
                        dot={{ r: 4 }}
                        connectNulls
                      >
                        <LabelList
                          dataKey="laborPct"
                          position="top"
                          formatter={(v: unknown) =>
                            typeof v === 'number' && !Number.isNaN(v) ? `${v.toFixed(1)}%` : ''
                          }
                        />
                      </Line>
                    )}
                    {profitMetricToggles.foodCost && (
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="foodCostPct"
                        name="Food Cost %"
                        stroke="#f97316"
                        strokeWidth={2}
                        dot={{ r: 4 }}
                        connectNulls
                      >
                        <LabelList
                          dataKey="foodCostPct"
                          position="top"
                          formatter={(v: unknown) =>
                            typeof v === 'number' && !Number.isNaN(v) ? `${v.toFixed(1)}%` : ''
                          }
                        />
                      </Line>
                    )}
                    {profitMetricToggles.flm && (
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="flmPct"
                        name="FLM %"
                        stroke="#eab308"
                        strokeWidth={2}
                        strokeDasharray="4 4"
                        dot={{ r: 4 }}
                        connectNulls
                      >
                        <LabelList
                          dataKey="flmPct"
                          position="top"
                          formatter={(v: unknown) =>
                            typeof v === 'number' && !Number.isNaN(v) ? `${v.toFixed(1)}%` : ''
                          }
                        />
                      </Line>
                    )}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

            <div
              style={{
                order: 3,
                opacity: 0.7,
                marginTop: 32,
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: 'var(--text-tertiary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  marginBottom: 16,
                }}
              >
                ROADMAP
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[
                  {
                    icon: TrendingUp,
                    name: 'Controllable % Analysis',
                    desc: 'Labor + food cost combined as % of sales, period over period trend',
                    accent: '#3b82f6',
                  },
                  {
                    icon: Package,
                    name: 'Food Cost Variance by Ingredient',
                    desc: 'Drill down into actual vs theoretical food cost by menu item',
                    accent: '#f97316',
                  },
                  {
                    icon: Users,
                    name: 'Employee-Level Labor Data',
                    desc: 'Individual employee hours, overtime alerts, and scheduling efficiency',
                    accent: '#ef4444',
                  },
                  {
                    icon: Bell,
                    name: 'Smart Alerts',
                    desc: 'Email and SMS notifications when labor spikes, food cost exceeds target, or sales drop',
                    accent: '#eab308',
                  },
                ].map(({ icon: Icon, name, desc, accent }) => (
                  <div
                    key={name}
                    style={{
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 10,
                      padding: 16,
                      borderLeftWidth: 3,
                      borderLeftColor: accent,
                      borderLeftStyle: 'solid',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 8 }}>
                      <div style={{ color: accent, flexShrink: 0 }}>
                        <Icon size={20} strokeWidth={2} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div
                          style={{
                            fontFamily: "'Inter', sans-serif",
                            fontWeight: 600,
                            fontSize: 13,
                            color: 'var(--text-primary)',
                            marginBottom: 4,
                          }}
                        >
                          {name}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4, lineHeight: 1.4 }}>{desc}</div>
                      </div>
                    </div>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '3px 8px',
                        borderRadius: 4,
                        fontSize: 11,
                        fontWeight: 600,
                        background: 'rgba(232,68,26,0.1)',
                        color: 'var(--brand)',
                        border: '1px solid rgba(232,68,26,0.2)',
                      }}
                    >
                      Coming Soon
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {!profitLoading && !hasData && (
        <div
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 12,
            padding: 40,
            textAlign: 'center',
          }}
        >
          <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 15, color: 'var(--text-primary)', marginBottom: 8 }}>
            No data
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Select store and range to load period trend.</div>
        </div>
      )}
    </section>
  )
}
