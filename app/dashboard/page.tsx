'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import type { DailyReportWithStore } from '@/lib/db'
import ComparisonPanel from '@/components/ComparisonPanel'
import SingleStoreDateCompare from '@/components/SingleStoreDateCompare'
import YearOverYearUploadPanel from '@/components/YearOverYearUploadPanel'
import YearOverYearPanel from '@/components/YearOverYearPanel'


// ── Types ─────────────────────────────────────────────────────────────────────
type MetricKey = 'net_sales' | 'labor_pct' | 'food_cost_pct' | 'flm_pct' | 'cash_short' | 'doordash_sales' | 'ubereats_sales'

type StoreUI = {
  id: string
  number: string
  name: string
  location: string
}

type ReportPoint = {
  label: string
  report_date: string
  net_sales: number
  labor_pct: number
  food_cost_pct: number
  flm_pct: number
  cash_short: number
  doordash_sales?: number
  ubereats_sales?: number
}

type ReportsByStore = Record<string, ReportPoint[]>

type UploadItem = {
  file: File
  name: string
  size: string
  status: 'ready' | 'uploading' | 'done' | 'error'
  error?: string
  parsedData?: {
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
}

// ── Targets ──────────────────────────────────────────────────────────────────
const TARGETS: Partial<Record<MetricKey, number>> = {
  labor_pct: 28.68,
  food_cost_pct: 26.42,
  flm_pct: 55.11,
  cash_short: 50,
  net_sales: 3000, // projected (MVP default)
}

const METRICS: Array<{
  key: MetricKey
  label: string
  fmt: (v: number) => string
  color: string
  unit: '$' | '%'
}> = [
  { key: 'net_sales', label: 'Net Sales', fmt: (v) => `$${v?.toLocaleString()}`, color: '#3b82f6', unit: '$' },
  { key: 'labor_pct', label: 'Labor %', fmt: (v) => `${v}%`, color: '#f59e0b', unit: '%' },
  { key: 'food_cost_pct', label: 'Food Cost %', fmt: (v) => `${v}%`, color: '#8b5cf6', unit: '%' },
  { key: 'flm_pct', label: 'FLM %', fmt: (v) => `${v}%`, color: '#ec4899', unit: '%' },
  { key: 'cash_short', label: 'Cash Short/Over', fmt: (v) => (v >= 0 ? `+$${v}` : `-$${Math.abs(v)}`), color: '#14b8a6', unit: '$' },
  { key: 'doordash_sales', label: 'DoorDash Sales', fmt: (v) => `$${v?.toLocaleString()}`, color: '#f97316', unit: '$' },
  { key: 'ubereats_sales', label: 'Uber Eats Sales', fmt: (v) => `$${v?.toLocaleString()}`, color: '#06b6d4', unit: '$' },
]

const STORE_COLORS = ['var(--store-1)', 'var(--store-2)', 'var(--store-3)', 'var(--store-4)', 'var(--store-5)', 'var(--store-6)']

// ── Seed Data ────────────────────────────────────────────────────────────────
const SEED_STORES = [
  { id: '1', number: '2081', name: 'Store 2081', location: 'Burbank' },
  { id: '2', number: '2292', name: 'Store 2292', location: 'Glendale' },
  { id: '3', number: '3011', name: 'Store 3011', location: 'Pasadena' },
  { id: '4', number: '3102', name: 'Store 3102', location: 'Van Nuys' },
  { id: '5', number: '3245', name: 'Store 3245', location: 'Northridge' },
  { id: '6', number: '3389', name: 'Store 3389', location: 'Chatsworth' },
]

function generateSeedReports(): DailyReportWithStore[] {
  const reports: DailyReportWithStore[] = []
  const today = new Date()
  
  // Generate 5 weeks of data (35 days)
  for (let dayOffset = 34; dayOffset >= 0; dayOffset--) {
    const reportDate = new Date(today)
    reportDate.setDate(reportDate.getDate() - dayOffset)
    const dateStr = reportDate.toISOString().split('T')[0]
    
    for (const store of SEED_STORES) {
      reports.push({
        id: `seed-${store.number}-${dateStr}`,
        store_id: store.id,
        report_date: dateStr,
        net_sales: Math.round((55000 + Math.random() * 20000) * 100) / 100,
        labor_pct: Math.round((24 + Math.random() * 7) * 100) / 100,
        food_cost_pct: Math.round((24 + Math.random() * 6) * 100) / 100,
        flm_pct: Math.round((50 + Math.random() * 8) * 100) / 100,
        cash_short: Math.round((Math.random() * 450 - 50) * 100) / 100,
        doordash_sales: Math.round((4000 + Math.random() * 3000) * 100) / 100,
        ubereats_sales: Math.round((3000 + Math.random() * 3000) * 100) / 100,
        raw_pdf_url: null,
        created_at: new Date().toISOString(),
        stores: {
          id: store.id,
          store_number: Number(store.number),
          name: store.name,
          location: store.location,
          created_at: new Date().toISOString(),
        },
      } as DailyReportWithStore)
    }
  }
  
  return reports
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function safeNum(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}

function isGood(key: MetricKey, value: number) {
  if (key === 'net_sales') return value >= TARGETS.net_sales
  if (key === 'cash_short') return Math.abs(value) < TARGETS.cash_short
  return value < TARGETS[key]
}

function formatDateShort(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function monthLabel(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function aggregateMonthly(points: ReportPoint[]): ReportPoint[] {
  // Group by week within the current month (not aggregate entire month)
  // This gives us weekly data points within the month for proper chart curves
  if (points.length === 0) return []
  
  // Get the most recent month from the data
  const latestDate = new Date(points[points.length - 1].report_date)
  const currentMonth = latestDate.getMonth()
  const currentYear = latestDate.getFullYear()
  
  // Filter to only points in the current month
  const monthPoints = points.filter((p) => {
    const d = new Date(p.report_date)
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear
  })
  
  if (monthPoints.length === 0) return []
  
  // Group by week (7-day periods)
  const weekBuckets = new Map<number, ReportPoint[]>()
  
  monthPoints.forEach((p) => {
    const d = new Date(p.report_date)
    const dayOfMonth = d.getDate()
    const weekNum = Math.ceil(dayOfMonth / 7) // Week 1, 2, 3, or 4
    
    if (!weekBuckets.has(weekNum)) {
      weekBuckets.set(weekNum, [])
    }
    weekBuckets.get(weekNum)!.push(p)
  })
  
  // Aggregate each week
  const out: ReportPoint[] = []
  const sortedWeeks = Array.from(weekBuckets.entries()).sort((a, b) => a[0] - b[0])
  
  sortedWeeks.forEach(([weekNum, rows]) => {
    const avg = (k: MetricKey) => rows.reduce((s, r) => s + safeNum((r as any)[k]), 0) / Math.max(1, rows.length)
    const sumSales = rows.reduce((s, r) => s + safeNum(r.net_sales), 0)
    
    // Use the first report date in the week as the representative date
    const firstDate = rows[0].report_date
    
    out.push({
      label: `Week ${weekNum}`,
      report_date: firstDate,
      net_sales: Math.round(sumSales * 100) / 100,
      labor_pct: Math.round(avg('labor_pct') * 100) / 100,
      food_cost_pct: Math.round(avg('food_cost_pct') * 100) / 100,
      flm_pct: Math.round(avg('flm_pct') * 100) / 100,
      cash_short: Math.round(avg('cash_short') * 100) / 100,
      doordash_sales: rows[0].doordash_sales ? Math.round(avg('doordash_sales') * 100) / 100 : undefined,
      ubereats_sales: rows[0].ubereats_sales ? Math.round(avg('ubereats_sales') * 100) / 100 : undefined,
    })
  })
  
  return out
}

function Badge({ value, metricKey }: { value: number; metricKey: MetricKey }) {
  const good = isGood(metricKey, value)
  return (
    <span
      style={{
        fontSize: 10,
        fontFamily: "'Inter', sans-serif",
        fontWeight: 500,
        letterSpacing: '0.12em',
        padding: '2px 8px',
        borderRadius: 6,
        background: good ? 'var(--success-subtle)' : 'var(--danger-subtle)',
        color: good ? 'var(--success-text)' : 'var(--danger-text)',
      }}
    >
      {good ? 'ON TARGET' : 'OFF TARGET'}
    </span>
  )
}

// ── Upload Panel ─────────────────────────────────────────────────────────────
function UploadPanel({
  files,
  setFiles,
  onUpload,
  disabled,
}: {
  files: UploadItem[]
  setFiles: React.Dispatch<React.SetStateAction<UploadItem[]>>
  onUpload: (files: UploadItem[]) => Promise<void>
  disabled?: boolean
}) {
  const [drag, setDrag] = useState(false)
  const ref = useRef<HTMLInputElement | null>(null)

  const handle = (fs: FileList | null) => {
    if (!fs) return
    const arr = Array.from(fs).filter((f) => f.name.toLowerCase().endsWith('.pdf'))
    setFiles((prev) => [
      ...prev,
      ...arr.map((f) => ({
        file: f,
        name: f.name,
        size: `${(f.size / 1024).toFixed(0)}KB`,
        status: 'ready' as const,
      })),
    ])
  }

  return (
    <div style={{ padding: '24px 0' }}>
      <div
        className={`upload-zone ${drag ? 'drag' : ''}`}
        style={{ padding: 40, textAlign: 'center', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1 }}
        onDragOver={(e) => {
          e.preventDefault()
          if (!disabled) setDrag(true)
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDrag(false)
          if (!disabled) handle(e.dataTransfer.files)
        }}
        onClick={() => {
          if (!disabled) ref.current?.click()
        }}
      >
        <input
          ref={ref}
          type="file"
          multiple
          accept=".pdf"
          style={{ display: 'none' }}
          onChange={(e) => handle(e.target.files)}
        />
        <div
          style={{
            width: 48,
            height: 48,
            margin: '0 auto 12px',
            borderRadius: 8,
            background: 'var(--bg-overlay)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-tertiary)',
            fontSize: 24,
          }}
        >
          📄
        </div>
        <div
          style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: 16,
            fontWeight: 600,
            color: 'var(--text-primary)',
            marginBottom: 6,
          }}
        >
          Drop Papa Johns PDFs here
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-tertiary)', fontFamily: "'Inter', sans-serif", fontWeight: 400 }}>
          Upload daily operating reports for any store — supports multiple files at once
        </div>
      </div>

      {files.length > 0 && (
        <div style={{ marginTop: 20 }}>
          {files.map((f, i) => (
            <div key={`${f.name}-${i}`}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 16px',
                  background: 'var(--bg-elevated)',
                  borderRadius: 8,
                  marginBottom: 8,
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 6,
                      background: 'var(--bg-overlay)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--text-tertiary)',
                      fontSize: 16,
                    }}
                  >
                    📑
                  </div>
                  <div>
                    <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500, fontFamily: "'Inter', sans-serif" }}>{f.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: "'JetBrains Mono', monospace" }}>{f.size}</div>
                    {f.status === 'error' && (
                      <div style={{ fontSize: 11, color: 'var(--danger-text)', marginTop: 4, fontFamily: "'Inter', sans-serif" }}>
                        {f.error || 'Upload failed'}
                      </div>
                    )}
                  </div>
                </div>
                <span
                  style={{
                    fontSize: 11,
                    color:
                      f.status === 'ready'
                        ? 'var(--success-text)'
                        : f.status === 'uploading'
                          ? 'var(--info-text)'
                          : f.status === 'done'
                            ? 'var(--success-text)'
                            : 'var(--danger-text)',
                    fontFamily: "'JetBrains Mono', monospace",
                    fontWeight: 500,
                  }}
                >
                  {f.status.toUpperCase()}
                </span>
              </div>
              {/* Preview Card */}
              {f.status === 'done' && f.parsedData && (
                <div
                  style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 12,
                    padding: 16,
                    marginBottom: 12,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>
                      Store {f.parsedData.store_number}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: "'JetBrains Mono', monospace" }}>
                      {formatDateShort(f.parsedData.date_start)} – {formatDateShort(f.parsedData.date_end)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }}>
                    <span style={{ color: 'var(--text-secondary)' }}>
                      Net Sales: <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>${f.parsedData.net_sales.toLocaleString()}</span>
                    </span>
                    <span style={{ color: 'var(--text-secondary)' }}>
                      Labor: <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{f.parsedData.labor_pct.toFixed(2)}%</span>
                    </span>
                    <span style={{ color: 'var(--success-text)', fontSize: 14 }}>✓</span>
                  </div>
                </div>
              )}
            </div>
          ))}
          <button
            disabled={disabled}
            onClick={async () => {
              await onUpload(files)
            }}
            style={{
              marginTop: 12,
              width: '100%',
              padding: '12px 0',
              background: disabled ? 'var(--bg-overlay)' : 'var(--brand)',
              border: 'none',
              borderRadius: 8,
              color: '#fff',
              fontFamily: "'Inter', sans-serif",
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: '0.04em',
              cursor: disabled ? 'not-allowed' : 'pointer',
              opacity: disabled ? 0.7 : 1,
            }}
            onMouseEnter={(e) => {
              if (!disabled) {
                e.currentTarget.style.background = 'var(--brand-hover)'
              }
            }}
            onMouseLeave={(e) => {
              if (!disabled) {
                e.currentTarget.style.background = 'var(--brand)'
              }
            }}
          >
            PROCESS {files.length} REPORT{files.length > 1 ? 'S' : ''}
          </button>
          <button
            disabled={disabled}
            onClick={() => setFiles([])}
            style={{
              marginTop: 10,
              width: '100%',
              padding: '10px 0',
              background: 'var(--bg-overlay)',
              border: '1px solid var(--border-default)',
              borderRadius: 8,
              color: 'var(--text-secondary)',
              fontFamily: "'Inter', sans-serif",
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: '0.04em',
              cursor: disabled ? 'not-allowed' : 'pointer',
            }}
          >
            CLEAR
          </button>
        </div>
      )}
    </div>
  )
}

// ── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({
  store,
  reports,
}: {
  store: StoreUI
  reports: ReportPoint[]
}) {
  const latest = reports?.[reports.length - 1]
  if (!latest) return null
  const idx = Number.isFinite(Number(store.number))
    ? Number(store.number) % STORE_COLORS.length
    : 0

  const storeColor = STORE_COLORS[idx]

  return (
    <div
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 12,
        padding: 20,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          background: storeColor,
        }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 15, color: 'var(--text-primary)' }}>
            {store.name}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2, fontFamily: "'Inter', sans-serif", fontWeight: 400 }}>{store.location}</div>
        </div>
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 6,
            background: 'var(--bg-overlay)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 11,
            fontFamily: "'JetBrains Mono', monospace",
            color: storeColor,
            fontWeight: 500,
          }}
        >
          {store.number.slice(-2)}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {METRICS.map((m) => {
          const val = safeNum((latest as any)[m.key])
          const good = isGood(m.key, val)
          return (
            <div key={m.key} style={{ background: 'var(--bg-base)', borderRadius: 8, padding: '12px' }}>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: "'Inter', sans-serif", fontWeight: 500, letterSpacing: '0.08em', marginBottom: 8 }}>
                {m.label.toUpperCase()}
              </div>
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 600,
                  fontFamily: "'JetBrains Mono', monospace",
                  color: good ? 'var(--success-text)' : 'var(--danger-text)',
                }}
              >
                {m.fmt(val)}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Chart Section ─────────────────────────────────────────────────────────────
function ChartSection({
  selectedStores,
  activeMetric,
  reports,
  viewMode,
}: {
  selectedStores: string[]
  activeMetric: MetricKey
  reports: ReportsByStore
  viewMode: 'weekly' | 'monthly'
}) {
  const metric = METRICS.find((m) => m.key === activeMetric) || METRICS[0]

  // Build a shared X-axis: union of labels across selected stores.
  const labels = useMemo(() => {
    const s = new Set<string>()
    for (const storeNum of selectedStores) {
      for (const p of reports[storeNum] || []) s.add(p.label)
    }
    return Array.from(s)
  }, [reports, selectedStores])

  const chartData = useMemo(() => {
    return labels.map((label) => {
      const row: Record<string, any> = { label }
      selectedStores.forEach((storeNum) => {
        const p = (reports[storeNum] || []).find((x) => x.label === label)
        row[storeNum] = p ? safeNum((p as any)[metric.key]) : 0
      })
      return row
    })
  }, [labels, metric.key, reports, selectedStores])

  // Calculate Y axis domain for better visualization
  const yAxisDomain = useMemo(() => {
    if (chartData.length === 0) return undefined
    
    const allValues: number[] = []
    chartData.forEach((row) => {
      selectedStores.forEach((storeNum) => {
        const val = safeNum(row[storeNum])
        allValues.push(val)
      })
    })
    
    if (allValues.length === 0) return undefined
    
    const dataMin = Math.min(...allValues)
    const dataMax = Math.max(...allValues)
    
    // If all values are the same, create a small range around it
    if (dataMin === dataMax) {
      const center = dataMax
      const padding = Math.max(center * 0.1, 1)
      return [Math.max(0, center - padding), center + padding]
    }
    
    const range = dataMax - dataMin
    // Ensure minimum padding of 8% on each side
    const padding = Math.max(range * 0.08, range * 0.05)
    
    return [
      Math.max(0, Math.floor(dataMin - padding)),
      Math.ceil(dataMax + padding),
    ]
  }, [chartData, selectedStores])

  // Use bar chart if only 2 data points, line chart otherwise
  const useBarChart = chartData.length === 2
  const hasEnoughData = chartData.length >= 3

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload) return null
    return (
      <div style={{ background: 'var(--bg-overlay)', border: '1px solid var(--border-default)', borderRadius: 8, padding: '12px 16px' }}>
        <div style={{ fontSize: 12, color: 'var(--text-primary)', fontFamily: "'Inter', sans-serif", marginBottom: 8 }}>{label}</div>
        {payload.map((p: any, i: number) => (
          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.color }} />
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: "'Inter', sans-serif" }}>Store {p.dataKey}:</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: p.color, fontFamily: "'JetBrains Mono', monospace" }}>
              {metric.fmt(safeNum(p.value))}
            </span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 15, color: 'var(--text-primary)' }}>
            {metric.label} Comparison
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 4, fontFamily: "'Inter', sans-serif", fontWeight: 400 }}>
            {selectedStores.length} store{selectedStores.length !== 1 ? 's' : ''} · {viewMode === 'weekly' ? 'Daily' : 'Weekly (Current Month)'} view
          </div>
        </div>
        {TARGETS[metric.key] !== undefined && (
          <div
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 11,
              color: 'var(--warning-text)',
              background: 'var(--warning-subtle)',
              padding: '6px 12px',
              borderRadius: 8,
            }}
          >
            TARGET:{' '}
            {metric.key === 'net_sales'
              ? `$${TARGETS[metric.key].toLocaleString()}`
              : metric.key === 'cash_short'
                ? `< $${TARGETS[metric.key]}`
                : `< ${TARGETS[metric.key]}${metric.unit}`}
          </div>
        )}
      </div>

      {!hasEnoughData && chartData.length > 0 ? (
        <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-secondary)', fontFamily: "'Inter', sans-serif", fontSize: 13 }}>
          Not enough data points for this view. Upload more weekly reports to see trends.
        </div>
      ) : chartData.length === 0 ? (
        <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-secondary)', fontFamily: "'Inter', sans-serif", fontSize: 13 }}>
          No data available for selected stores.
        </div>
      ) : useBarChart ? (
        <ResponsiveContainer width="100%" height={Math.max(240, 300)}>
          <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="1 3" stroke="var(--border-subtle)" />
            <XAxis dataKey="label" stroke="var(--text-tertiary)" tick={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", fill: 'var(--text-tertiary)' }} />
            <YAxis
              stroke="var(--text-tertiary)"
              tick={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", fill: 'var(--text-tertiary)' }}
              tickFormatter={(v) => (metric.unit === '$' ? `$${(safeNum(v) / 1000).toFixed(0)}k` : `${safeNum(v)}%`)}
              domain={yAxisDomain}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: 12, fontFamily: "'Inter', sans-serif", color: 'var(--text-secondary)' }}
              formatter={(val) => `Store ${val}`}
            />
            {selectedStores.map((storeNum) => {
              const storeIdx = Math.abs(parseInt(storeNum, 10) || 0) % STORE_COLORS.length
              return (
                <Bar
                  key={storeNum}
                  dataKey={storeNum}
                  fill={STORE_COLORS[storeIdx]}
                  name={`Store ${storeNum}`}
                />
              )
            })}
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <ResponsiveContainer width="100%" height={Math.max(240, 300)}>
          <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="1 3" stroke="var(--border-subtle)" />
            <XAxis dataKey="label" stroke="var(--text-tertiary)" tick={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", fill: 'var(--text-tertiary)' }} />
            <YAxis
              stroke="var(--text-tertiary)"
              tick={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", fill: 'var(--text-tertiary)' }}
              tickFormatter={(v) => (metric.unit === '$' ? `$${(safeNum(v) / 1000).toFixed(0)}k` : `${safeNum(v)}%`)}
              domain={yAxisDomain}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: 12, fontFamily: "'Inter', sans-serif", color: 'var(--text-secondary)' }}
              formatter={(val) => `Store ${val}`}
            />
            {selectedStores.map((storeNum) => {
              const storeIdx = Math.abs(parseInt(storeNum, 10) || 0) % STORE_COLORS.length
              return (
                <Line
                  key={storeNum}
                  type="monotoneX"
                  dataKey={storeNum}
                  stroke={STORE_COLORS[storeIdx]}
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: STORE_COLORS[storeIdx] }}
                  activeDot={{ r: 5 }}
                />
              )
            })}
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

// ── Full Report Table ─────────────────────────────────────────────────────────
function FullReportTable({
  selectedStores,
  stores,
  reports,
}: {
  selectedStores: string[]
  stores: StoreUI[]
  reports: ReportsByStore
}) {
  const rows = useMemo(() => {
    const out: Array<{ store: StoreUI; point: ReportPoint }> = []
    for (const storeNum of selectedStores) {
      const store = stores.find((s) => s.number === storeNum)
      if (!store) continue
      for (const p of reports[storeNum] || []) out.push({ store, point: p })
    }
    // Most recent first
    out.sort((a, b) => (a.point.report_date < b.point.report_date ? 1 : -1))
    return out
  }, [reports, selectedStores, stores])

  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 20, overflowX: 'auto' }}>
      <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 15, color: 'var(--text-primary)', marginBottom: 20 }}>
        Full Report — All Metrics
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: 'var(--bg-base)' }}>
            <th style={{ textAlign: 'left', padding: '10px 16px', color: 'var(--text-tertiary)', fontFamily: "'Inter', sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', borderBottom: '1px solid var(--border-subtle)' }}>
              STORE
            </th>
            <th style={{ textAlign: 'left', padding: '10px 16px', color: 'var(--text-tertiary)', fontFamily: "'Inter', sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', borderBottom: '1px solid var(--border-subtle)' }}>
              DATE
            </th>
            {METRICS.map((m) => (
              <th key={m.key} style={{ textAlign: 'right', padding: '10px 16px', color: 'var(--text-tertiary)', fontFamily: "'Inter', sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', borderBottom: '1px solid var(--border-subtle)' }}>
                {m.label.toUpperCase()}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ store, point }, idx) => {
            const storeIdx = Math.abs(parseInt(store.number, 10) || 0) % STORE_COLORS.length
            return (
              <tr key={`${store.number}-${point.report_date}-${idx}`} style={{ background: idx % 2 === 0 ? 'var(--bg-surface)' : 'var(--bg-elevated)', borderBottom: '1px solid var(--border-subtle)' }}>
                <td style={{ padding: '10px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: STORE_COLORS[storeIdx], flexShrink: 0 }} />
                    <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontFamily: "'Inter', sans-serif", fontSize: 13 }}>{store.name}</span>
                  </div>
                </td>
                <td style={{ padding: '10px 16px', color: 'var(--text-tertiary)', fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>
                  {point.label}
                </td>
                {METRICS.map((m) => {
                  const val = safeNum((point as any)[m.key])
                  const good = isGood(m.key, val)
                  return (
                    <td key={m.key} style={{ padding: '10px 16px', textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 500, color: good ? 'var(--success-text)' : 'var(--danger-text)' }}>
                      {m.fmt(val)}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

async function fetchReports(days: number): Promise<{ data: DailyReportWithStore[]; isRealData: boolean }> {
  try {
    const res = await fetch(`/api/daily-reports?days=${encodeURIComponent(String(days))}`, { cache: 'no-store' })
    if (!res.ok) {
      // Fallback to seed data on API error
      return { data: generateSeedReports(), isRealData: false }
    }
    const data = await res.json()
    // If API returns empty array, fallback to seed data
    if (!Array.isArray(data) || data.length === 0) {
      return { data: generateSeedReports(), isRealData: false }
    }
    return { data, isRealData: true }
  } catch (error) {
    // Fallback to seed data on fetch error
    console.warn('Failed to fetch from API, using seed data:', error)
    return { data: generateSeedReports(), isRealData: false }
  }
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [raw, setRaw] = useState<DailyReportWithStore[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isRealData, setIsRealData] = useState(false)

  const [stores, setStores] = useState<StoreUI[]>([])
  const [reports, setReports] = useState<ReportsByStore>({})
  const [selectedStores, setSelectedStores] = useState<string[]>([])

  const [activeMetric, setActiveMetric] = useState<MetricKey | null>(null) // null = full report
  const [viewMode, setViewMode] = useState<'weekly' | 'monthly'>('weekly') // weekly | monthly
  const [activeTab, setActiveTab] = useState<'dashboard' | 'upload' | 'yoy' | 'automation' | 'live' | 'guest-experience'>('dashboard') // dashboard | upload | yoy | automation | live | guest-experience
  const [compareMode, setCompareMode] = useState(false) // compare mode toggle
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadFiles, setUploadFiles] = useState<UploadItem[]>([])
  
  // Year-over-year state
  type YoYComparison = {
    store_number: string
    current: {
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
    lastYear: {
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
  }
  const [yoyComparisons, setYoyComparisons] = useState<YoYComparison[]>([])
  const [selectedYoYStore, setSelectedYoYStore] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<string>('')
  
  // Live tab state
  const [liveData, setLiveData] = useState<Array<{
    store_number: string
    date: string
    total_net_sales: number
    ly_net_sales: number
    comp_pct: string | null
    online_net_sales?: number
    ly_online_net_sales?: number
    online_comp_pct?: string | null
    total_orders?: number
    psa_sales?: number
    ticket_average?: number
    target_food_cost: number
    target_food_pct?: number
    delivery_orders: number
    avg_make_time: string | null
    avg_rack_time?: string | null
    otd_time: string | null
    carryout_pct: string | null
    labor_dollars: number
    labor_pct: number
    orders_to_deliver?: number
    product_to_make?: number
    scraped_at: string
  }>>([])
  const [liveLoading, setLiveLoading] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [liveError, setLiveError] = useState<string | null>(null)
  const [liveLastUpdated, setLiveLastUpdated] = useState<Date | null>(null)
  const [refreshCountdown, setRefreshCountdown] = useState(0)
  const [selectedStore, setSelectedStore] = useState<any>(null)
  const [showStoreModal, setShowStoreModal] = useState(false)
  
  // Guest Experience (SMG) - Disabled
  // State kept minimal to prevent errors, but feature is disabled
  const [smgData] = useState<Array<any>>([])
  const [smgLoading] = useState(false)
  const [smgError] = useState<string | null>(null)
  const [smgLastUpdated] = useState<Date | null>(null)
  const [smgPeriod] = useState<'previous' | 'current'>('previous')

  const reload = async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const { data: rows, isRealData: real } = await fetchReports(35)
      setRaw(rows)
      setIsRealData(real)
    } catch (e: any) {
      // Try seed data as last resort
      try {
        const seedRows = generateSeedReports()
        setRaw(seedRows)
        setIsRealData(false)
        // Don't set error if seed data works
      } catch (seedError: any) {
        // Only show error if seed data also fails
        setLoadError(seedError?.message || 'Failed to load data')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void reload()
    // Set timestamp only on client to avoid hydration mismatch
    setLastUpdated(new Date().toLocaleString())
  }, [])

  // Fetch live data function
  const fetchLiveData = async () => {
    // If we already have data, this is a refresh - use isRefreshing
    // If no data, this is initial load - use liveLoading
    const hasExistingData = liveData.length > 0
    
    if (hasExistingData) {
      setIsRefreshing(true)
    } else {
      setLiveLoading(true)
    }
    
    setLiveError(null)
    try {
      const res = await fetch('/api/scrape-extranet', { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.error || 'Failed to fetch live data')
      }
      if (json.success && json.data) {
        setLiveData(json.data)
        setLiveLastUpdated(new Date())
        setRefreshCountdown(15 * 60) // Reset to 15 minutes
      } else {
        throw new Error('Invalid response format')
      }
    } catch (error: any) {
      setLiveError(error.message || 'Failed to fetch live data')
      console.error('Live data fetch error:', error)
    } finally {
      if (hasExistingData) {
        setIsRefreshing(false)
      } else {
        setLiveLoading(false)
      }
    }
  }

  // SMG Guest Experience is temporarily disabled
  // const fetchSMGData = async () => {
  //   // Disabled
  // }

  // Auto-refresh countdown timer
  useEffect(() => {
    if (activeTab !== 'live') {
      // Clear countdown when switching away
      setRefreshCountdown(0)
      return
    }
    
    // Fetch immediately when tab is first activated (only if no data exists)
    if (liveData.length === 0 && !liveLoading) {
      void fetchLiveData()
    }

    // Countdown timer
    const countdownInterval = setInterval(() => {
      setRefreshCountdown((prev) => {
        if (prev <= 1) {
          return 0
        }
        return prev - 1
      })
    }, 1000)

    // Auto-refresh every 15 minutes
    const refreshInterval = setInterval(() => {
      if (activeTab === 'live') {
        void fetchLiveData()
      }
    }, 15 * 60 * 1000)

    return () => {
      clearInterval(countdownInterval)
      clearInterval(refreshInterval)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])

  // SMG Guest Experience is temporarily disabled
  // useEffect(() => {
  //   // Disabled
  //   // eslint-disable-next-line react-hooks/exhaustive-deps
  // }, [activeTab])

  // Format countdown timer
  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  useEffect(() => {
    // Normalize stores + reports from joined rows.
    const storeMap = new Map<string, StoreUI>()
    const byStore: ReportsByStore = {}

    for (const r of raw) {
      const s = (r as any).stores
      if (!s) continue
      const store: StoreUI = {
        id: String(s.id),
        number: String(s.store_number),
        name: String(s.name),
        location: String(s.location),
      }
      storeMap.set(store.number, store)

      const point: ReportPoint = {
        label: formatDateShort(r.report_date),
        report_date: r.report_date,
        net_sales: safeNum(r.net_sales),
        labor_pct: safeNum(r.labor_pct),
        food_cost_pct: safeNum(r.food_cost_pct),
        flm_pct: safeNum(r.flm_pct),
        cash_short: safeNum(r.cash_short),
        doordash_sales: safeNum((r as any).doordash_sales),
        ubereats_sales: safeNum((r as any).ubereats_sales),
      }

      if (!byStore[store.number]) byStore[store.number] = []
      byStore[store.number].push(point)
    }

    // Sort each store's points chronologically.
    for (const k of Object.keys(byStore)) {
      byStore[k].sort((a, b) => (a.report_date > b.report_date ? 1 : -1))
    }

    let storeList = Array.from(storeMap.values()).sort((a, b) => (a.number > b.number ? 1 : -1))

    // Apply view mode transformation.
    if (viewMode === 'monthly') {
      const monthly: ReportsByStore = {}
      for (const k of Object.keys(byStore)) monthly[k] = aggregateMonthly(byStore[k])
      setReports(monthly)
    } else {
      setReports(byStore)
    }

    setStores(storeList)

    // Initialize selected stores if empty.
    if (selectedStores.length === 0 && storeList.length > 0) {
      setSelectedStores(storeList.slice(0, Math.min(3, storeList.length)).map((s) => s.number))
    } else {
      // Ensure selection exists.
      const available = new Set(storeList.map((s) => s.number))
      setSelectedStores((prev) => prev.filter((n) => available.has(n)))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raw, viewMode])

  const dateRange = useMemo(() => {
    const dates = raw.map((r) => r.report_date).filter(Boolean).sort()
    if (dates.length === 0) return null
    return { start: dates[0], end: dates[dates.length - 1] }
  }, [raw])

  const toggleStore = (num: string) => {
    setSelectedStores((prev) => (prev.includes(num) ? (prev.length > 1 ? prev.filter((s) => s !== num) : prev) : [...prev, num]))
  }

  const selectAll = () => setSelectedStores(stores.map((s) => s.number))
  const selectNone = () => setSelectedStores(stores[0] ? [stores[0].number] : [])

  const handleUpload = async (items: UploadItem[]) => {
    if (items.length === 0) return
    setUploading(true)
    try {
      // Mark all uploading
      setUploadFiles((prev) =>
        prev.map((p) => (items.find((i) => i.name === p.name && i.size === p.size) ? { ...p, status: 'uploading', error: undefined } : p))
      )

      // Upload sequentially (more predictable for MVP).
      let okCount = 0
      for (const item of items) {
        try {
          const fd = new FormData()
          fd.append('file', item.file, item.file.name)
          const res = await fetch('/api/parse-pdf', { method: 'POST', body: fd })
          const json = await res.json().catch(() => ({}))
          if (!res.ok) throw new Error(json?.error || 'Parse failed')
          
          // Store parsed data for preview
          const parsedData = {
            store_number: json.store_number,
            date_start: json.date_start,
            date_end: json.date_end,
            net_sales: json.net_sales,
            labor_pct: json.labor_pct,
            food_cost_pct: json.food_cost_pct,
            flm_pct: json.flm_pct,
            cash_short: json.cash_short,
            doordash_sales: json.doordash_sales,
            ubereats_sales: json.ubereats_sales,
          }
          
          // Store parsed data in localStorage for automation demo
          localStorage.setItem('lastParsedReport', JSON.stringify(parsedData))
          
          // Also store the PDF file as base64 for actual parsing in email listener
          const pdfBase64 = await new Promise<string>((resolve) => {
            const reader = new FileReader()
            reader.onload = () => resolve(reader.result as string)
            reader.readAsDataURL(item.file)
          })
          localStorage.setItem('lastUploadedPDF', pdfBase64)
          
          setUploadFiles((prev) => prev.map((p) => (p.name === item.name && p.size === item.size ? { ...p, status: 'done', parsedData } : p)))
          okCount += 1
        } catch (e: any) {
          setUploadFiles((prev) =>
            prev.map((p) => (p.name === item.name && p.size === item.size ? { ...p, status: 'error', error: e?.message || 'Upload failed' } : p))
          )
        }
      }

      setUploadSuccess(`${okCount} report(s) processed and added to dashboard`)
      setTimeout(() => setUploadSuccess(null), 4000)
      setActiveTab('dashboard')
      // Reload data to show newly parsed reports
      await reload()
    } finally {
      setUploading(false)
    }
  }

  const selectedStoresSafe = selectedStores.filter((n) => stores.some((s) => s.number === n))

  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh', color: 'var(--text-primary)' }}>
      {/* Header */}
      <div style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-subtle)', padding: '0 32px' }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 6,
                background: 'var(--brand)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: "'Inter', sans-serif",
                fontSize: 12,
                fontWeight: 600,
                color: '#fff',
                letterSpacing: '0.04em',
              }}
            >
              PJ
            </div>
            <div>
              <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 16, color: 'var(--text-primary)' }}>Papa Johns Ops</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: "'Inter', sans-serif", fontWeight: 400 }}>
                {stores.length} store{stores.length === 1 ? '' : 's'} · Reporting
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 4, background: 'var(--bg-overlay)', borderRadius: 8, padding: 4, border: '1px solid var(--border-subtle)' }}>
            {([
              ['dashboard', 'Dashboard'],
              ['upload', 'Upload Reports'],
              ['yoy', 'Year vs Year'],
              ['automation', 'Automation Log'],
              ['live', 'Live'],
              ['guest-experience', 'Guest Experience'],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`tab-btn ${activeTab === key ? 'active' : ''}`}
                style={{
                  padding: '8px 16px',
                  borderRadius: 8,
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 13,
                  fontWeight: 600,
                  letterSpacing: '0.04em',
                  background: activeTab === key ? 'var(--brand)' : 'transparent',
                  color: activeTab === key ? '#fff' : 'var(--text-tertiary)',
                }}
              >
                {label}
              </button>
            ))}
          </div>

          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'right' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
              {lastUpdated && <span style={{ fontFamily: "'Inter', sans-serif" }}>Last updated: {lastUpdated}</span>}
              <span
                style={{
                  padding: '2px 8px',
                  borderRadius: 6,
                  fontSize: 10,
                  fontWeight: 500,
                  fontFamily: "'JetBrains Mono', monospace",
                  background: isRealData ? 'var(--success-subtle)' : 'var(--warning-subtle)',
                  color: isRealData ? 'var(--success-text)' : 'var(--warning-text)',
                }}
              >
                {isRealData ? 'LIVE DATA' : 'DEMO DATA'}
              </span>
            </div>
            {dateRange && <div style={{ fontFamily: "'Inter', sans-serif" }}>Range: {formatDateShort(dateRange.start)} – {formatDateShort(dateRange.end)}</div>}
          </div>
        </div>
      </div>

      {/* Upload success toast */}
      {uploadSuccess && (
        <div
          style={{
            position: 'fixed',
            top: 80,
            right: 24,
            zIndex: 999,
            background: 'var(--success)',
            color: '#fff',
            padding: '12px 20px',
            borderRadius: 8,
            fontFamily: "'Inter', sans-serif",
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: '0.04em',
          }}
          className="fade-in"
        >
          ✓ {uploadSuccess}
        </div>
      )}

      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '32px' }}>
        {loading && (
          <div className="fade-in" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 20 }}>
            <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 15, marginBottom: 8, color: 'var(--text-primary)' }}>Loading reports…</div>
            <div style={{ height: 2, borderRadius: 1, background: 'var(--bg-elevated)', width: '100%' }} />
          </div>
        )}
        {!loading && loadError && (
          <div className="fade-in" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 20 }}>
            <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 15, marginBottom: 8, color: 'var(--danger-text)' }}>Failed to load</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16, fontFamily: "'Inter', sans-serif" }}>{loadError}</div>
            <button
              onClick={() => void reload()}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                border: '1px solid var(--border-default)',
                background: 'var(--bg-overlay)',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                fontFamily: "'Inter', sans-serif",
                fontSize: 13,
                fontWeight: 600,
                letterSpacing: '0.04em',
              }}
            >
              Retry
            </button>
          </div>
        )}

        {/* UPLOAD TAB */}
        {!loading && activeTab === 'upload' && (
          <div className="fade-in" style={{ maxWidth: 600, margin: '0 auto' }}>
            <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: 20, marginBottom: 8, color: 'var(--text-primary)' }}>Upload Reports</div>
            <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 24, fontFamily: "'Inter', sans-serif", fontWeight: 400 }}>
              Drop daily operating PDFs from any store. System auto-detects store number and date range.
            </div>
            <UploadPanel files={uploadFiles} setFiles={setUploadFiles} onUpload={handleUpload} disabled={uploading} />
          </div>
        )}

        {/* AUTOMATION LOG TAB */}
        {!loading && activeTab === 'automation' && (
          <div className="fade-in">
            <iframe
              src="/automation"
              style={{
                width: '100%',
                height: 'calc(100vh - 200px)',
                border: 'none',
                borderRadius: 12,
                background: 'var(--bg-surface)',
              }}
              title="Automation Log"
            />
          </div>
        )}

        {/* LIVE TAB */}
        {!loading && activeTab === 'live' && (
          <div className="fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <div>
                <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: 20, marginBottom: 8, color: 'var(--text-primary)' }}>Live Store Data</div>
                <div style={{ fontSize: 13, color: 'var(--text-tertiary)', fontFamily: "'Inter', sans-serif", fontWeight: 400 }}>
                  Real-time KPI data from Papa Johns extranet
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                {liveLastUpdated && (
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)', fontFamily: "'Inter', sans-serif" }}>
                    Last updated: {liveLastUpdated.toLocaleTimeString()}
                  </div>
                )}
                {refreshCountdown > 0 && (
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: "'JetBrains Mono', monospace" }}>
                    Next refresh in {formatCountdown(refreshCountdown)}
                  </div>
                )}
                {isRefreshing && (
                  <div style={{ fontSize: 12, color: 'var(--info-text)', fontFamily: "'Inter', sans-serif", display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 12, height: 12, border: '2px solid var(--info-text)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                    Refreshing...
                  </div>
                )}
                <button
                  onClick={() => void fetchLiveData()}
                  disabled={liveLoading || isRefreshing}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 8,
                    border: 'none',
                    background: (liveLoading || isRefreshing) ? 'var(--bg-overlay)' : 'var(--brand)',
                    color: '#fff',
                    fontFamily: "'Inter', sans-serif",
                    fontSize: 13,
                    fontWeight: 600,
                    letterSpacing: '0.04em',
                    cursor: (liveLoading || isRefreshing) ? 'not-allowed' : 'pointer',
                    opacity: (liveLoading || isRefreshing) ? 0.7 : 1,
                  }}
                  onMouseEnter={(e) => {
                    if (!liveLoading && !isRefreshing) {
                      e.currentTarget.style.background = 'var(--brand-hover)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!liveLoading && !isRefreshing) {
                      e.currentTarget.style.background = 'var(--brand)'
                    }
                  }}
                >
                  {isRefreshing ? 'Refreshing...' : 'Refresh Now'}
                </button>
              </div>
            </div>

            {liveError && (
              <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 20, marginBottom: 24 }}>
                <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 15, marginBottom: 8, color: 'var(--danger-text)' }}>Error</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontFamily: "'Inter', sans-serif" }}>{liveError}</div>
              </div>
            )}

            {liveLoading && liveData.length === 0 && (
              <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 40, textAlign: 'center' }}>
                <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 15, color: 'var(--text-primary)', marginBottom: 8 }}>Loading live data...</div>
                <div style={{ height: 2, borderRadius: 1, background: 'var(--bg-elevated)', width: '100%', maxWidth: 400, margin: '0 auto' }} />
              </div>
            )}

            {!liveLoading && liveData.length > 0 && (
              <div 
                style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', 
                  gap: 16,
                  opacity: isRefreshing ? 0.6 : 1,
                  transition: 'opacity 0.3s ease',
                  position: 'relative'
                }}
              >
                {liveData.map((store) => {
                  const storeIdx = parseInt(store.store_number) % STORE_COLORS.length
                  const storeColor = STORE_COLORS[storeIdx]
                  const laborColor = store.labor_pct > 30 ? 'var(--danger-text)' : 'var(--success-text)'
                  
                  // Parse time in MM:SS format to total minutes
                  const parseTimeToMinutes = (timeStr: string | null): number | null => {
                    if (!timeStr) return null
                    const parts = timeStr.split(':')
                    if (parts.length === 2) {
                      const minutes = parseFloat(parts[0]) || 0
                      const seconds = parseFloat(parts[1]) || 0
                      return minutes + (seconds / 60)
                    }
                    return null
                  }
                  
                  const otdMinutes = parseTimeToMinutes(store.otd_time)
                  const otdColor = otdMinutes !== null ? (otdMinutes > 18 ? 'var(--danger-text)' : 'var(--success-text)') : 'var(--text-primary)'
                  const makeMinutes = parseTimeToMinutes(store.avg_make_time)
                  const makeColor = makeMinutes !== null ? (makeMinutes < 4 ? 'var(--success-text)' : 'var(--danger-text)') : 'var(--text-primary)'
                  
                  return (
                    <div
                      key={store.store_number}
                      onClick={() => {
                        setSelectedStore(store)
                        setShowStoreModal(true)
                      }}
                      style={{
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 12,
                        padding: 20,
                        position: 'relative',
                        overflow: 'hidden',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = storeColor
                        e.currentTarget.style.transform = 'translateY(-2px)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'var(--border-subtle)'
                        e.currentTarget.style.transform = 'none'
                      }}
                    >
                      <div
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          height: 3,
                          background: storeColor,
                        }}
                      />
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                        <div>
                          <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 15, color: 'var(--text-primary)' }}>
                            Store {store.store_number}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2, fontFamily: "'Inter', sans-serif", fontWeight: 400 }}>
                            {new Date(store.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </div>
                        </div>
                        <div
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: 6,
                            background: 'var(--bg-overlay)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 11,
                            fontFamily: "'JetBrains Mono', monospace",
                            color: storeColor,
                            fontWeight: 500,
                          }}
                        >
                          {store.store_number.slice(-2)}
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        {/* Total Net Sales */}
                        <div style={{ background: 'var(--bg-base)', borderRadius: 8, padding: '12px' }}>
                          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: "'Inter', sans-serif", fontWeight: 500, letterSpacing: '0.08em', marginBottom: 8 }}>
                            TOTAL NET SALES
                          </div>
                          <div style={{ fontSize: 18, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-primary)', marginBottom: 4 }}>
                            ${store.total_net_sales.toLocaleString()}
                          </div>
                          {store.ly_net_sales > 0 && (
                            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: "'Inter', sans-serif" }}>
                              LY: ${store.ly_net_sales.toLocaleString()}
                              {store.comp_pct && (
                                <span style={{ color: store.comp_pct.startsWith('-') ? 'var(--danger-text)' : 'var(--success-text)', marginLeft: 4 }}>
                                  {store.comp_pct}
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Labor % */}
                        <div style={{ background: 'var(--bg-base)', borderRadius: 8, padding: '12px' }}>
                          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: "'Inter', sans-serif", fontWeight: 500, letterSpacing: '0.08em', marginBottom: 8 }}>
                            LABOR %
                          </div>
                          <div style={{ fontSize: 22, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", color: laborColor }}>
                            {store.labor_pct.toFixed(2)}%
                          </div>
                          {store.labor_dollars > 0 && (
                            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: "'Inter', sans-serif", marginTop: 4 }}>
                              ${store.labor_dollars.toLocaleString()}
                            </div>
                          )}
                        </div>

                        {/* OTD Time */}
                        <div style={{ background: 'var(--bg-base)', borderRadius: 8, padding: '12px' }}>
                          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: "'Inter', sans-serif", fontWeight: 500, letterSpacing: '0.08em', marginBottom: 8 }}>
                            OTD TIME
                          </div>
                          <div style={{ fontSize: 22, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", color: otdColor }}>
                            {store.otd_time || 'N/A'}
                          </div>
                        </div>

                        {/* Avg Make Time */}
                        <div style={{ background: 'var(--bg-base)', borderRadius: 8, padding: '12px' }}>
                          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: "'Inter', sans-serif", fontWeight: 500, letterSpacing: '0.08em', marginBottom: 8 }}>
                            AVG MAKE TIME
                          </div>
                          <div style={{ fontSize: 22, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", color: makeColor }}>
                            {store.avg_make_time || 'N/A'}
                          </div>
                        </div>

                        {/* Delivery Orders */}
                        <div style={{ background: 'var(--bg-base)', borderRadius: 8, padding: '12px' }}>
                          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: "'Inter', sans-serif", fontWeight: 500, letterSpacing: '0.08em', marginBottom: 8 }}>
                            DELIVERY ORDERS
                          </div>
                          <div style={{ fontSize: 22, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-primary)' }}>
                            {store.delivery_orders.toLocaleString()}
                          </div>
                        </div>

                        {/* Carryout % */}
                        <div style={{ background: 'var(--bg-base)', borderRadius: 8, padding: '12px' }}>
                          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: "'Inter', sans-serif", fontWeight: 500, letterSpacing: '0.08em', marginBottom: 8 }}>
                            CARRYOUT %
                          </div>
                          <div style={{ fontSize: 22, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-primary)' }}>
                            {store.carryout_pct || 'N/A'}
                          </div>
                        </div>

                        {/* Target Food Cost */}
                        <div style={{ background: 'var(--bg-base)', borderRadius: 8, padding: '12px', gridColumn: 'span 2' }}>
                          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: "'Inter', sans-serif", fontWeight: 500, letterSpacing: '0.08em', marginBottom: 8 }}>
                            TARGET FOOD COST
                          </div>
                          <div style={{ fontSize: 22, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-primary)' }}>
                            ${store.target_food_cost.toLocaleString()}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {!liveLoading && liveData.length === 0 && !liveError && (
              <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 40, textAlign: 'center' }}>
                <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 15, color: 'var(--text-primary)', marginBottom: 8 }}>No data available</div>
                <div style={{ fontSize: 13, color: 'var(--text-tertiary)', fontFamily: "'Inter', sans-serif", marginBottom: 16 }}>
                  Click "Refresh Now" to fetch live data from the extranet
                </div>
                <button
                  onClick={() => void fetchLiveData()}
                  disabled={liveLoading}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 8,
                    border: 'none',
                    background: 'var(--brand)',
                    color: '#fff',
                    fontFamily: "'Inter', sans-serif",
                    fontSize: 13,
                    fontWeight: 600,
                    letterSpacing: '0.04em',
                    cursor: 'pointer',
                  }}
                >
                  Fetch Data
                </button>
              </div>
            )}
          </div>
        )}

        {/* Store Detail Modal */}
        {showStoreModal && selectedStore && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.85)',
              zIndex: 1000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 40,
            }}
            onClick={() => setShowStoreModal(false)}
          >
            <div
              style={{
                background: 'var(--bg-surface)',
                borderRadius: 16,
                padding: 32,
                maxWidth: 1200,
                width: '100%',
                maxHeight: '90vh',
                overflowY: 'auto',
                border: '1px solid var(--border-subtle)',
                position: 'relative',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <div>
                  <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: 24, color: 'var(--text-primary)' }}>
                    Store {selectedStore.store_number}
                  </div>
                  <div style={{ fontSize: 14, color: 'var(--text-tertiary)', marginTop: 4, fontFamily: "'Inter', sans-serif" }}>
                    {new Date(selectedStore.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </div>
                </div>
                <button
                  onClick={() => setShowStoreModal(false)}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    border: '1px solid var(--border-default)',
                    background: 'var(--bg-overlay)',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 18,
                    fontFamily: "'Inter', sans-serif",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--bg-elevated)'
                    e.currentTarget.style.color = 'var(--text-primary)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'var(--bg-overlay)'
                    e.currentTarget.style.color = 'var(--text-secondary)'
                  }}
                >
                  ×
                </button>
              </div>

              {/* Three Columns */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 24 }}>
                {/* Column 1 — Comp Indicators */}
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)', fontFamily: "'Inter', sans-serif", fontWeight: 600, letterSpacing: '0.1em', marginBottom: 16 }}>
                    COMP INDICATORS
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {[
                      { label: 'Comp %', value: selectedStore.comp_pct, isPercent: true, colorCode: true },
                      { label: 'LY Net Sales', value: `$${selectedStore.ly_net_sales?.toLocaleString() || '0'}` },
                      { label: 'TY Net Sales', value: `$${selectedStore.total_net_sales?.toLocaleString() || '0'}` },
                      { label: 'Online Comp %', value: selectedStore.online_comp_pct, isPercent: true },
                      { label: 'Online Net Sales', value: `$${selectedStore.online_net_sales?.toLocaleString() || '0'}` },
                      { label: 'LY Online Net Sales', value: `$${selectedStore.ly_online_net_sales?.toLocaleString() || '0'}` },
                    ].map((item) => {
                      let valueColor = 'var(--text-primary)'
                      if (item.colorCode && item.value) {
                        const isNegative = item.value.toString().startsWith('-')
                        valueColor = isNegative ? 'var(--danger-text)' : 'var(--success-text)'
                      }
                      return (
                        <div key={item.label} style={{ background: 'var(--bg-base)', borderRadius: 8, padding: '12px' }}>
                          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: "'Inter', sans-serif", fontWeight: 500, letterSpacing: '0.08em', marginBottom: 4 }}>
                            {item.label}
                          </div>
                          <div style={{ fontSize: 16, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", color: valueColor }}>
                            {item.value || 'N/A'}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Column 2 — Total Store Indicators */}
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)', fontFamily: "'Inter', sans-serif", fontWeight: 600, letterSpacing: '0.1em', marginBottom: 16 }}>
                    TOTAL STORE INDICATORS
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {[
                      { label: 'Net Sales +/- %', value: selectedStore.comp_pct, isPercent: true, colorCode: true },
                      { label: 'Total Net Sales', value: `$${selectedStore.total_net_sales?.toLocaleString() || '0'}` },
                      { label: 'PSA Sales', value: `$${selectedStore.psa_sales?.toLocaleString() || '0'}` },
                      { label: 'Total Orders', value: selectedStore.total_orders?.toLocaleString() || '0' },
                      { label: 'Ticket Average', value: `$${selectedStore.ticket_average?.toLocaleString() || '0'}` },
                      { label: 'Target Food Cost', value: `$${selectedStore.target_food_cost?.toLocaleString() || '0'}` },
                      { label: 'Target Food %', value: selectedStore.target_food_pct ? `${selectedStore.target_food_pct}%` : 'N/A' },
                    ].map((item) => {
                      let valueColor = 'var(--text-primary)'
                      if (item.colorCode && item.value) {
                        const isNegative = item.value.toString().startsWith('-')
                        valueColor = isNegative ? 'var(--danger-text)' : 'var(--success-text)'
                      }
                      return (
                        <div key={item.label} style={{ background: 'var(--bg-base)', borderRadius: 8, padding: '12px' }}>
                          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: "'Inter', sans-serif", fontWeight: 500, letterSpacing: '0.08em', marginBottom: 4 }}>
                            {item.label}
                          </div>
                          <div style={{ fontSize: 16, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", color: valueColor }}>
                            {item.value || 'N/A'}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Column 3 — Service Indicators */}
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)', fontFamily: "'Inter', sans-serif", fontWeight: 600, letterSpacing: '0.1em', marginBottom: 16 }}>
                    SERVICE INDICATORS
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {[
                      { label: 'Delivery Orders', value: selectedStore.delivery_orders?.toLocaleString() || '0' },
                      { label: 'Avg Make Time', value: selectedStore.avg_make_time || 'N/A', colorCode: true, isMakeTime: true },
                      { label: 'Avg Rack Time', value: selectedStore.avg_rack_time || 'N/A' },
                      { label: 'OTD Time', value: selectedStore.otd_time || 'N/A', colorCode: true, isTime: true },
                      { label: 'Carryout %', value: selectedStore.carryout_pct || 'N/A' },
                      { label: 'Labor Dollars', value: `$${selectedStore.labor_dollars?.toLocaleString() || '0'}` },
                      { label: 'Labor %', value: `${selectedStore.labor_pct?.toFixed(2) || '0'}%`, colorCode: true, isLabor: true },
                      { label: 'Orders to Deliver', value: selectedStore.orders_to_deliver?.toLocaleString() || '0' },
                      { label: 'Product to Make', value: selectedStore.product_to_make?.toLocaleString() || '0' },
                    ].map((item) => {
                      let valueColor = 'var(--text-primary)'
                      if (item.colorCode) {
                        if (item.isLabor) {
                          valueColor = selectedStore.labor_pct > 30 ? 'var(--danger-text)' : 'var(--success-text)'
                        } else if (item.isTime && selectedStore.otd_time) {
                          const parts = selectedStore.otd_time.split(':')
                          const otdMinutes = parts.length === 2 
                            ? (parseFloat(parts[0]) || 0) + ((parseFloat(parts[1]) || 0) / 60)
                            : null
                          valueColor = otdMinutes !== null ? (otdMinutes > 18 ? 'var(--danger-text)' : 'var(--success-text)') : 'var(--text-primary)'
                        } else if (item.isMakeTime && selectedStore.avg_make_time) {
                          const parts = selectedStore.avg_make_time.split(':')
                          const makeMinutes = parts.length === 2 
                            ? (parseFloat(parts[0]) || 0) + ((parseFloat(parts[1]) || 0) / 60)
                            : null
                          valueColor = makeMinutes !== null ? (makeMinutes < 4 ? 'var(--success-text)' : 'var(--danger-text)') : 'var(--text-primary)'
                        }
                      }
                      return (
                        <div key={item.label} style={{ background: 'var(--bg-base)', borderRadius: 8, padding: '12px' }}>
                          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: "'Inter', sans-serif", fontWeight: 500, letterSpacing: '0.08em', marginBottom: 4 }}>
                            {item.label}
                          </div>
                          <div style={{ fontSize: 16, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", color: valueColor }}>
                            {item.value || 'N/A'}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* GUEST EXPERIENCE TAB - Temporarily Disabled */}
        {!loading && activeTab === 'guest-experience' && (
          <div className="fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <div>
                <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: 20, marginBottom: 8, color: 'var(--text-primary)' }}>Guest Experience</div>
                <div style={{ fontSize: 13, color: 'var(--text-tertiary)', fontFamily: "'Inter', sans-serif", fontWeight: 400 }}>
                  SMG Guest Experience scores and case management
                </div>
              </div>
            </div>

            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 60, textAlign: 'center' }}>
              <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 18, color: 'var(--text-primary)', marginBottom: 12 }}>
                Guest Experience data is temporarily unavailable
              </div>
              <div style={{ fontSize: 14, color: 'var(--text-secondary)', fontFamily: "'Inter', sans-serif", lineHeight: 1.6 }}>
                This feature has been temporarily disabled. Please check back later.
              </div>
            </div>
          </div>
        )}

        {/* YEAR VS YEAR TAB */}
        {!loading && activeTab === 'yoy' && (
          <div className="fade-in">
            {yoyComparisons.length === 0 ? (
              <div style={{ maxWidth: 800, margin: '0 auto' }}>
                <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: 20, marginBottom: 8, color: 'var(--text-primary)' }}>Year vs Year Comparison</div>
                <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 24, fontFamily: "'Inter', sans-serif", fontWeight: 400 }}>
                  Upload two reports for the same store — one from the current period and one from the same period last year — to generate a detailed year-over-year comparison.
                </div>
                <YearOverYearUploadPanel
                  onCompare={async (current, lastYear) => {
                    const comparison: YoYComparison = {
                      store_number: current.store_number,
                      current,
                      lastYear,
                    }
                    setYoyComparisons((prev) => {
                      // Replace if store already exists, otherwise add
                      const existing = prev.findIndex((c) => c.store_number === current.store_number)
                      if (existing >= 0) {
                        const updated = [...prev]
                        updated[existing] = comparison
                        return updated
                      }
                      return [...prev, comparison]
                    })
                    setSelectedYoYStore(current.store_number)
                  }}
                  disabled={uploading}
                />
              </div>
            ) : (
              <div>
                {/* Store Selector */}
                {yoyComparisons.length > 1 && (
                  <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '16px 20px', marginBottom: 24 }}>
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: "'Inter', sans-serif", fontWeight: 600, letterSpacing: '0.12em', marginBottom: 10 }}>SELECT STORE</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {yoyComparisons.map((comp, i) => {
                        const isSelected = selectedYoYStore === comp.store_number
                        const store = stores.find((s) => s.number === comp.store_number) || {
                          id: comp.store_number,
                          number: comp.store_number,
                          name: `Store ${comp.store_number}`,
                          location: 'Unknown',
                        }
                        const storeIdx = stores.findIndex((s) => s.number === comp.store_number)
                        const storeColor = STORE_COLORS[storeIdx >= 0 ? storeIdx % STORE_COLORS.length : i % STORE_COLORS.length]
                        return (
                          <div
                            key={comp.store_number}
                            onClick={() => setSelectedYoYStore(comp.store_number)}
                            style={{
                              padding: '6px 12px',
                              borderRadius: 6,
                              fontSize: 12,
                              fontWeight: 600,
                              border: `1px solid ${isSelected ? storeColor : 'var(--border-default)'}`,
                              background: isSelected ? `${storeColor}15` : 'var(--bg-overlay)',
                              color: isSelected ? storeColor : 'var(--text-tertiary)',
                              fontFamily: "'Inter', sans-serif",
                              cursor: 'pointer',
                            }}
                          >
                            {comp.store_number}
                          </div>
                        )
                      })}
                      <div
                        onClick={() => {
                          setYoyComparisons([])
                          setSelectedYoYStore(null)
                        }}
                        style={{
                          padding: '6px 12px',
                          borderRadius: 6,
                          fontSize: 12,
                          fontWeight: 600,
                          border: '1px solid var(--border-default)',
                          background: 'var(--bg-overlay)',
                          color: 'var(--text-tertiary)',
                          fontFamily: "'Inter', sans-serif",
                          cursor: 'pointer',
                        }}
                      >
                        + New Comparison
                      </div>
                    </div>
                  </div>
                )}

                {/* Year Over Year Panel */}
                {(() => {
                  const displayStore = selectedYoYStore || (yoyComparisons.length === 1 ? yoyComparisons[0].store_number : null)
                  if (!displayStore) return null

                  return (
                    <>
                      {yoyComparisons
                        .filter((c) => c.store_number === displayStore)
                        .map((comp) => {
                          const store = stores.find((s) => s.number === comp.store_number) || {
                            id: comp.store_number,
                            number: comp.store_number,
                            name: `Store ${comp.store_number}`,
                            location: 'Unknown',
                          }
                          const storeIdx = stores.findIndex((s) => s.number === comp.store_number)
                          const storeColor = STORE_COLORS[storeIdx >= 0 ? storeIdx % STORE_COLORS.length : 0]

                          return (
                            <YearOverYearPanel
                              key={comp.store_number}
                              current={comp.current}
                              lastYear={comp.lastYear}
                              store={store}
                              storeColor={storeColor}
                            />
                          )
                        })}
                    </>
                  )
                })()}
              </div>
            )}
          </div>
        )}

        {/* DASHBOARD TAB */}
        {!loading && activeTab === 'dashboard' && (
          <div className="fade-in">
            {/* Controls Row */}
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '16px 20px', marginBottom: 24 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'flex-start' }}>
                {/* Store selector */}
                <div style={{ flex: 1, minWidth: 300 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: "'Inter', sans-serif", fontWeight: 600, letterSpacing: '0.12em', marginBottom: 10, display: 'flex', justifyContent: 'space-between' }}>
                    <span>SELECT STORES</span>
                    <span>
                      <span style={{ color: 'var(--brand)', cursor: 'pointer', fontWeight: 500 }} onClick={selectAll}>
                        All
                      </span>
                      {' · '}
                      <span style={{ color: 'var(--text-tertiary)', cursor: 'pointer', fontWeight: 500 }} onClick={selectNone}>
                        None
                      </span>
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {stores.map((s, i) => {
                      const isSelected = selectedStoresSafe.includes(s.number)
                      const storeColor = STORE_COLORS[i % STORE_COLORS.length]
                      return (
                        <div
                          key={s.number}
                          className={`store-chip ${isSelected ? 'active' : ''}`}
                          onClick={() => toggleStore(s.number)}
                          style={{
                            padding: '6px 12px',
                            borderRadius: 6,
                            fontSize: 12,
                            fontWeight: 600,
                            border: `1px solid ${isSelected ? storeColor : 'var(--border-default)'}`,
                            background: isSelected ? `${storeColor}15` : 'var(--bg-overlay)',
                            color: isSelected ? storeColor : 'var(--text-tertiary)',
                            fontFamily: "'Inter', sans-serif",
                            cursor: 'pointer',
                          }}
                        >
                          {s.number}
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* View mode */}
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: "'Inter', sans-serif", fontWeight: 600, letterSpacing: '0.12em', marginBottom: 10 }}>VIEW MODE</div>
                  <div style={{ display: 'flex', gap: 4, background: 'var(--bg-overlay)', borderRadius: 8, padding: 4, border: '1px solid var(--border-subtle)' }}>
                    {([
                      ['weekly', 'Daily'],
                      ['monthly', 'Monthly'],
                    ] as const).map(([key, label]) => (
                      <button
                        key={key}
                        onClick={() => setViewMode(key)}
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
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Metric filter */}
                <div style={{ flex: 2, minWidth: 400 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: "'Inter', sans-serif", fontWeight: 600, letterSpacing: '0.12em', marginBottom: 10 }}>
                    METRIC FOCUS{' '}
                    <span style={{ color: 'var(--text-tertiary)', fontWeight: 400, letterSpacing: 'normal' }}>(select one to chart, or leave blank for full report)</span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                    {METRICS.map((m) => (
                      <div
                        key={m.key}
                        className={`metric-chip ${activeMetric === m.key ? 'active' : ''}`}
                        onClick={() => setActiveMetric((prev) => (prev === m.key ? null : m.key))}
                        style={{
                          padding: '6px 12px',
                          borderRadius: 6,
                          fontSize: 13,
                          fontWeight: 500,
                          border: `1px solid ${activeMetric === m.key ? 'var(--info)' : 'var(--border-default)'}`,
                          background: activeMetric === m.key ? 'var(--info-subtle)' : 'transparent',
                          color: activeMetric === m.key ? 'var(--info-text)' : 'var(--text-tertiary)',
                          fontFamily: "'Inter', sans-serif",
                          cursor: 'pointer',
                        }}
                        onMouseEnter={(e) => {
                          if (activeMetric !== m.key) {
                            e.currentTarget.style.borderColor = 'var(--border-strong)'
                            e.currentTarget.style.color = 'var(--text-secondary)'
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (activeMetric !== m.key) {
                            e.currentTarget.style.borderColor = 'var(--border-default)'
                            e.currentTarget.style.color = 'var(--text-tertiary)'
                          }
                        }}
                      >
                        {m.label}
                      </div>
                    ))}
                    <div
                      className={`metric-chip ${compareMode ? 'active' : ''}`}
                      onClick={() => setCompareMode((prev) => !prev)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 6,
                        fontSize: 13,
                        fontWeight: 500,
                        border: `1px solid ${compareMode ? 'var(--info)' : 'var(--border-default)'}`,
                        background: compareMode ? 'var(--info-subtle)' : 'transparent',
                        color: compareMode ? 'var(--info-text)' : 'var(--text-tertiary)',
                        fontFamily: "'Inter', sans-serif",
                        cursor: 'pointer',
                        marginLeft: 'auto',
                      }}
                        onMouseEnter={(e) => {
                          if (!compareMode) {
                            e.currentTarget.style.borderColor = 'var(--border-strong)'
                            e.currentTarget.style.color = 'var(--text-secondary)'
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!compareMode) {
                            e.currentTarget.style.borderColor = 'var(--border-default)'
                            e.currentTarget.style.color = 'var(--text-tertiary)'
                          }
                        }}
                      >
                        Compare Mode
                      </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Compare Mode */}
            {compareMode ? (
              <ComparisonPanel
                selectedStores={selectedStoresSafe}
                activeMetric={activeMetric}
                reports={reports}
                stores={stores}
                metrics={METRICS}
                storeColors={STORE_COLORS}
                targets={TARGETS}
                onMetricSelect={(key) => setActiveMetric(key as MetricKey)}
              />
            ) : (
              <>
                {/* Store KPI Cards */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${Math.min(selectedStoresSafe.length, 3) || 1}, 1fr)`,
                    gap: 16,
                    marginBottom: 24,
                  }}
                >
                  {selectedStoresSafe.map((num) => {
                    const store = stores.find((s) => s.number === num)
                    if (!store) return null
                    return <KpiCard key={num} store={store} reports={reports[num] || []} />
                  })}
                </div>

                {/* Single Store Date Compare */}
                {selectedStoresSafe.length === 1 && (
                  <SingleStoreDateCompare
                    store={stores.find((s) => s.number === selectedStoresSafe[0])!}
                    reports={reports[selectedStoresSafe[0]] || []}
                    metrics={METRICS}
                    storeColor={STORE_COLORS[stores.findIndex((s) => s.number === selectedStoresSafe[0]) % STORE_COLORS.length]}
                    viewMode={viewMode}
                  />
                )}

                {/* Chart or Full Report */}
                {activeMetric ? (
                  <ChartSection selectedStores={selectedStoresSafe} activeMetric={activeMetric} reports={reports} viewMode={viewMode} />
                ) : (
                  <FullReportTable selectedStores={selectedStoresSafe} stores={stores} reports={reports} />
                )}
              </>
            )}

            {/* Targets row */}
            <div style={{ marginTop: 24, display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              {METRICS.map((m) => (
                <div key={m.key} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 12 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: "'Inter', sans-serif", fontWeight: 500, letterSpacing: '0.12em', marginBottom: 8 }}>{m.label.toUpperCase()} TARGET</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>
                      {m.key === 'net_sales'
                        ? `> $${TARGETS.net_sales.toLocaleString()}`
                        : m.key === 'cash_short'
                          ? `< $${TARGETS.cash_short}`
                          : `< ${TARGETS[m.key]}%`}
                    </div>
                    <Badge value={m.key === 'net_sales' ? TARGETS.net_sales : m.key === 'cash_short' ? TARGETS.cash_short - 0.01 : TARGETS[m.key] - 0.01} metricKey={m.key} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

