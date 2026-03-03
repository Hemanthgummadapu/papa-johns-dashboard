'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
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
} from 'recharts'
import type { DailyReportWithStore } from '@/lib/db'
import ComparisonPanel from '@/components/ComparisonPanel'
import SingleStoreDateCompare from '@/components/SingleStoreDateCompare'
import YearOverYearUploadPanel from '@/components/YearOverYearUploadPanel'
import YearOverYearPanel from '@/components/YearOverYearPanel'
import SMGDashboardEmbed from '@/components/SMGDashboardEmbed'


function roundPct(v: number): number {
  return Math.round(v * 10) / 10
}

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
  food_cost_usd?: number
  comp_pct?: number
  avg_ticket?: number
  avg_discount?: number
}

type ReportsByStore = Record<string, ReportPoint[]>

type CubeStoreRow = {
  storeNumber: string
  netSales: number | null
  grossSales: number
  lyNetSales: number | null
  laborPct: number | null
  foodCostUsd: number | null
  flmPct: number | null
  dddSales: number | null
  aggregatorSales: number | null
  lyAggregatorSales?: number | null
  deliveryOrders: number | null
  onlineOrders: number | null
  carryoutOrders: number | null
  aggregatorOrders: number | null
  totalOrders: number | null
  avgTicket: number
  avgDiscount: number
  appSales?: number | null
  webSales?: number | null
  onlineSales?: number | null
  phoneSales?: number | null
  carryoutPct?: number
  deliveryPct?: number
  onlinePct?: number
}

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
  doordash_sales: 5000, // dollar target
  ubereats_sales: 4000, // dollar target
}

const METRICS: Array<{
  key: MetricKey
  label: string
  fmt: (v: number) => string
  color: string
  unit: '$' | '%'
  tooltip?: string
  subtitle?: string
}> = [
  { key: 'net_sales', label: 'Net Sales', fmt: (v) => `$${v?.toLocaleString()}`, color: '#3b82f6', unit: '$' },
  { key: 'labor_pct', label: 'Labor %', fmt: (v) => `${v}%`, color: '#f59e0b', unit: '%' },
  { key: 'food_cost_pct', label: 'Food Cost %', fmt: (v) => `${v}%`, color: '#8b5cf6', unit: '%' },
  { key: 'flm_pct', label: 'FLM %', fmt: (v) => `${v}%`, color: '#ec4899', unit: '%' },
  // { key: 'cash_short', label: 'Cash Short/Over', fmt: (v) => (v >= 0 ? `+$${v}` : `-$${Math.abs(v)}`), color: '#14b8a6', unit: '$' }, // commented out
  { key: 'doordash_sales', label: 'DoorDash (DDD)', fmt: (v) => `$${v?.toLocaleString()}`, color: '#f97316', unit: '$', subtitle: 'Incl. DDD Cash orders', tooltip: 'DoorDash marketplace + DDDCash orders from cube [DDD Net Sales USD]' },
  { key: 'ubereats_sales', label: 'Aggregator (DD+UE+GH)', fmt: (v) => `$${v?.toLocaleString()}`, color: '#06b6d4', unit: '$', subtitle: 'DD + UE + GrubHub', tooltip: 'Combined DoorDash + UberEats + GrubHub from cube [TY Aggregator Delivery Net Sales USD]. May differ slightly from POS due to timing.' },
]

const STORE_COLORS = ['var(--store-1)', 'var(--store-2)', 'var(--store-3)', 'var(--store-4)', 'var(--store-5)', 'var(--store-6)']

const DEFAULT_STORES: StoreUI[] = [
  { id: '1', number: '2081', name: 'Store 2081', location: 'Westhills' },
  { id: '2', number: '2021', name: 'Store 2021', location: 'Tapo' },
  { id: '3', number: '2259', name: 'Store 2259', location: 'Northridge' },
  { id: '4', number: '2292', name: 'Store 2292', location: 'Canoga' },
  { id: '5', number: '2481', name: 'Store 2481', location: 'Madera' },
  { id: '6', number: '3011', name: 'Store 3011', location: 'Chattsworth' },
]

// ── Helpers ──────────────────────────────────────────────────────────────────
function safeNum(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}

function isGood(key: MetricKey, value: number) {
  if (key === 'net_sales') return value >= (TARGETS.net_sales ?? 0)
  if (key === 'cash_short') return Math.abs(value) < (TARGETS.cash_short ?? 0)
  if (key === 'doordash_sales' || key === 'ubereats_sales') return value >= (TARGETS[key] ?? 0)
  return value < (TARGETS[key] ?? Infinity)
}

function formatDateShort(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatCubeDateLabel(dateStr: string, period: CubePeriod): string {
  if (period === 'yearly') return dateStr
  if (period === 'monthly' && /^\d{4}-\d{2}$/.test(dateStr)) {
    const [y, m] = dateStr.split('-')
    const d = new Date(parseInt(y), parseInt(m) - 1)
    return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
  }
  if (period === 'weekly' && /^\d{4}-W\d{1,2}$/.test(dateStr)) {
    const [, w] = dateStr.split('-W')
    const y = dateStr.slice(0, 4)
    return `Week ${parseInt(w)}, ${y}`
  }
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
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
  cubeStore,
  cubeDateLabel,
  showLyBanner,
}: {
  store: StoreUI
  reports: ReportPoint[]
  cubeStore?: CubeStoreRow | null
  cubeDateLabel?: string
  showLyBanner?: string
}) {
  const [isFlipped, setIsFlipped] = useState(false)
  const latest = reports?.[reports.length - 1]
  const idx = Number.isFinite(Number(store.number))
    ? Number(store.number) % STORE_COLORS.length
    : 0
  const storeColor = STORE_COLORS[idx]
  const canFlip = Boolean(cubeStore)

  const cardBaseStyle: React.CSSProperties = {
    background: 'var(--bg-surface)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 12,
    padding: 20,
    paddingBottom: 28,
    position: 'relative',
    overflow: 'visible',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    boxSizing: 'border-box',
  }

  const topBarStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    background: storeColor,
  }

  // Back face content (detail metrics) — no transform here; the card-back wrapper has rotateY(180deg)
  const backContent = cubeStore && (
    <div style={cardBaseStyle} onClick={() => canFlip && setIsFlipped(false)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { setIsFlipped(false) } }} aria-label="Flip card back">
      <div style={topBarStyle} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 15, color: 'var(--text-primary)' }}>{store.name}</div>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2, fontFamily: "'Inter', sans-serif" }}>{cubeDateLabel || 'Cube data'}</div>
        </div>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setIsFlipped(false) }}
          style={{
            fontSize: 12,
            fontFamily: "'Inter', sans-serif",
            fontWeight: 500,
            color: 'var(--text-secondary)',
            background: 'var(--bg-overlay)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 6,
            padding: '6px 10px',
            cursor: 'pointer',
          }}
        >
          ← Back
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, flex: 1 }}>
        <div style={{ background: 'var(--bg-base)', borderRadius: 8, padding: '12px' }}>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: "'Inter', sans-serif", fontWeight: 500, letterSpacing: '0.08em', marginBottom: 4 }}>AVG TICKET</div>
          <div style={{ fontSize: 16, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-primary)' }}>
            ${(cubeStore.avgTicket ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
        <div style={{ background: 'var(--bg-base)', borderRadius: 8, padding: '12px' }}>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: "'Inter', sans-serif", fontWeight: 500, letterSpacing: '0.08em', marginBottom: 4 }}>ONLINE SALES</div>
          <div style={{ fontSize: 16, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-primary)' }}>
            ${(cubeStore.onlineSales ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
        <div style={{ background: 'var(--bg-base)', borderRadius: 8, padding: '12px' }}>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: "'Inter', sans-serif", fontWeight: 500, letterSpacing: '0.08em', marginBottom: 4 }}>CARRYOUT</div>
          <div style={{ fontSize: 16, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-primary)' }}>
            {(cubeStore.carryoutOrders ?? 0).toLocaleString()} orders ({(cubeStore.carryoutPct ?? 0)}%)
          </div>
        </div>
        <div style={{ background: 'var(--bg-base)', borderRadius: 8, padding: '12px' }}>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: "'Inter', sans-serif", fontWeight: 500, letterSpacing: '0.08em', marginBottom: 4 }}>DELIVERY</div>
          <div style={{ fontSize: 16, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-primary)' }}>
            {(cubeStore.deliveryOrders ?? 0).toLocaleString()} orders ({(cubeStore.deliveryPct ?? 0)}%)
          </div>
        </div>
        <div style={{ background: 'var(--bg-base)', borderRadius: 8, padding: '12px' }}>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: "'Inter', sans-serif", fontWeight: 500, letterSpacing: '0.08em', marginBottom: 4 }}>APP SALES</div>
          <div style={{ fontSize: 16, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-primary)' }}>
            ${(cubeStore.appSales ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
        <div style={{ background: 'var(--bg-base)', borderRadius: 8, padding: '12px' }}>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: "'Inter', sans-serif", fontWeight: 500, letterSpacing: '0.08em', marginBottom: 4 }}>WEB SALES</div>
          <div style={{ fontSize: 16, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-primary)' }}>
            ${(cubeStore.webSales ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
        <div style={{ background: 'var(--bg-base)', borderRadius: 8, padding: '12px' }}>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: "'Inter', sans-serif", fontWeight: 500, letterSpacing: '0.08em', marginBottom: 4 }}>AVG TICKET</div>
          <div style={{ fontSize: 16, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-primary)' }}>
            ${(cubeStore.avgTicket ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
        <div style={{ background: 'var(--bg-base)', borderRadius: 8, padding: '12px' }}>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: "'Inter', sans-serif", fontWeight: 500, letterSpacing: '0.08em', marginBottom: 4 }}>AVG DISCOUNT</div>
          <div style={{ fontSize: 16, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-primary)' }}>
            ${(cubeStore.avgDiscount ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
      </div>
    </div>
  )

  if (!latest) return null

  const frontContent = (
    <div style={cardBaseStyle}>
      <div style={topBarStyle} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 15, color: 'var(--text-primary)' }}>
            {store.name}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2, fontFamily: "'Inter', sans-serif", fontWeight: 400 }}>
            {store.location}
            {!showLyBanner && (latest as any).comp_pct != null && (
              <span style={{ marginLeft: 8, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: (latest as any).comp_pct >= 0 ? 'var(--success-text)' : 'var(--danger-text)' }}>
                Comp: {(latest as any).comp_pct >= 0 ? '+' : ''}{(latest as any).comp_pct}%
              </span>
            )}
            {showLyBanner && (
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4, fontFamily: "'Inter', sans-serif", fontWeight: 500 }}>
                Showing LY: {showLyBanner}
              </div>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {canFlip && (
            <button
              type="button"
              onClick={() => setIsFlipped(true)}
              style={{
                fontSize: 11,
                fontFamily: "'Inter', sans-serif",
                fontWeight: 500,
                color: 'var(--text-secondary)',
                background: 'var(--bg-overlay)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 6,
                padding: '6px 10px',
                cursor: 'pointer',
              }}
            >
              View details
            </button>
          )}
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
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {METRICS.map((m) => {
          const isFoodCost = m.key === 'food_cost_pct'
          const val = isFoodCost && (latest as any).food_cost_usd != null
            ? safeNum((latest as any).food_cost_usd)
            : safeNum((latest as any)[m.key])
          const displayVal = isFoodCost && (latest as any).food_cost_usd != null
            ? `$${val?.toLocaleString()}`
            : m.fmt(val)
          const good = isGood(m.key, isFoodCost ? safeNum((latest as any).food_cost_pct) : val)
          const label = isFoodCost && (latest as any).food_cost_usd != null ? 'FOOD COST' : m.label.toUpperCase()
          return (
            <div key={m.key} style={{ background: 'var(--bg-base)', borderRadius: 8, padding: '12px' }}>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: "'Inter', sans-serif", fontWeight: 500, letterSpacing: '0.08em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                <span>{label}</span>
                {m.subtitle && (
                  <span style={{ fontSize: 10, letterSpacing: '0.02em', opacity: 0.9 }}>{m.subtitle}</span>
                )}
                {m.tooltip && (
                  <span style={{ cursor: 'help', opacity: 0.85 }} title={m.tooltip} aria-label="Info">ℹ</span>
                )}
              </div>
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 600,
                  fontFamily: "'JetBrains Mono', monospace",
                  color: good ? 'var(--success-text)' : 'var(--danger-text)',
                }}
              >
                {displayVal}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )

  if (!canFlip) {
    return <div style={{ minHeight: 0 }}>{frontContent}</div>
  }

  return (
    <div style={{ perspective: 1000, minHeight: 420 }}>
      <div
        style={{
          position: 'relative',
          height: '100%',
          minHeight: 420,
          transformStyle: 'preserve-3d',
          transition: 'transform 0.4s ease',
          transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
          }}
        >
          {frontContent}
        </div>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
            pointerEvents: isFlipped ? 'auto' : 'none',
          }}
        >
          {backContent}
        </div>
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
              ? `$${TARGETS[metric.key]?.toLocaleString() ?? '0'}`
              : metric.key === 'cash_short'
                ? `< $${TARGETS[metric.key] ?? '0'}`
                : `< ${TARGETS[metric.key] ?? '0'}${metric.unit}`}
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
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  {m.label.toUpperCase()}
                  {m.tooltip && <span style={{ cursor: 'help', opacity: 0.85 }} title={m.tooltip} aria-label="Info">ℹ</span>}
                </span>
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
      return { data: [], isRealData: false }
    }
    const data = await res.json()
    if (!Array.isArray(data)) {
      return { data: [], isRealData: false }
    }
    return { data, isRealData: data.length > 0 }
  } catch (_error) {
    return { data: [], isRealData: false }
  }
}

function getYesterdayDate(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return d.toISOString().split('T')[0]
}

// TODO: Papa Johns fiscal week may start Sunday; ISO week is Monday/Thursday-based.
// Current implementation returns ISO week number; cube uses [Fiscal Week].
// Validate with Brad: does PJ fiscal week 01 align with ISO W01? If offset exists, apply fiscalWeek = isoWeek + offset.
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
  const [y, m] = current.split('-').map(Number)
  const results: string[] = []
  let year = y
  let month = m
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

type CubePeriod = 'daily' | 'weekly' | 'monthly' | 'yearly'

/** Same period last year for LY cube query */
function getLyDate(dateStr: string, period: CubePeriod): string {
  if (period === 'yearly') {
    const y = parseInt(dateStr.slice(0, 4), 10)
    return String(Number.isFinite(y) ? y - 1 : new Date().getFullYear() - 1)
  }
  if (period === 'monthly' && /^\d{4}-\d{2}$/.test(dateStr)) {
    const [y, m] = dateStr.split('-').map(Number)
    return `${y - 1}-${String(m).padStart(2, '0')}`
  }
  if (period === 'weekly' && /^\d{4}-W\d{1,2}$/i.test(dateStr)) {
    const [y, rest] = dateStr.split('-W')
    const w = rest?.replace(/^0+/, '') || '1'
    return `${String(parseInt(y, 10) - 1)}-W${String(w).padStart(2, '0')}`
  }
  if (period === 'daily' && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const d = new Date(dateStr)
    d.setFullYear(d.getFullYear() - 1)
    return d.toISOString().slice(0, 10)
  }
  return dateStr
}

function formatDateForApi(dateStr: string, period: CubePeriod): string {
  if (period === 'yearly') return /^\d{4}$/.test(dateStr) ? dateStr : String(new Date().getFullYear())
  if (period === 'monthly') return /^\d{4}-\d{2}$/.test(dateStr) ? dateStr : new Date().toISOString().slice(0, 7)
  if (period === 'weekly') {
    const m = dateStr.match(/^(\d{4})-W(\d{1,2})$/)
    if (m) return `${m[1]}-W${m[2].padStart(2, '0')}`
    return getDefaultWeek()
  }
  return /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? dateStr : getYesterdayDate()
}

// LY data: using cube [LY Net Sales USD] built-in measure for main dashboard.
// ComparisonPanel and SingleStoreDateCompare use separate LY period query instead.
// TODO: Standardize to two-query approach for consistency.
async function fetchCubeData(date: string, period: CubePeriod): Promise<{ data: DailyReportWithStore[]; isRealData: boolean; date: string; cubeOffline?: boolean; cubeStores?: CubeStoreRow[] }> {
  try {
    const dateParam = formatDateForApi(date, period)
    const res = await fetch(`/api/cube?date=${encodeURIComponent(dateParam)}&period=${encodeURIComponent(period)}`, { cache: 'no-store' })
    const json = await res.json()
    const cubeOffline = res.status === 503 || json.status === 'offline'
    if (!res.ok || !json.success || !Array.isArray(json.stores)) {
      return { data: [], isRealData: false, date, cubeOffline: cubeOffline || undefined }
    }
    const reports: DailyReportWithStore[] = json.stores
      .filter((s: { storeNumber: string | null }) => s.storeNumber)
      .map((s: CubeStoreRow) => {
        const storeNumber = String(s.storeNumber)
        const netSales = s.netSales ?? 0
        const lyNetSales = s.lyNetSales ?? 0
        const foodCostPct = netSales && s.foodCostUsd != null ? roundPct((s.foodCostUsd / netSales) * 100) : 0
        const compPct = lyNetSales ? ((netSales - lyNetSales) / lyNetSales * 100) : undefined
        return {
          id: `cube-${storeNumber}-${date}`,
          store_id: storeNumber,
          report_date: date,
          net_sales: netSales,
          labor_pct: s.laborPct ?? 0,
          food_cost_pct: foodCostPct,
          flm_pct: s.flmPct ?? 0,
          cash_short: 0,
          doordash_sales: s.dddSales ?? 0,
          ubereats_sales: s.aggregatorSales ?? 0,
          food_cost_usd: s.foodCostUsd ?? undefined,
          comp_pct: compPct != null ? Number(compPct.toFixed(1)) : undefined,
          raw_pdf_url: null,
          created_at: new Date().toISOString(),
          stores: {
            id: storeNumber,
            store_number: Number(storeNumber),
            name: `Store ${storeNumber}`,
            location: '',
            created_at: new Date().toISOString(),
          },
        } as DailyReportWithStore
      })
    return { data: reports, isRealData: true, date, cubeStores: json.stores }
  } catch (_error) {
    return { data: [], isRealData: false, date, cubeOffline: true, cubeStores: undefined }
  }
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const router = useRouter()
  const [raw, setRaw] = useState<DailyReportWithStore[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isRealData, setIsRealData] = useState(false)
  const [dataSource, setDataSource] = useState<'demo' | 'cube'>('cube')
  const [cubePeriod, setCubePeriod] = useState<CubePeriod>('daily')
  const [cubeDate, setCubeDate] = useState<string>(() => getYesterdayDate())
  const [activeCubeDate, setActiveCubeDate] = useState<string | null>(null)
  const [cubeLoading, setCubeLoading] = useState(false)
  const [cubeOffline, setCubeOffline] = useState(false)
  const [cubeData, setCubeData] = useState<CubeStoreRow[] | null>(null)
  const [cubeDataLY, setCubeDataLY] = useState<CubeStoreRow[] | null>(null)

  const [stores, setStores] = useState<StoreUI[]>([])
  const [reports, setReports] = useState<ReportsByStore>({})
  const [selectedStores, setSelectedStores] = useState<string[]>([])

  const [activeMetric, setActiveMetric] = useState<MetricKey | null>(null) // null = full report
  const [viewMode, setViewMode] = useState<'weekly' | 'monthly'>('weekly') // weekly | monthly
  const [activeTab, setActiveTab] = useState<'dashboard' | 'trends' | 'upload' | 'yoy' | 'automation' | 'live' | 'guest-experience'>('dashboard') // dashboard | trends | upload | yoy | automation | live | guest-experience
  const [compareMode, setCompareMode] = useState(false) // compare mode toggle
  const [trendsPeriod, setTrendsPeriod] = useState<'3M' | '6M' | '1Y' | '2Y' | '3Y'>('6M')
  const [trendsMetricKey, setTrendsMetricKey] = useState<MetricKey>('net_sales')
  const [trendsStoresSelected, setTrendsStoresSelected] = useState<string[]>([])
  const [trendsLoading, setTrendsLoading] = useState(false)
  const [trendsChartData, setTrendsChartData] = useState<Array<Record<string, number | string>>>([])
  const [trendsTableRows, setTrendsTableRows] = useState<Array<{ storeNum: string; location: string; start: number; latest: number; changePct: number }>>([])
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
    comp_pct: number | string | null
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
  const [liveStalenessTick, setLiveStalenessTick] = useState(0)
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
      setActiveCubeDate(null)
      setCubeData(null)
    } catch (e: any) {
      setLoadError(e?.message || 'Failed to load data')
      setRaw([])
        setIsRealData(false)
    } finally {
      setLoading(false)
    }
  }

  const loadCubeData = async (overrideDate?: string, overridePeriod?: CubePeriod) => {
    setCubeLoading(true)
    setLoadError(null)
    setCubeOffline(false)
    try {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      const defaultDate = yesterday.toISOString().split('T')[0]
      const dateToUse = overrideDate ?? (cubeDate || defaultDate)
      const periodToUse = overridePeriod ?? cubePeriod
      const [tyResult, lyResult] = await Promise.all([
        fetchCubeData(dateToUse, periodToUse),
        fetchCubeData(getLyDate(dateToUse, periodToUse), periodToUse),
      ])
      const { data: rows, isRealData: real, date, cubeStores, cubeOffline } = tyResult
      setRaw(rows)
      setIsRealData(real)
      setActiveCubeDate(date)
      setDataSource('cube')
      setCubeData(cubeStores ?? null)
      setCubeDataLY(lyResult.cubeStores ?? null)
      setCubeOffline(cubeOffline ?? false)
    } catch (e: any) {
      setLoadError(e?.message || 'Failed to load cube data')
    } finally {
      setCubeLoading(false)
      setLoading(false)
    }
  }

  useEffect(() => {
    if (dataSource === 'demo') {
    void reload()
    }
    setLastUpdated(new Date().toLocaleString())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataSource])

  // Auto-trigger Load Cube Data on mount (yesterday, period=daily)
  useEffect(() => {
    if (activeTab === 'dashboard' && dataSource === 'cube') {
      void loadCubeData()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Calculate countdown based on lastScraped timestamp
  const calculateCountdown = (lastScraped: string | null): number => {
    if (!lastScraped) return 0
    
    const lastScrapedTime = new Date(lastScraped).getTime()
    const nextScrapeTime = lastScrapedTime + (15 * 60 * 1000) // 15 minutes in milliseconds
    const now = Date.now()
    const timeRemaining = Math.max(0, Math.floor((nextScrapeTime - now) / 1000))
    
    return timeRemaining
  }

  // Fetch live data from Supabase (fast, instant)
  const fetchLiveData = async () => {
    // Only show loading spinner on first load (when no data exists)
    const isFirstLoad = liveData.length === 0
    if (isFirstLoad) {
      setLiveLoading(true)
    }
    setLiveError(null)
    
    try {
      const res = await fetch('/api/live-data', { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.error || 'Failed to fetch live data')
      }
      if (json.success && json.data) {
        setLiveData(json.data)
        if (json.lastScraped) {
          const newLastScraped = new Date(json.lastScraped)
          // Only update "Last updated" if timestamp actually changed (newer data)
          if (!liveLastUpdated || newLastScraped.getTime() > liveLastUpdated.getTime()) {
            setLiveLastUpdated(newLastScraped)
          }
          // Calculate countdown based on actual scraped_at timestamp
          const countdown = calculateCountdown(json.lastScraped)
          setRefreshCountdown(countdown)
        } else {
          setRefreshCountdown(0)
        }
      } else {
        throw new Error('Invalid response format')
      }
    } catch (error: any) {
      setLiveError(error.message || 'Failed to fetch live data')
      console.error('Live data fetch error:', error)
    } finally {
      if (isFirstLoad) {
        setLiveLoading(false)
      }
    }
  }

  // Trigger live scrape and refresh data
  const triggerLiveScrape = async () => {
    setIsRefreshing(true)
    setLiveError(null)
    try {
      // Call the scrape endpoint
      const res = await fetch('/api/scrape-live', {
        method: 'POST',
        cache: 'no-store'
      })
      const json = await res.json()
      
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to trigger scrape')
      }
      
      // After scrape completes, refresh data from DB
      await fetchLiveData()
      
      // Reset countdown to 15 minutes after successful scrape
      setRefreshCountdown(15 * 60)
    } catch (error: any) {
      setLiveError(error.message || 'Failed to scrape live data')
      console.error('Live scrape error:', error)
    } finally {
      setIsRefreshing(false)
    }
  }

  // SMG Guest Experience is temporarily disabled
  // const fetchSMGData = async () => {
  //   // Disabled
  // }

  // Auto-refresh countdown timer and periodic data refresh
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

    // Calculate initial countdown from lastScraped if available
    // This ensures countdown is set even if data was already loaded
    if (liveLastUpdated) {
      const countdown = calculateCountdown(liveLastUpdated.toISOString())
      setRefreshCountdown(countdown)
    } else if (liveData.length > 0) {
      // If we have data but no lastScraped, show 0 (Due now)
      setRefreshCountdown(0)
    }

    // Countdown timer - updates every second and triggers refresh when it crosses 0
    const countdownInterval = setInterval(() => {
      if (liveLastUpdated) {
      setRefreshCountdown((prev) => {
          const newCountdown = calculateCountdown(liveLastUpdated.toISOString())

          // When we transition from >0 to <=0, trigger an immediate refresh
          if (prev > 0 && newCountdown <= 0) {
            void fetchLiveData()
          }

          return newCountdown
        })
      } else {
        // If no lastScraped, show 0 (Due now)
        setRefreshCountdown(0)
      }
    }, 1000)

    // Set up a 15-minute polling interval to auto-refresh data (backup)
    const autoRefreshInterval = setInterval(() => {
      if (activeTab === 'live') {
        void fetchLiveData()
      }
    }, 15 * 60 * 1000) // 15 minutes

    return () => {
      clearInterval(countdownInterval)
      clearInterval(autoRefreshInterval)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, liveLastUpdated])

  // Staleness tick - updates every minute so "last scraped X mins ago" stays current
  useEffect(() => {
    if (activeTab !== 'live' || !liveLastUpdated) return
    const t = setInterval(() => setLiveStalenessTick((prev) => prev + 1), 60000)
    return () => clearInterval(t)
  }, [activeTab, liveLastUpdated])

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
    const storeMap = new Map<string, StoreUI>()
    const byStore: ReportsByStore = {}

    if (dataSource === 'cube' && cubeData && cubeData.length > 0) {
      // TODO: LY toggle - re-enable when LY data query is stable. For now always TY.
      const useLy = false // cubeViewMode === 'LY' && cubeDataLY && cubeDataLY.length > 0
      const source: CubeStoreRow[] = useLy ? (cubeDataLY ?? []) : (cubeData ?? [])
      const reportDate = useLy ? getLyDate(activeCubeDate || cubeDate || getYesterdayDate(), cubePeriod) : (activeCubeDate || cubeDate || getYesterdayDate())
      const label = formatDateShort(reportDate)
      for (const s of source) {
        const storeNumber = String(s.storeNumber)
        const store: StoreUI = {
          id: storeNumber,
          number: storeNumber,
          name: `Store ${storeNumber}`,
          location: DEFAULT_STORES.find((d) => d.number === storeNumber)?.location ?? '',
        }
        storeMap.set(store.number, store)
        const netSales = s.netSales ?? 0
        const lyNetSales = s.lyNetSales ?? 0
        const compPct = !useLy && lyNetSales ? ((netSales - lyNetSales) / lyNetSales * 100) : undefined
        const point: ReportPoint = {
          label,
          report_date: reportDate,
          net_sales: netSales,
          labor_pct: s.laborPct ?? 0,
          food_cost_pct: netSales && s.foodCostUsd != null ? roundPct((s.foodCostUsd / netSales) * 100) : 0,
          flm_pct: s.flmPct ?? 0,
          cash_short: 0,
          doordash_sales: s.dddSales ?? 0,
          ubereats_sales: s.aggregatorSales ?? 0,
          food_cost_usd: s.foodCostUsd ?? undefined,
          comp_pct: compPct != null ? Number(compPct.toFixed(1)) : undefined,
          avg_ticket: s.avgTicket ?? undefined,
          avg_discount: s.avgDiscount ?? undefined,
        }
        byStore[store.number] = [point]
      }
    } else {
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
          food_cost_usd: (r as any).food_cost_usd != null ? safeNum((r as any).food_cost_usd) : undefined,
          comp_pct: (r as any).comp_pct != null ? safeNum((r as any).comp_pct) : undefined,
      }

      if (!byStore[store.number]) byStore[store.number] = []
      byStore[store.number].push(point)
    }

    for (const k of Object.keys(byStore)) {
      byStore[k].sort((a, b) => (a.report_date > b.report_date ? 1 : -1))
      }
    }

    let storeList = Array.from(storeMap.values()).sort((a, b) => (a.number > b.number ? 1 : -1))
    if (storeList.length === 0) {
      storeList = [...DEFAULT_STORES]
    }

    if (viewMode === 'monthly' && dataSource !== 'cube') {
      const monthly: ReportsByStore = {}
      for (const k of Object.keys(byStore)) monthly[k] = aggregateMonthly(byStore[k])
      setReports(monthly)
    } else {
      setReports(byStore)
    }

    setStores(storeList)

    if (selectedStores.length === 0 && storeList.length > 0) {
      setSelectedStores(storeList.slice(0, Math.min(6, storeList.length)).map((s) => s.number))
    } else {
      const available = new Set(storeList.map((s) => s.number))
      setSelectedStores((prev) => prev.filter((n) => available.has(n)))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raw, viewMode, dataSource, cubeData, cubeDataLY, cubePeriod, activeCubeDate, cubeDate])

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

  // Trends tab: default to all stores selected on entry
  useEffect(() => {
    if (activeTab === 'trends' && trendsStoresSelected.length === 0 && stores.length > 0) {
      setTrendsStoresSelected(stores.map((s) => s.number))
    }
  }, [activeTab, stores, trendsStoresSelected.length])

  // Trends tab: fetch cube data when visible and when period/metric/stores change
  useEffect(() => {
    if (activeTab !== 'trends' || trendsStoresSelected.length === 0) {
      setTrendsChartData([])
      setTrendsTableRows([])
      return
    }

    type CubeStoreRow = {
      storeNumber: string
      netSales: number | null
      laborPct: number | null
      foodCostUsd: number | null
      flmPct: number | null
      dddSales: number | null
      aggregatorSales: number | null
    }

    const getMetricFromStore = (s: CubeStoreRow, key: MetricKey): number => {
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
        case 'cash_short':
          return 0
        default:
          return 0
      }
    }

    const periodConfig = {
      '3M': { count: 12, period: 'weekly' as const, label: '12 weeks' },
      '6M': { count: 6, period: 'monthly' as const, label: '6 months' },
      '1Y': { count: 12, period: 'monthly' as const, label: '12 months' },
      '2Y': { count: 24, period: 'monthly' as const, label: '24 months' },
      '3Y': { count: 36, period: 'monthly' as const, label: '36 months' },
    }
    const config = periodConfig[trendsPeriod]
    const dates =
      config.period === 'weekly'
        ? getPrevWeeks(getDefaultWeek(), config.count)
        : getPrevMonths(getDefaultMonth(), config.count)

    setTrendsLoading(true)
    Promise.all(
      dates.map((d) =>
        fetch(`/api/cube?date=${encodeURIComponent(d)}&period=${config.period}`, { cache: 'no-store' })
          .then((r) => r.json())
          .catch(() => ({ success: false, stores: [] }))
      )
    )
      .then((results) => {
        const chartData: Array<Record<string, number | string>> = dates.map((dateStr, i) => {
          const storesList: CubeStoreRow[] = results[i]?.stores ?? []
          const point: Record<string, number | string> = {
            date: config.period === 'weekly' ? dateStr : dateStr,
            label: config.period === 'weekly' ? `W${i + 1}` : dateStr,
          }
          trendsStoresSelected.forEach((storeNum) => {
            const s = storesList.find((x: CubeStoreRow) => String(x.storeNumber) === storeNum)
            point[storeNum] = s ? getMetricFromStore(s, trendsMetricKey) : 0
          })
          return point
        })

        setTrendsChartData(chartData)

        // Table: start (first period), latest (last period), change %
        const rows = trendsStoresSelected
          .map((storeNum) => {
            const store = stores.find((s) => s.number === storeNum)
            const firstVal = (chartData[0]?.[storeNum] as number) ?? 0
            const lastVal = (chartData[chartData.length - 1]?.[storeNum] as number) ?? 0
            const changePct = firstVal === 0 ? (lastVal > 0 ? 100 : 0) : ((lastVal - firstVal) / firstVal) * 100
            return {
              storeNum,
              location: store?.location ?? '',
              start: firstVal,
              latest: lastVal,
              changePct,
            }
          })
          .sort((a, b) => a.changePct - b.changePct) // worst first

        setTrendsTableRows(rows)
      })
      .finally(() => setTrendsLoading(false))
  }, [activeTab, trendsPeriod, trendsMetricKey, trendsStoresSelected, stores])

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
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                border: 'none',
                cursor: 'pointer',
                fontFamily: "'Inter', sans-serif",
                fontSize: 13,
                fontWeight: 600,
                letterSpacing: '0.04em',
                background: activeTab === 'dashboard' ? 'var(--brand)' : 'transparent',
                color: activeTab === 'dashboard' ? '#fff' : 'var(--text-tertiary)',
              }}
            >
              Dashboard
            </button>
            <Link
              href="/trends"
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                fontFamily: "'Inter', sans-serif",
                fontSize: 13,
                fontWeight: 600,
                letterSpacing: '0.04em',
                background: 'transparent',
                color: 'var(--text-tertiary)',
                textDecoration: 'none',
              }}
              className="tab-btn"
            >
              Trends
            </Link>
            <Link
              href="/analytics/profitability"
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                fontFamily: "'Inter', sans-serif",
                fontSize: 13,
                fontWeight: 600,
                letterSpacing: '0.04em',
                background: 'transparent',
                color: 'var(--text-tertiary)',
                textDecoration: 'none',
              }}
              className="tab-btn"
            >
              Analytics
            </Link>
            {[
              ['live', 'Live'],
              ['guest-experience', 'Guest Experience'],
            ].map(([key, label]) => (
              <button
                key={key}
                onClick={() => setActiveTab(key as 'live' | 'guest-experience')}
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
                  background: dataSource === 'cube' && activeCubeDate ? 'var(--success-subtle)' : isRealData ? 'var(--success-subtle)' : 'var(--warning-subtle)',
                  color: dataSource === 'cube' && activeCubeDate ? 'var(--success-text)' : isRealData ? 'var(--success-text)' : 'var(--warning-text)',
                }}
              >
                {dataSource === 'cube' && activeCubeDate
                  ? `CUBE DATA · ${formatCubeDateLabel(activeCubeDate, cubePeriod)}`
                  : dataSource === 'cube'
                    ? 'LIVE CUBE'
                    : isRealData
                      ? 'LIVE DATA'
                      : 'DEMO DATA'}
              </span>
            </div>
            {dataSource !== 'cube' && dateRange && <div style={{ fontFamily: "'Inter', sans-serif" }}>Range: {formatDateShort(dateRange.start)} – {formatDateShort(dateRange.end)}</div>}
          </div>
        </div>
      </div>

      {dataSource === 'cube' && cubeOffline && (
        <div
          style={{
            padding: '12px 16px',
            marginBottom: 24,
            borderRadius: 8,
            background: 'var(--warning-subtle)',
            border: '1px solid var(--warning)',
            color: 'var(--warning-text)',
            fontSize: 13,
            fontFamily: "'Inter', sans-serif",
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          ⚠️ Cube server unreachable — showing last known data or empty. Try again when the server is available.
        </div>
      )}

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
        {false && !loading && activeTab === 'upload' && (
          <div className="fade-in" style={{ maxWidth: 600, margin: '0 auto' }}>
            <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: 20, marginBottom: 8, color: 'var(--text-primary)' }}>Upload Reports</div>
            <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 24, fontFamily: "'Inter', sans-serif", fontWeight: 400 }}>
              Drop daily operating PDFs from any store. System auto-detects store number and date range.
            </div>
            <UploadPanel files={uploadFiles} setFiles={setUploadFiles} onUpload={handleUpload} disabled={uploading} />
          </div>
        )}

        {/* AUTOMATION LOG TAB - commented out */}
        {/* {!loading && activeTab === 'automation' && (
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
        )} */}

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
                {liveLastUpdated && (() => {
                  const minsAgo = Math.floor((Date.now() - liveLastUpdated.getTime()) / 60000)
                  const isStale = minsAgo > 20
                  return (
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        fontFamily: "'Inter', sans-serif",
                        color: isStale ? 'var(--danger-text)' : 'var(--success-text)',
                      }}
                    >
                      {isStale ? `⚠ STALE — last scraped ${minsAgo} mins ago` : '● LIVE'}
                    </div>
                  )
                })()}
                {liveLastUpdated && (
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)', fontFamily: "'Inter', sans-serif" }}>
                    Last updated: {liveLastUpdated.toLocaleTimeString()}
                  </div>
                )}
                {liveLastUpdated && (
                  <div style={{ fontSize: 12, color: refreshCountdown > 0 ? 'var(--text-secondary)' : 'var(--info-text)', fontFamily: "'JetBrains Mono', monospace" }}>
                    {refreshCountdown > 0 ? `Next refresh in ${formatCountdown(refreshCountdown)}` : 'Next refresh: Due now'}
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
                  disabled={liveLoading}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 8,
                    border: 'none',
                    background: liveLoading ? 'var(--bg-overlay)' : 'var(--brand)',
                    color: '#fff',
                    fontFamily: "'Inter', sans-serif",
                    fontSize: 13,
                    fontWeight: 600,
                    letterSpacing: '0.04em',
                    cursor: liveLoading ? 'not-allowed' : 'pointer',
                    opacity: liveLoading ? 0.7 : 1,
                  }}
                  onMouseEnter={(e) => {
                    if (!liveLoading) {
                      e.currentTarget.style.background = 'var(--brand-hover)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!liveLoading) {
                      e.currentTarget.style.background = 'var(--brand)'
                    }
                  }}
                >
                  {liveLoading ? 'Loading...' : 'Refresh Now'}
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
                              {store.comp_pct !== null && store.comp_pct !== undefined && (
                                (() => {
                                  const raw = store.comp_pct
                                  const numeric =
                                    typeof raw === 'number'
                                      ? raw
                                      : parseFloat(String(raw).replace('%', '').replace('+', '').trim())
                                  const isNegative = !Number.isNaN(numeric) && numeric < 0
                                  const display =
                                    typeof raw === 'number'
                                      ? `${numeric > 0 ? '+' : ''}${numeric.toFixed(2)}%`
                                      : String(raw)

                                  return (
                                    <span
                                      style={{
                                        color: isNegative ? 'var(--danger-text)' : 'var(--success-text)',
                                        marginLeft: 4,
                                      }}
                                    >
                                      {display}
                                </span>
                                  )
                                })()
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
                    background: liveLoading ? 'var(--bg-overlay)' : 'var(--brand)',
                    color: '#fff',
                    fontFamily: "'Inter', sans-serif",
                    fontSize: 13,
                    fontWeight: 600,
                    letterSpacing: '0.04em',
                    cursor: liveLoading ? 'not-allowed' : 'pointer',
                    opacity: liveLoading ? 0.7 : 1,
                  }}
                >
                  {liveLoading ? 'Loading...' : 'Fetch Data'}
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

        {/* GUEST EXPERIENCE TAB */}
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

            <SMGDashboardEmbed />
          </div>
        )}

        {/* TRENDS TAB */}
        {!loading && activeTab === 'trends' && (
          <div className="fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <div>
                <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: 20, marginBottom: 8, color: 'var(--text-primary)' }}>📈 Trends Analysis</div>
                <div style={{ fontSize: 13, color: 'var(--text-tertiary)', fontFamily: "'Inter', sans-serif", fontWeight: 400 }}>
                  Trend lines from cube data across selected stores.
                </div>
              </div>
            </div>

            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 24 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'flex-start', marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: "'Inter', sans-serif", fontWeight: 600, letterSpacing: '0.12em', marginBottom: 8 }}>METRIC</div>
                  <select
                    value={trendsMetricKey}
                    onChange={(e) => setTrendsMetricKey(e.target.value as MetricKey)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 8,
                      border: '1px solid var(--border-default)',
                      background: 'var(--bg-overlay)',
                      color: 'var(--text-primary)',
                      fontFamily: "'Inter', sans-serif",
                      fontSize: 13,
                      minWidth: 160,
                    }}
                  >
                    {METRICS.filter((m) => m.key !== 'cash_short').map((m) => (
                      <option key={m.key} value={m.key}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ flex: 1, minWidth: 280 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: "'Inter', sans-serif", fontWeight: 600, letterSpacing: '0.12em', marginBottom: 8 }}>STORES</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {stores.map((s, i) => {
                      const checked = trendsStoresSelected.includes(s.number)
                      return (
                        <label
                          key={s.number}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '6px 10px',
                            borderRadius: 6,
                            border: `1px solid ${checked ? STORE_COLORS[i % STORE_COLORS.length] : 'var(--border-default)'}`,
                            background: checked ? `${STORE_COLORS[i % STORE_COLORS.length]}20` : 'var(--bg-overlay)',
                            color: 'var(--text-primary)',
                            fontFamily: "'Inter', sans-serif",
                            fontSize: 12,
                            fontWeight: 500,
                            cursor: 'pointer',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              setTrendsStoresSelected((prev) =>
                                prev.includes(s.number) ? prev.filter((n) => n !== s.number) : [...prev, s.number]
                              )
                            }}
                            style={{ width: 16, height: 16, accentColor: 'var(--brand)' }}
                          />
                          {s.number}
                        </label>
                      )
                    })}
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: "'Inter', sans-serif", fontWeight: 600, letterSpacing: '0.12em', marginBottom: 8 }}>PERIOD</div>
                <div style={{ display: 'flex', gap: 4, background: 'var(--bg-overlay)', borderRadius: 8, padding: 4, border: '1px solid var(--border-subtle)' }}>
                  {(['3M', '6M', '1Y', '2Y', '3Y'] as const).map((p) => (
                    <button
                      key={p}
                      onClick={() => setTrendsPeriod(p)}
                      style={{
                        padding: '6px 16px',
                        borderRadius: 8,
                        border: 'none',
                        cursor: 'pointer',
                        fontFamily: "'Inter', sans-serif",
                        fontSize: 13,
                        fontWeight: 600,
                        letterSpacing: '0.04em',
                        background: trendsPeriod === p ? 'var(--bg-elevated)' : 'transparent',
                        color: trendsPeriod === p ? 'var(--text-primary)' : 'var(--text-tertiary)',
                      }}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: 24 }}>
                {trendsLoading ? (
                  <div style={{ height: 350, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: 'var(--text-secondary)', fontFamily: "'Inter', sans-serif", fontSize: 13 }}>
                    <div style={{ width: 32, height: 32, border: '3px solid var(--border-default)', borderTopColor: 'var(--brand)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                    Loading {trendsPeriod === '3M' ? '12 weeks' : trendsPeriod === '6M' ? '6 months' : trendsPeriod === '1Y' ? '12 months' : trendsPeriod === '2Y' ? '24 months' : '36 months'} of data...
                  </div>
                ) : trendsChartData.length === 0 ? (
                  <div style={{ height: 350, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', fontFamily: "'Inter', sans-serif", fontSize: 13 }}>
                    No data. Select at least one store.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={350}>
                    <LineChart data={trendsChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="1 3" stroke="var(--border-subtle)" />
                      <XAxis dataKey="label" stroke="var(--text-tertiary)" tick={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", fill: 'var(--text-tertiary)' }} />
                      <YAxis
                        stroke="var(--text-tertiary)"
                        tick={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", fill: 'var(--text-tertiary)' }}
                        tickFormatter={(v) => (METRICS.find((x) => x.key === trendsMetricKey)?.fmt(v) ?? String(v))}
                      />
                      <Tooltip
                        content={({ active, payload, label }) => {
                          if (!active || !payload?.length) return null
                          return (
                            <div style={{ background: 'var(--bg-overlay)', border: '1px solid var(--border-default)', borderRadius: 8, padding: '12px 16px' }}>
                              <div style={{ fontSize: 12, color: 'var(--text-primary)', fontFamily: "'Inter', sans-serif", marginBottom: 8 }}>{label}</div>
                              {payload.map((p: any) => (
                                <div key={p.dataKey} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.color }} />
                                  <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: "'Inter', sans-serif" }}>Store {p.dataKey}:</span>
                                  <span style={{ fontSize: 12, fontWeight: 600, color: p.color, fontFamily: "'JetBrains Mono', monospace" }}>
                                    {METRICS.find((m) => m.key === trendsMetricKey)?.fmt(p.value) ?? p.value}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: 12, fontFamily: "'Inter', sans-serif", color: 'var(--text-secondary)' }} formatter={(val) => `Store ${val}`} />
                      {trendsStoresSelected.map((storeNum, i) => {
                        const color = STORE_COLORS[stores.findIndex((s) => s.number === storeNum) % STORE_COLORS.length] ?? STORE_COLORS[i % STORE_COLORS.length]
                        return (
                          <Line key={storeNum} type="monotone" dataKey={storeNum} stroke={color} strokeWidth={2} dot={{ r: 0 }} activeDot={{ r: 4, fill: color }} />
                        )
                      })}
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>

              {!trendsLoading && trendsTableRows.length > 0 && (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: "'Inter', sans-serif", fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-default)' }}>
                        <th style={{ textAlign: 'left', padding: '10px 12px', color: 'var(--text-tertiary)', fontWeight: 600, fontSize: 11, letterSpacing: '0.08em' }}>STORE</th>
                        <th style={{ textAlign: 'left', padding: '10px 12px', color: 'var(--text-tertiary)', fontWeight: 600, fontSize: 11, letterSpacing: '0.08em' }}>LOCATION</th>
                        <th style={{ textAlign: 'right', padding: '10px 12px', color: 'var(--text-tertiary)', fontWeight: 600, fontSize: 11, letterSpacing: '0.08em' }}>START</th>
                        <th style={{ textAlign: 'right', padding: '10px 12px', color: 'var(--text-tertiary)', fontWeight: 600, fontSize: 11, letterSpacing: '0.08em' }}>LATEST</th>
                        <th style={{ textAlign: 'right', padding: '10px 12px', color: 'var(--text-tertiary)', fontWeight: 600, fontSize: 11, letterSpacing: '0.08em' }}>CHANGE</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trendsTableRows.map((row) => {
                        const fmt = METRICS.find((m) => m.key === trendsMetricKey)?.fmt ?? ((v: number) => String(v))
                        const isBad = row.changePct < -10
                        const isGood = row.changePct > 5
                        const rowBg = isBad ? 'rgba(239, 68, 68, 0.08)' : isGood ? 'rgba(34, 197, 94, 0.08)' : 'transparent'
                        return (
                          <tr key={row.storeNum} style={{ borderBottom: '1px solid var(--border-subtle)', background: rowBg }}>
                            <td style={{ padding: '10px 12px', color: 'var(--text-primary)', fontWeight: 600 }}>{row.storeNum}</td>
                            <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>{row.location || '—'}</td>
                            <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-secondary)' }}>{fmt(row.start)}</td>
                            <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-primary)' }}>{fmt(row.latest)}</td>
                            <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, color: isBad ? 'var(--danger-text)' : isGood ? 'var(--success-text)' : 'var(--text-secondary)' }}>
                              {row.changePct >= 0 ? '▲' : '▼'} {row.changePct >= 0 ? '+' : ''}{row.changePct.toFixed(1)}%
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* YEAR VS YEAR TAB */}
        {false && !loading && activeTab === 'yoy' && (
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
                        {m.tooltip && (
                          <span style={{ marginLeft: 4, cursor: 'help', opacity: 0.85 }} title={m.tooltip} aria-label="Info">ℹ</span>
                        )}
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
                    <div
                      className="metric-chip"
                      onClick={() => router.push('/trends')}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 6,
                        fontSize: 13,
                        fontWeight: 500,
                        border: '1px solid var(--border-default)',
                        background: 'transparent',
                        color: 'var(--text-tertiary)',
                        fontFamily: "'Inter', sans-serif",
                        cursor: 'pointer',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'var(--border-strong)'
                        e.currentTarget.style.color = 'var(--text-secondary)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'var(--border-default)'
                        e.currentTarget.style.color = 'var(--text-tertiary)'
                      }}
                    >
                      Trends
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Date control bar (when LIVE CUBE selected) */}
            {dataSource === 'cube' && (
              <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '16px 20px', marginBottom: 24 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: "'Inter', sans-serif", fontWeight: 600, letterSpacing: '0.12em', marginBottom: 8 }}>PERIOD</div>
                    <div style={{ display: 'flex', gap: 4, background: 'var(--bg-overlay)', borderRadius: 8, padding: 4, border: '1px solid var(--border-subtle)' }}>
                      {(['daily', 'weekly', 'monthly', 'yearly'] as const).map((p) => (
                        <button
                          key={p}
                          onClick={() => {
                            const newDate = p === 'daily' ? getYesterdayDate() : p === 'weekly' ? getDefaultWeek() : p === 'monthly' ? getDefaultMonth() : String(new Date().getFullYear())
                            setCubePeriod(p)
                            setCubeDate(newDate)
                            void loadCubeData(newDate, p)
                          }}
                          style={{
                            padding: '6px 16px',
                            borderRadius: 8,
                            border: 'none',
                            cursor: 'pointer',
                            fontFamily: "'Inter', sans-serif",
                            fontSize: 13,
                            fontWeight: 600,
                            letterSpacing: '0.04em',
                            background: cubePeriod === p ? 'var(--bg-elevated)' : 'transparent',
                            color: cubePeriod === p ? 'var(--text-primary)' : 'var(--text-tertiary)',
                          }}
                        >
                          {p === 'daily' ? 'Day' : p === 'weekly' ? 'Week' : p === 'monthly' ? 'Month' : 'Year'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: "'Inter', sans-serif", fontWeight: 600, letterSpacing: '0.12em', marginBottom: 8 }}>
                      {cubePeriod === 'daily' ? 'DATE' : cubePeriod === 'weekly' ? 'WEEK' : cubePeriod === 'monthly' ? 'MONTH' : 'YEAR'}
                    </div>
                    {cubePeriod === 'yearly' ? (
                      <select
                        value={cubeDate}
                        onChange={(e) => {
                          const val = e.target.value
                          setCubeDate(val)
                          void loadCubeData(val, 'yearly')
                        }}
                        style={{
                          padding: '8px 12px',
                          borderRadius: 6,
                          border: '1px solid var(--border-default)',
                          background: 'var(--bg-overlay)',
                          color: 'var(--text-primary)',
                          fontFamily: "'Inter', sans-serif",
                          fontSize: 13,
                        }}
                      >
                        {[2022, 2023, 2024, 2025, 2026].map((y) => (
                          <option key={y} value={String(y)}>{y}</option>
                        ))}
                      </select>
                    ) : cubePeriod === 'weekly' ? (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <select
                          value={cubeDate.includes('-W') ? cubeDate.split('-')[0] : String(new Date().getFullYear())}
                          onChange={(e) => {
                            const year = e.target.value
                            const week = cubeDate.includes('-W') ? (cubeDate.split('-W')[1] || '1') : String(getDefaultWeek().split('-W')[1] || '1')
                            const val = `${year}-W${week.padStart(2, '0')}`
                            setCubeDate(val)
                            void loadCubeData(val, 'weekly')
                          }}
                          style={{
                            padding: '8px 12px',
                            borderRadius: 6,
                            border: '1px solid var(--border-default)',
                            background: 'var(--bg-overlay)',
                            color: 'var(--text-primary)',
                            fontFamily: "'Inter', sans-serif",
                            fontSize: 13,
                          }}
                        >
                          {[2022, 2023, 2024, 2025, 2026].map((y) => (
                            <option key={y} value={String(y)}>{y}</option>
                          ))}
                        </select>
                        <select
                          value={cubeDate.includes('-W') ? parseInt(cubeDate.split('-W')[1] || '1', 10) : parseInt(getDefaultWeek().split('-W')[1] || '1', 10)}
                          onChange={(e) => {
                            const week = e.target.value
                            const year = cubeDate.includes('-W') ? cubeDate.split('-')[0] : String(new Date().getFullYear())
                            const val = `${year}-W${String(week).padStart(2, '0')}`
                            setCubeDate(val)
                            void loadCubeData(val, 'weekly')
                          }}
                          style={{
                            padding: '8px 12px',
                            borderRadius: 6,
                            border: '1px solid var(--border-default)',
                            background: 'var(--bg-overlay)',
                            color: 'var(--text-primary)',
                            fontFamily: "'Inter', sans-serif",
                            fontSize: 13,
                          }}
                        >
                          {Array.from({ length: 52 }, (_, i) => i + 1).map((w) => (
                            <option key={w} value={w}>Week {w}</option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <input
                        type={cubePeriod === 'daily' ? 'date' : 'month'}
                        value={cubeDate}
                        onChange={(e) => {
                          const val = e.target.value
                          setCubeDate(val)
                          void loadCubeData(val, cubePeriod)
                        }}
                        style={{
                          padding: '8px 12px',
                          borderRadius: 6,
                          border: '1px solid var(--border-default)',
                          background: 'var(--bg-overlay)',
                          color: 'var(--text-primary)',
                          fontFamily: "'Inter', sans-serif",
                          fontSize: 13,
                        }}
                      />
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
                    <button
                      onClick={() => void loadCubeData()}
                      disabled={cubeLoading}
                      style={{
                        padding: '8px 20px',
                        borderRadius: 8,
                        border: 'none',
                        cursor: cubeLoading ? 'not-allowed' : 'pointer',
                        fontFamily: "'Inter', sans-serif",
                        fontSize: 13,
                        fontWeight: 600,
                        letterSpacing: '0.04em',
                        background: 'var(--brand)',
                        color: '#fff',
                      }}
                    >
                      {cubeLoading ? (
                        <>
                          <span style={{ display: 'inline-block', width: 12, height: 12, border: '2px solid rgba(255,255,255,0.5)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite', marginRight: 8, verticalAlign: 'middle' }} />
                          Loading…
                        </>
                      ) : (
                        'Load Cube Data'
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

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
                cubeData={cubeData}
                cubeDate={cubeDate}
                cubePeriod={cubePeriod}
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
                    // TODO: LY toggle - re-enable when LY data query is stable. For now always TY.
                    const cubeStore = dataSource === 'cube'
                      ? cubeData?.find((s) => String(s.storeNumber) === num) ?? null
                      : null
                    const showLyBanner = undefined // dataSource === 'cube' && cubeViewMode === 'LY' ? getLyDate(...) : undefined
                    const cubeDateLabelForCard = dataSource === 'cube'
                      ? (activeCubeDate || cubeDate || '—')
                      : undefined
                    return (
                      <KpiCard
                        key={num}
                        store={store}
                        reports={reports[num] || []}
                        cubeStore={cubeStore ?? undefined}
                        cubeDateLabel={cubeDateLabelForCard}
                        showLyBanner={showLyBanner}
                      />
                    )
                  })}
                </div>

                {/* Single Store Date Compare */}
                {selectedStoresSafe.length === 1 && (
                  <SingleStoreDateCompare
                    store={stores.find((s) => s.number === selectedStoresSafe[0])!}
                    cubeData={cubeData}
                    cubePeriod={cubePeriod}
                    cubeDate={cubeDate}
                    metrics={METRICS}
                    storeColor={STORE_COLORS[stores.findIndex((s) => s.number === selectedStoresSafe[0]) % STORE_COLORS.length]}
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
              {METRICS.map((m) => {
                const isDollarTarget = m.key === 'net_sales' || m.key === 'cash_short' || m.key === 'doordash_sales' || m.key === 'ubereats_sales'
                const targetVal = TARGETS[m.key]
                const targetLabel = m.key === 'net_sales'
                  ? `> $${(targetVal ?? 0).toLocaleString()}`
                  : m.key === 'cash_short'
                    ? `< $${(targetVal ?? 0)}`
                    : isDollarTarget && targetVal != null
                      ? `> $${targetVal.toLocaleString()}`
                      : targetVal != null
                        ? `< ${targetVal}%`
                        : '—'
                return (
                <div key={m.key} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 12 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: "'Inter', sans-serif", fontWeight: 500, letterSpacing: '0.12em', marginBottom: 8 }}>
                    {m.label.toUpperCase()} TARGET
                    {m.tooltip && (
                      <span style={{ marginLeft: 4, cursor: 'help', opacity: 0.85 }} title={m.tooltip} aria-label="Info">ℹ</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>
                        {targetLabel}
                    </div>
                      {targetVal != null && <Badge value={targetVal - 0.01} metricKey={m.key} />}
                  </div>
                </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
