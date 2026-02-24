'use client'

import { useState, useMemo } from 'react'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import { getComparisonData, getPctChange, isImprovement, type PeriodMode, type ReportPoint } from '@/lib/comparison'

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

type ComparisonPanelProps = {
  selectedStores: string[]
  activeMetric: string | null
  reports: Record<string, ReportPoint[]>
  stores: StoreUI[]
  metrics: Metric[]
  storeColors: string[]
  targets: Partial<Record<string, number>>
  onMetricSelect?: (metricKey: string) => void
}

export default function ComparisonPanel({
  selectedStores,
  activeMetric,
  reports,
  stores,
  metrics,
  storeColors,
  targets,
  onMetricSelect,
}: ComparisonPanelProps) {
  const [periodMode, setPeriodMode] = useState<PeriodMode>('week')
  const [viewMode, setViewMode] = useState<'summary' | 'graph'>('summary')

  const comparisonData = useMemo(() => {
    if (!activeMetric) return []
    return getComparisonData(reports, selectedStores, activeMetric, periodMode)
  }, [reports, selectedStores, activeMetric, periodMode])

  // Build chart data for line chart (last 5 data points)
  const lineChartData = useMemo(() => {
    if (!activeMetric) {
      // For mini sparklines, build data for all metrics
      const dataPoints: Array<Record<string, number | string>> = []
      const maxLength = Math.max(...selectedStores.map((num) => (reports[num] || []).length), 0)
      const numPoints = Math.min(5, maxLength)
      
      for (let i = numPoints - 1; i >= 0; i--) {
        const point: Record<string, number | string> = {}
        let label = ''
        
        selectedStores.forEach((storeNum) => {
          const storeReports = reports[storeNum] || []
          const idx = storeReports.length - 1 - i
          if (idx >= 0 && idx < storeReports.length) {
            const report = storeReports[idx]
            if (!label) label = report.label // Use first store's label
            point[storeNum] = (report.net_sales as number) ?? 0 // Default to net_sales for mini charts
          } else {
            point[storeNum] = 0
          }
        })
        
        point.week = label || `W${numPoints - i}`
        dataPoints.push(point)
      }
      return dataPoints
    }
    
    const dataPoints: Array<Record<string, number | string>> = []
    const maxLength = Math.max(...selectedStores.map((num) => (reports[num] || []).length), 0)
    const numPoints = Math.min(5, maxLength)
    
    for (let i = numPoints - 1; i >= 0; i--) {
      const point: Record<string, number | string> = {}
      let label = ''
      
      selectedStores.forEach((storeNum) => {
        const storeReports = reports[storeNum] || []
        const idx = storeReports.length - 1 - i
        if (idx >= 0 && idx < storeReports.length) {
          const report = storeReports[idx]
          if (!label) label = report.label // Use first store's label
          point[storeNum] = (report[activeMetric as keyof ReportPoint] as number) ?? 0
        } else {
          point[storeNum] = 0
        }
      })
      
      point.week = label || `W${numPoints - i}`
      dataPoints.push(point)
    }
    
    return dataPoints
  }, [reports, selectedStores, activeMetric])

  // Build bar chart data (current vs previous period)
  const barChartData = useMemo(() => {
    return comparisonData.map((data) => {
      const store = stores.find((s) => s.number === data.storeNum)
      return {
        store: store?.number || data.storeNum,
        current: data.current,
        previous: data.previous,
      }
    })
  }, [comparisonData, stores])

  const activeMetricObj = metrics.find((m) => m.key === activeMetric) || metrics[0]
  const target = activeMetric ? targets[activeMetric] : undefined

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload) return null
    
    return (
      <div style={{ background: 'var(--bg-overlay)', border: '1px solid var(--border-default)', borderRadius: 8, padding: '12px 16px' }}>
        <div style={{ fontSize: 12, color: 'var(--text-primary)', fontFamily: "'Inter', sans-serif", marginBottom: 8 }}>{label}</div>
        {payload.map((p: any, i: number) => {
          const comp = comparisonData.find((c) => c.storeNum === p.dataKey)
          const pctChange = comp ? comp.pctChange : 0
          return (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.color }} />
              <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: "'Inter', sans-serif" }}>Store {p.dataKey}:</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: p.color, fontFamily: "'JetBrains Mono', monospace" }}>
                {activeMetricObj.fmt(p.value)}
              </span>
              {comp && (
                <span
                  style={{
                    fontSize: 11,
                    color: comp.isImprovement ? 'var(--success-text)' : 'var(--danger-text)',
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                >
                  ({pctChange >= 0 ? '+' : ''}
                  {pctChange.toFixed(1)}%)
                </span>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  if (!activeMetric) {
    // Show mini sparklines grid when no metric selected
    return (
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 20 }}>
        <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 15, color: 'var(--text-primary)', marginBottom: 20 }}>
          Compare All Metrics
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
          {metrics.map((metric) => {
            // Build mini data for this specific metric
            const miniData: Array<Record<string, number | string>> = []
            const maxLength = Math.max(...selectedStores.map((num) => (reports[num] || []).length), 0)
            const dataPoints = Math.min(5, maxLength)
            
            for (let i = dataPoints - 1; i >= 0; i--) {
              const week: Record<string, number | string> = { week: `W${dataPoints - i}` }
              selectedStores.forEach((storeNum) => {
                const storeReports = reports[storeNum] || []
                const idx = storeReports.length - 1 - i
                if (idx >= 0 && idx < storeReports.length) {
                  const point = storeReports[idx]
                  week[storeNum] = (point[metric.key as keyof ReportPoint] as number) ?? 0
                } else {
                  week[storeNum] = 0
                }
              })
              miniData.push(week)
            }

            return (
              <div
                key={metric.key}
                style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 12,
                  padding: 16,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onClick={() => {
                  if (onMetricSelect) {
                    onMetricSelect(metric.key)
                  }
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = metric.color
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-subtle)'
                }}
              >
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: "'Inter', sans-serif", fontWeight: 500, letterSpacing: '0.08em', marginBottom: 8 }}>
                  {metric.label}
                </div>
                <ResponsiveContainer width="100%" height={120}>
                  <LineChart data={miniData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                    <XAxis dataKey="week" hide />
                    <YAxis hide />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload) return null
                        return (
                          <div style={{ background: 'var(--bg-overlay)', border: '1px solid var(--border-default)', borderRadius: 8, padding: '12px 16px' }}>
                            <div style={{ fontSize: 12, color: 'var(--text-primary)', fontFamily: "'Inter', sans-serif", marginBottom: 8 }}>
                              {metric.label}
                            </div>
                            {payload.map((p: any, i: number) => (
                              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                                <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.color }} />
                                <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: "'Inter', sans-serif" }}>Store {p.dataKey}:</span>
                                <span style={{ fontSize: 12, fontWeight: 600, color: p.color, fontFamily: "'JetBrains Mono', monospace" }}>
                                  {metric.fmt(p.value)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )
                      }}
                    />
                    {selectedStores.map((storeNum, i) => {
                      const storeIdx = stores.findIndex((s) => s.number === storeNum)
                      return (
                        <Line
                          key={storeNum}
                          type="monotone"
                          dataKey={storeNum}
                          stroke={storeColors[storeIdx % storeColors.length]}
                          strokeWidth={2}
                          dot={false}
                          activeDot={{ r: 3 }}
                        />
                      )
                    })}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 20 }}>
      {/* Header with View Toggle */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 15, color: 'var(--text-primary)' }}>
            {activeMetricObj.label} Comparison
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 4, fontFamily: "'Inter', sans-serif", fontWeight: 400 }}>
            {selectedStores.length} store{selectedStores.length !== 1 ? 's' : ''} · {periodMode === 'week' ? 'vs Previous Week' : periodMode === 'month' ? 'vs Previous Month' : 'vs Same Period Last Year'}
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* View Mode Toggle */}
          <div style={{ display: 'flex', gap: 4, background: 'var(--bg-overlay)', borderRadius: 8, padding: 4, border: '1px solid var(--border-subtle)' }}>
            {([
              ['summary', 'Summary'],
              ['graph', 'Graph View'],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setViewMode(key as 'summary' | 'graph')}
                style={{
                  padding: '6px 16px',
                  borderRadius: 8,
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 13,
                  fontWeight: 600,
                  letterSpacing: '0.04em',
                  background: viewMode === key ? 'var(--bg-elevated)' : 'transparent',
                  color: viewMode === key ? 'var(--text-primary)' : 'var(--text-tertiary)',
                  transition: 'all 0.2s',
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Period Toggle */}
          <div style={{ display: 'flex', gap: 4, background: 'var(--bg-overlay)', borderRadius: 8, padding: 4, border: '1px solid var(--border-subtle)' }}>
            {([
              ['week', 'vs Previous Week'],
              ['month', 'vs Previous Month'],
              ['year', 'vs Same Period Last Year'],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setPeriodMode(key)}
                style={{
                  padding: '6px 16px',
                  borderRadius: 8,
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 13,
                  fontWeight: 600,
                  letterSpacing: '0.04em',
                  background: periodMode === key ? 'var(--bg-elevated)' : 'transparent',
                  color: periodMode === key ? 'var(--text-primary)' : 'var(--text-tertiary)',
                  transition: 'all 0.2s',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content with smooth transition */}
      <div
        style={{
          opacity: 1,
          transition: 'opacity 0.3s ease-in-out',
        }}
      >

        {viewMode === 'summary' ? (
          <>
            {/* Line Chart */}
            <div style={{ marginBottom: 24 }}>
              {lineChartData.length < 3 ? (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-secondary)', fontFamily: "'Inter', sans-serif", fontSize: 13, minHeight: 240 }}>
                  Not enough data points for this view. Upload more weekly reports to see trends.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={Math.max(240, 280)}>
                  <LineChart data={lineChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="1 3" stroke="var(--border-subtle)" />
                    <XAxis
                      dataKey="week"
                      stroke="var(--text-tertiary)"
                      tick={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", fill: 'var(--text-tertiary)' }}
                    />
                    <YAxis
                      stroke="var(--text-tertiary)"
                      tick={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", fill: 'var(--text-tertiary)' }}
                      tickFormatter={(v) => (activeMetricObj.unit === '$' ? `$${(v / 1000).toFixed(0)}k` : `${v}%`)}
                      domain={[
                        (dataMin: number) => Math.max(0, Math.floor(dataMin * 0.92)),
                        (dataMax: number) => Math.ceil(dataMax * 1.08),
                      ]}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend
                      wrapperStyle={{ fontSize: 12, fontFamily: "'Inter', sans-serif", color: 'var(--text-secondary)' }}
                      formatter={(val) => `Store ${val}`}
                    />
                    {target !== undefined && (
                      <ReferenceLine y={target} stroke="var(--warning)" strokeDasharray="4 4" label={{ value: 'Target', position: 'right' }} />
                    )}
                    {selectedStores.map((storeNum, i) => {
                      const storeIdx = stores.findIndex((s) => s.number === storeNum)
                      return (
                        <Line
                          key={storeNum}
                          type="monotoneX"
                          dataKey={storeNum}
                          stroke={storeColors[storeIdx % storeColors.length]}
                          strokeWidth={2.5}
                          dot={{ r: 3, fill: storeColors[storeIdx % storeColors.length] }}
                          activeDot={{ r: 5 }}
                        />
                      )
                    })}
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Change Summary Cards */}
            <div style={{ display: 'flex', gap: 12, overflowX: 'auto', marginBottom: 24, paddingBottom: 8 }}>
              {comparisonData.map((data, i) => {
                const store = stores.find((s) => s.number === data.storeNum)
                const storeIdx = stores.findIndex((s) => s.number === data.storeNum)
                const arrow = data.isImprovement ? '▲' : '▼'
                const color = data.isImprovement ? 'var(--success-text)' : 'var(--danger-text)'
                
                return (
                  <div
                    key={data.storeNum}
                    style={{
                      minWidth: 180,
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 12,
                      padding: 16,
                      flexShrink: 0,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <div
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: storeColors[storeIdx % storeColors.length],
                        }}
                      />
                      <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>
                        {store?.name || `Store ${data.storeNum}`}
                      </div>
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-primary)', marginBottom: 4 }}>
                      {activeMetricObj.fmt(data.current)}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>
                      <span style={{ color, fontSize: 14 }}>{arrow}</span>
                      <span style={{ color }}>
                        {data.pctChange >= 0 ? '+' : ''}
                        {data.pctChange.toFixed(1)}% vs {periodMode === 'week' ? 'last week' : periodMode === 'month' ? 'last month' : 'last year'}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Bar Chart */}
            <div>
              <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 15, color: 'var(--text-primary)', marginBottom: 16 }}>
                Current vs Previous Period
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={barChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="1 3" stroke="var(--border-subtle)" />
                  <XAxis
                    dataKey="store"
                    stroke="var(--text-tertiary)"
                    tick={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", fill: 'var(--text-tertiary)' }}
                  />
                  <YAxis
                    stroke="var(--text-tertiary)"
                    tick={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", fill: 'var(--text-tertiary)' }}
                    tickFormatter={(v) => (activeMetricObj.unit === '$' ? `$${(v / 1000).toFixed(0)}k` : `${v}%`)}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload) return null
                      return (
                        <div style={{ background: 'var(--bg-overlay)', border: '1px solid var(--border-default)', borderRadius: 8, padding: '12px 16px' }}>
                          {payload.map((p: any, i: number) => (
                            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                              <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.color }} />
                              <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: "'Inter', sans-serif" }}>{p.name}:</span>
                              <span style={{ fontSize: 12, fontWeight: 600, color: p.color, fontFamily: "'JetBrains Mono', monospace" }}>
                                {activeMetricObj.fmt(p.value)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )
                    }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 12, fontFamily: "'Inter', sans-serif", color: 'var(--text-secondary)' }}
                  />
                  <Bar dataKey="current" fill={activeMetricObj.color} name="Current Period" />
                  <Bar dataKey="previous" fill={activeMetricObj.color} fillOpacity={0.5} name="Previous Period" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        ) : (
          /* Graph View - Visual Comparison */
          <div>
            {/* Side-by-Side Comparison Charts */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 20, marginBottom: 24 }}>
              {comparisonData.map((data, i) => {
                const store = stores.find((s) => s.number === data.storeNum)
                const storeIdx = stores.findIndex((s) => s.number === data.storeNum)
                const storeColor = storeColors[storeIdx % storeColors.length]
                const arrow = data.isImprovement ? '▲' : '▼'
                const changeColor = data.isImprovement ? 'var(--success-text)' : 'var(--danger-text)'
                
                // Build data for this store's comparison chart
                const storeChartData = [
                  {
                    period: 'Previous',
                    value: data.previous,
                  },
                  {
                    period: 'Current',
                    value: data.current,
                  },
                ]

                return (
                  <div
                    key={data.storeNum}
                    style={{
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 12,
                      padding: 20,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                      <div
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: '50%',
                          background: storeColor,
                        }}
                      />
                      <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 15, color: 'var(--text-primary)' }}>
                        {store?.name || `Store ${data.storeNum}`}
                      </div>
                    </div>

                    {/* Comparison Bar Chart */}
                    <div style={{ marginBottom: 16 }}>
                      <ResponsiveContainer width="100%" height={180}>
                        <BarChart data={storeChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="1 3" stroke="var(--border-subtle)" />
                          <XAxis
                            dataKey="period"
                            stroke="var(--text-tertiary)"
                            tick={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", fill: 'var(--text-tertiary)' }}
                          />
                          <YAxis
                            stroke="var(--text-tertiary)"
                            tick={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", fill: 'var(--text-tertiary)' }}
                            tickFormatter={(v) => (activeMetricObj.unit === '$' ? `$${(v / 1000).toFixed(0)}k` : `${v}%`)}
                            domain={[
                              (dataMin: number) => Math.max(0, Math.floor(dataMin * 0.9)),
                              (dataMax: number) => Math.ceil(dataMax * 1.1),
                            ]}
                          />
                          <Tooltip
                            content={({ active, payload }) => {
                              if (!active || !payload || !payload[0]) return null
                              return (
                                <div style={{ background: 'var(--bg-overlay)', border: '1px solid var(--border-default)', borderRadius: 8, padding: '12px 16px' }}>
                                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: "'Inter', sans-serif", marginBottom: 4 }}>
                                    {payload[0].payload.period}
                                  </div>
                                  <div style={{ fontSize: 13, fontWeight: 600, color: storeColor, fontFamily: "'JetBrains Mono', monospace" }}>
                                    {activeMetricObj.fmt(payload[0].value as number)}
                                  </div>
                                </div>
                              )
                            }}
                          />
                          <Bar dataKey="value" fill={storeColor} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Values and Change */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 16, borderTop: '1px solid var(--border-subtle)' }}>
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: "'Inter', sans-serif", fontWeight: 500, marginBottom: 4 }}>
                          Previous
                        </div>
                        <div style={{ fontSize: 16, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-secondary)' }}>
                          {activeMetricObj.fmt(data.previous)}
                        </div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: "'Inter', sans-serif", fontWeight: 500, marginBottom: 4 }}>
                          Change
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 16, fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>
                          <span style={{ color: changeColor, fontSize: 18 }}>{arrow}</span>
                          <span style={{ color: changeColor }}>
                            {data.pctChange >= 0 ? '+' : ''}
                            {data.pctChange.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: "'Inter', sans-serif", fontWeight: 500, marginBottom: 4 }}>
                          Current
                        </div>
                        <div style={{ fontSize: 16, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-primary)' }}>
                          {activeMetricObj.fmt(data.current)}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Trend Line Chart - All Stores Over Time */}
            <div>
              <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 15, color: 'var(--text-primary)', marginBottom: 16 }}>
                Trend Over Time
              </div>
              {lineChartData.length < 3 ? (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-secondary)', fontFamily: "'Inter', sans-serif", fontSize: 13, minHeight: 240 }}>
                  Not enough data points for this view. Upload more weekly reports to see trends.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={Math.max(240, 300)}>
                  <LineChart data={lineChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="1 3" stroke="var(--border-subtle)" />
                    <XAxis
                      dataKey="week"
                      stroke="var(--text-tertiary)"
                      tick={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", fill: 'var(--text-tertiary)' }}
                    />
                    <YAxis
                      stroke="var(--text-tertiary)"
                      tick={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", fill: 'var(--text-tertiary)' }}
                      tickFormatter={(v) => (activeMetricObj.unit === '$' ? `$${(v / 1000).toFixed(0)}k` : `${v}%`)}
                      domain={[
                        (dataMin: number) => Math.max(0, Math.floor(dataMin * 0.92)),
                        (dataMax: number) => Math.ceil(dataMax * 1.08),
                      ]}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend
                      wrapperStyle={{ fontSize: 12, fontFamily: "'Inter', sans-serif", color: 'var(--text-secondary)' }}
                      formatter={(val) => `Store ${val}`}
                    />
                    {target !== undefined && (
                      <ReferenceLine y={target} stroke="var(--warning)" strokeDasharray="4 4" label={{ value: 'Target', position: 'right' }} />
                    )}
                    {selectedStores.map((storeNum, i) => {
                      const storeIdx = stores.findIndex((s) => s.number === storeNum)
                      return (
                        <Line
                          key={storeNum}
                          type="monotoneX"
                          dataKey={storeNum}
                          stroke={storeColors[storeIdx % storeColors.length]}
                          strokeWidth={2.5}
                          dot={{ r: 3, fill: storeColors[storeIdx % storeColors.length] }}
                          activeDot={{ r: 5 }}
                        />
                      )
                    })}
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

