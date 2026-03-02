'use client'

import { useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { getPctChange, isImprovement } from '@/lib/comparison'

type ParsedData = {
  store_number: string
  date_start: string
  date_end: string
  net_sales: number
  labor_pct: number
  food_cost_pct: number
  flm_pct: number
  cash_short: number
  doordash_sales: number
  ubereats_sales: number
}

type Store = {
  id: string
  number: string
  name: string
  location: string
}

type YearOverYearPanelProps = {
  current: ParsedData
  lastYear: ParsedData
  store: Store
  storeColor: string
}

const METRICS = [
  { key: 'net_sales', label: 'Net Sales', fmt: (v: number) => `$${v?.toLocaleString()}`, unit: '$' },
  { key: 'labor_pct', label: 'Labor %', fmt: (v: number) => `${v}%`, unit: '%' },
  { key: 'food_cost_pct', label: 'Food Cost %', fmt: (v: number) => `${v}%`, unit: '%' },
  { key: 'flm_pct', label: 'FLM %', fmt: (v: number) => `${v}%`, unit: '%' },
  { key: 'cash_short', label: 'Cash Short', fmt: (v: number) => (v >= 0 ? `+$${v}` : `-$${Math.abs(v)}`), unit: '$' },
  { key: 'doordash_sales', label: 'DoorDash (DDD)', fmt: (v: number) => `$${v?.toLocaleString()}`, unit: '$' },
  { key: 'ubereats_sales', label: 'Aggregator (DD+UE+GH)', fmt: (v: number) => `$${v?.toLocaleString()}`, unit: '$' },
] as const

const TARGETS: Partial<Record<string, number>> = {
  labor_pct: 28.68,
  food_cost_pct: 26.42,
  flm_pct: 55.11,
  cash_short: 50,
  net_sales: 3000,
}

function formatDateRange(start: string, end: string) {
  const startDate = new Date(start)
  const endDate = new Date(end)
  const startStr = startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const endStr = endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  return `${startStr} – ${endStr}`
}

export default function YearOverYearPanel({ current, lastYear, store, storeColor }: YearOverYearPanelProps) {
  const comparisons = useMemo(() => {
    return METRICS.map((metric) => {
      const currentVal = (current as any)[metric.key] ?? 0
      const lastYearVal = (lastYear as any)[metric.key] ?? 0
      const change = getPctChange(currentVal, lastYearVal)
      const improved = isImprovement(metric.key, change)

      return {
        ...metric,
        current: currentVal,
        lastYear: lastYearVal,
        change,
        improved,
      }
    })
  }, [current, lastYear])

  // Hero metrics (top 3)
  const heroMetrics = useMemo(() => {
    const important = ['net_sales', 'labor_pct', 'flm_pct'] as const
    return comparisons.filter((c) => important.includes(c.key as any))
  }, [comparisons])

  // Generate insight summary
  const insight = useMemo(() => {
    const improved = comparisons.filter((c) => c.improved)
    const worsened = comparisons.filter((c) => !c.improved)
    const improvedCount = improved.length
    const totalCount = comparisons.length

    let summary = `Store ${store.number} improved in ${improvedCount} out of ${totalCount} metrics vs the same period last year.`

    if (improved.length > 0) {
      const best = improved.reduce((prev, curr) => (Math.abs(curr.change) > Math.abs(prev.change) ? curr : prev))
      summary += ` Strongest improvement: ${best.label} (${best.change >= 0 ? '+' : ''}${best.change.toFixed(1)}%).`
    }

    if (worsened.length > 0) {
      const worst = worsened.reduce((prev, curr) => (Math.abs(curr.change) > Math.abs(prev.change) ? curr : prev))
      const target = TARGETS[worst.key]
      const aboveTarget = target !== undefined && worst.current > target
      summary += ` Area of concern: ${worst.label} ${aboveTarget ? 'increased' : 'changed'} from ${worst.lastYear.toFixed(2)}${worst.unit === '$' ? '' : '%'} to ${worst.current.toFixed(2)}${worst.unit === '$' ? '' : '%'}${aboveTarget ? `, now ${worst.current > target ? 'above' : 'below'} the ${target}${worst.unit === '$' ? '' : '%'} target` : ''}.`
    }

    return summary
  }, [comparisons, store])

  // Bar chart data (normalized to % of target)
  const barChartData = useMemo(() => {
    return comparisons.map((comp) => {
      const target = TARGETS[comp.key] || 100
      return {
        metric: comp.label,
        '2026': (comp.current / target) * 100,
        '2025': (comp.lastYear / target) * 100,
      }
    })
  }, [comparisons])

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload) return null
    return (
      <div style={{ background: '#0d1528', border: '1px solid #1e2a40', borderRadius: 12, padding: '12px 16px' }}>
        {payload.map((p: any, i: number) => (
          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.color }} />
            <span style={{ fontSize: 12, color: '#94a3b8' }}>{p.name}:</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: p.color, fontFamily: "'DM Mono',monospace" }}>
              {p.value.toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div style={{ background: '#0d1528', border: '1px solid #1a2640', borderRadius: 16, padding: 24 }}>
      {/* Header Banner */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <div
            style={{
              width: 4,
              height: 32,
              borderRadius: 2,
              background: storeColor,
            }}
          />
          <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 24, color: '#e2e8f0' }}>
            {store.name}
          </div>
        </div>
        <div style={{ fontSize: 13, color: '#4b5a7a', fontFamily: "'DM Mono',monospace", marginLeft: 16 }}>
          {formatDateRange(current.date_start, current.date_end)} vs {formatDateRange(lastYear.date_start, lastYear.date_end)}
        </div>
      </div>

      {/* Hero Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 32 }}>
        {heroMetrics.map((metric) => {
          const arrow = metric.improved ? '▲' : '▼'
          const color = metric.improved ? '#34d399' : '#f87171'

          return (
            <div
              key={metric.key}
              style={{
                background: '#080c18',
                border: '1px solid #1a2640',
                borderRadius: 16,
                padding: 24,
              }}
            >
              <div style={{ fontSize: 11, color: '#4b5a7a', fontFamily: "'DM Mono',monospace", marginBottom: 8 }}>
                {metric.label.toUpperCase()}
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, fontFamily: "'Syne',sans-serif", color: '#e2e8f0', marginBottom: 8 }}>
                {metric.fmt(metric.current)}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 18, color }}>{arrow}</span>
                <span style={{ fontSize: 14, fontWeight: 600, color, fontFamily: "'DM Mono',monospace" }}>
                  {metric.change >= 0 ? '+' : ''}
                  {metric.change.toFixed(1)}%
                </span>
              </div>
              <div style={{ fontSize: 11, color: '#94a3b8', fontFamily: "'DM Mono',monospace" }}>
                vs {metric.fmt(metric.lastYear)}
              </div>
            </div>
          )
        })}
      </div>

      {/* Full Metric Comparison Table */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 18, color: '#e2e8f0', marginBottom: 16 }}>
          Full Metric Comparison
        </div>
        <div style={{ background: '#080c18', border: '1px solid #1a2640', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#0d1528' }}>
                <th style={{ textAlign: 'left', padding: '12px 16px', color: '#4b5a7a', fontFamily: "'DM Mono',monospace", fontSize: 10, fontWeight: 500 }}>
                  METRIC
                </th>
                <th style={{ textAlign: 'right', padding: '12px 16px', color: '#4b5a7a', fontFamily: "'DM Mono',monospace", fontSize: 10, fontWeight: 500 }}>
                  THIS YEAR
                </th>
                <th style={{ textAlign: 'right', padding: '12px 16px', color: '#4b5a7a', fontFamily: "'DM Mono',monospace", fontSize: 10, fontWeight: 500 }}>
                  LAST YEAR
                </th>
                <th style={{ textAlign: 'right', padding: '12px 16px', color: '#4b5a7a', fontFamily: "'DM Mono',monospace", fontSize: 10, fontWeight: 500 }}>
                  CHANGE
                </th>
              </tr>
            </thead>
            <tbody>
              {comparisons.map((comp, i) => {
                const arrow = comp.improved ? '▲' : '▼'
                const color = comp.improved ? '#34d399' : '#f87171'
                const icon = comp.improved ? '✓' : '✗'
                const iconColor = comp.improved ? '#34d399' : '#f87171'

                return (
                  <tr key={comp.key} style={{ background: i % 2 === 0 ? '#0d1528' : '#080c18', borderTop: '1px solid #1a2640' }}>
                    <td style={{ padding: '12px 16px', color: '#e2e8f0', fontFamily: "'DM Mono',monospace", fontSize: 12, fontWeight: 600 }}>
                      {comp.label}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', color: '#e2e8f0', fontFamily: "'DM Mono',monospace", fontSize: 12, fontWeight: 600 }}>
                      {comp.fmt(comp.current)}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', color: '#94a3b8', fontFamily: "'DM Mono',monospace", fontSize: 12 }}>
                      {comp.fmt(comp.lastYear)}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
                        <span style={{ fontSize: 12, color, fontFamily: "'DM Mono',monospace", fontWeight: 600 }}>
                          {arrow} {comp.change >= 0 ? '+' : ''}
                          {comp.change.toFixed(1)}%
                        </span>
                        <span style={{ fontSize: 14, color: iconColor }}>{icon}</span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bar Chart */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 18, color: '#e2e8f0', marginBottom: 16 }}>
          All Metrics Comparison (Normalized to % of Target)
        </div>
        <div style={{ background: '#080c18', border: '1px solid #1a2640', borderRadius: 16, padding: 24 }}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={barChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a2640" />
              <XAxis
                dataKey="metric"
                stroke="#4b5a7a"
                tick={{ fontSize: 11, fontFamily: "'DM Mono',monospace", fill: '#4b5a7a' }}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis
                stroke="#4b5a7a"
                tick={{ fontSize: 11, fontFamily: "'DM Mono',monospace", fill: '#4b5a7a' }}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: 12, fontFamily: "'DM Mono',monospace", color: '#94a3b8' }}
                formatter={(val) => (val === '2026' ? '2026' : '2025')}
              />
              <Bar dataKey="2026" fill={storeColor} />
              <Bar dataKey="2025" fill={storeColor} fillOpacity={0.4} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Insight Summary */}
      <div
        style={{
          background: '#0d1528',
          borderLeft: '4px solid #f59e0b',
          borderRadius: 12,
          padding: 20,
          fontStyle: 'italic',
          fontSize: 13,
          color: '#94a3b8',
          lineHeight: 1.6,
        }}
      >
        {insight}
      </div>
    </div>
  )
}

