'use client'

import { useState, useMemo } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  ComposedChart,
} from 'recharts'
import { getDateComparisonData, type DateCompareMode, type ReportPoint } from '@/lib/comparison'

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

type SingleStoreDateCompareProps = {
  store: StoreUI
  reports: ReportPoint[]
  metrics: Metric[]
  storeColor: string
  viewMode?: 'weekly' | 'monthly'
}

export default function SingleStoreDateCompare({
  store,
  reports,
  metrics,
  storeColor,
  viewMode = 'weekly',
}: SingleStoreDateCompareProps) {
  const [dateMode, setDateMode] = useState<DateCompareMode>('lastWeek')
  const [selectedMetric, setSelectedMetric] = useState<string>('net_sales')
  
  // Hide "vs Yesterday" in monthly mode
  const dateModes = viewMode === 'monthly'
    ? [
        ['lastWeek', 'vs Previous Week'],
        ['lastMonth', 'vs Previous Month'],
        ['lastYear', 'vs Same Period Last Year'],
      ] as const
    : [
        ['yesterday', 'vs Yesterday'],
        ['lastWeek', 'vs Previous Week'],
        ['lastMonth', 'vs Previous Month'],
        ['lastYear', 'vs Same Period Last Year'],
      ] as const

  const comparisonData = useMemo(() => {
    return getDateComparisonData(reports, selectedMetric, dateMode)
  }, [reports, selectedMetric, dateMode])

  const selectedMetricObj = metrics.find((m) => m.key === selectedMetric) || metrics[0]

  // Build chart data - last 7 days for current and previous period
  const chartData = useMemo(() => {
    const currentWeek = comparisonData.currentPeriod.slice(-7)
    const previousWeek = comparisonData.previousPeriod.slice(-7)
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    const dataLength = Math.max(currentWeek.length, previousWeek.length, 1)

    return Array.from({ length: Math.min(dataLength, 7) }, (_, i) => {
      const currentIdx = currentWeek.length - Math.min(dataLength, 7) + i
      const previousIdx = previousWeek.length - Math.min(dataLength, 7) + i
      
      const currentPoint = currentWeek[currentIdx >= 0 ? currentIdx : currentWeek.length - 1] || currentWeek[currentWeek.length - 1]
      const previousPoint = previousWeek[previousIdx >= 0 ? previousIdx : previousWeek.length - 1] || previousWeek[previousWeek.length - 1] || currentPoint

      return {
        day: days[i % 7],
        current: currentPoint ? ((currentPoint[selectedMetric as keyof ReportPoint] as number) ?? 0) : 0,
        previous: previousPoint ? ((previousPoint[selectedMetric as keyof ReportPoint] as number) ?? 0) : 0,
      }
    })
  }, [comparisonData, selectedMetric])

  const getPeriodLabel = () => {
    switch (dateMode) {
      case 'yesterday':
        return 'vs Previous Day'
      case 'lastWeek':
        return 'vs Previous Week'
      case 'lastMonth':
        return 'vs Previous Month'
      case 'lastYear':
        return 'vs Same Period Last Year'
    }
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload) return null

    return (
      <div style={{ background: 'var(--bg-overlay)', border: '1px solid var(--border-default)', borderRadius: 8, padding: '12px 16px' }}>
        {payload.map((p: any, i: number) => (
          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.color }} />
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: "'Inter', sans-serif" }}>{p.name}:</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: p.color, fontFamily: "'JetBrains Mono', monospace" }}>
              {selectedMetricObj.fmt(p.value)}
            </span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 20, marginBottom: 24 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div
            style={{
              width: 3,
              height: 24,
              borderRadius: 2,
              background: storeColor,
            }}
          />
          <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 15, color: 'var(--text-primary)' }}>
            {store.name} — Date Comparison
          </div>
        </div>

        {/* Period Selector */}
        <div style={{ display: 'flex', gap: 4, background: 'var(--bg-overlay)', borderRadius: 8, padding: 4, border: '1px solid var(--border-subtle)', marginBottom: 16 }}>
          {dateModes.map(([key, label]) => (
            <button
              key={key}
              onClick={() => setDateMode(key)}
              style={{
                padding: '6px 16px',
                borderRadius: 8,
                border: 'none',
                cursor: 'pointer',
                fontFamily: "'Inter', sans-serif",
                fontSize: 13,
                fontWeight: 600,
                letterSpacing: '0.04em',
                background: dateMode === key ? 'var(--bg-elevated)' : 'transparent',
                color: dateMode === key ? 'var(--text-primary)' : 'var(--text-tertiary)',
                flex: 1,
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Metric Selector */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {metrics.map((m) => (
            <div
              key={m.key}
              onClick={() => setSelectedMetric(m.key)}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 500,
                border: `1px solid ${selectedMetric === m.key ? 'var(--info)' : 'var(--border-default)'}`,
                background: selectedMetric === m.key ? 'var(--info-subtle)' : 'transparent',
                color: selectedMetric === m.key ? 'var(--info-text)' : 'var(--text-tertiary)',
                fontFamily: "'Inter', sans-serif",
                cursor: 'pointer',
              }}
            >
              {m.label}
            </div>
          ))}
        </div>
      </div>

      {/* Chart Label */}
      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: "'Inter', sans-serif", marginBottom: 12 }}>
        Showing: {store.name} · {selectedMetricObj.label} · {getPeriodLabel()}
      </div>

      {/* Line Chart */}
      <div style={{ marginBottom: 24 }}>
        {chartData.length < 3 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-secondary)', fontFamily: "'Inter', sans-serif", fontSize: 13, minHeight: 240 }}>
            Not enough data points for this view. Upload more weekly reports to see trends.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(240, 300)}>
            <ComposedChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="1 3" stroke="var(--border-subtle)" />
              <XAxis
                dataKey="day"
                stroke="var(--text-tertiary)"
                tick={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", fill: 'var(--text-tertiary)' }}
              />
              <YAxis
                stroke="var(--text-tertiary)"
                tick={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", fill: 'var(--text-tertiary)' }}
                tickFormatter={(v) => (selectedMetricObj.unit === '$' ? `$${(v / 1000).toFixed(0)}k` : `${v}%`)}
                domain={[
                  (dataMin: number) => Math.max(0, Math.floor(dataMin * 0.92)),
                  (dataMax: number) => Math.ceil(dataMax * 1.08),
                ]}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: 12, fontFamily: "'Inter', sans-serif", color: 'var(--text-secondary)' }}
              />
              <Area
                type="monotoneX"
                dataKey="current"
                stroke="none"
                fill={storeColor}
                fillOpacity={0.08}
              />
              <Line
                type="monotoneX"
                dataKey="current"
                stroke={storeColor}
                strokeWidth={2.5}
                dot={{ r: 3, fill: storeColor }}
                activeDot={{ r: 5 }}
                name="Current Period"
              />
              <Line
                type="monotoneX"
                dataKey="previous"
                stroke={storeColor}
                strokeWidth={2}
                strokeDasharray="4 4"
                strokeOpacity={0.5}
                dot={{ r: 3, fill: storeColor, fillOpacity: 0.5 }}
                activeDot={{ r: 5 }}
                name="Comparison Period"
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Change Summary Bar */}
      <div
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 12,
          padding: '16px 20px',
          marginBottom: 24,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr 1.5fr',
          gap: 16,
          alignItems: 'center',
        }}
      >
        <div>
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: "'Inter', sans-serif", fontWeight: 500, letterSpacing: '0.12em', marginBottom: 4 }}>CURRENT</div>
          <div style={{ fontSize: 22, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-primary)' }}>
            {selectedMetricObj.fmt(comparisonData.current)}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: "'Inter', sans-serif", fontWeight: 500, letterSpacing: '0.12em', marginBottom: 4 }}>CHANGE</div>
          <div
            style={{
              fontSize: 22,
              fontWeight: 600,
              fontFamily: "'JetBrains Mono', monospace",
              color: comparisonData.isImprovement ? 'var(--success-text)' : 'var(--danger-text)',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <span>{comparisonData.isImprovement ? '▲' : '▼'}</span>
            <span>
              {comparisonData.pctChange >= 0 ? '+' : ''}
              {comparisonData.pctChange.toFixed(1)}%
            </span>
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: "'Inter', sans-serif", fontWeight: 500, letterSpacing: '0.12em', marginBottom: 4 }}>COMPARISON</div>
          <div style={{ fontSize: 22, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-secondary)' }}>
            {selectedMetricObj.fmt(comparisonData.previous)}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: "'Inter', sans-serif", fontWeight: 500, letterSpacing: '0.12em', marginBottom: 4 }}>PERIOD</div>
          <div style={{ fontSize: 13, fontFamily: "'Inter', sans-serif", color: 'var(--text-secondary)' }}>{getPeriodLabel()}</div>
        </div>
      </div>

      {/* Metric Breakdown Grid */}
      <div>
        <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 15, color: 'var(--text-primary)', marginBottom: 16 }}>
          All Metrics Comparison
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {comparisonData.allMetrics.map((metric) => {
            const metricObj = metrics.find((m) => m.key === metric.key)
            if (!metricObj) return null

            const bgColor = metric.isImprovement
              ? 'var(--success-subtle)'
              : 'var(--danger-subtle)'
            const textColor = metric.isImprovement ? 'var(--success-text)' : 'var(--danger-text)'
            const arrow = metric.isImprovement ? '▲' : '▼'

            return (
              <div
                key={metric.key}
                style={{
                  background: bgColor,
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 12,
                  padding: 16,
                }}
              >
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: "'Inter', sans-serif", fontWeight: 500, letterSpacing: '0.08em', marginBottom: 8 }}>
                  {metricObj.label.toUpperCase()}
                </div>
                <div style={{ fontSize: 22, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-primary)', marginBottom: 4 }}>
                  {metricObj.fmt(metric.current)}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontFamily: "'JetBrains Mono', monospace", marginBottom: 4 }}>
                  vs {metricObj.fmt(metric.previous)}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, fontFamily: "'JetBrains Mono', monospace", color: textColor, fontWeight: 600 }}>
                  <span>{arrow}</span>
                  <span>
                    {metric.pctChange >= 0 ? '+' : ''}
                    {metric.pctChange.toFixed(1)}%
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

