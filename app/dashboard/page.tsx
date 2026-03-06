'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  LabelList,
} from 'recharts'
import type { DailyReportWithStore } from '@/lib/db'
import ComparisonPanel from '@/components/ComparisonPanel'
import SingleStoreDateCompare from '@/components/SingleStoreDateCompare'
import AuditUpload from '@/components/audit/AuditUpload'
import AuditSummaryTable from '@/components/audit/AuditSummaryTable'
import AuditDetailsTable from '@/components/audit/AuditDetailsTable'
import FraudFlags from '@/components/audit/FraudFlags'
import AuditSummaryComparisonTable from '@/components/audit/AuditSummaryComparisonTable'
import { ProfitabilityContent } from '@/app/analytics/profitability/ProfitabilityContent'
import YearOverYearUploadPanel from '@/components/YearOverYearUploadPanel'
import YearOverYearPanel from '@/components/YearOverYearPanel'
import SMGDashboardEmbed from '@/components/SMGDashboardEmbed'
import { Lock, TrendingUp, Package, Users, Bell } from 'lucide-react'


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
  // VBO catalog
  voidMadeOrders?: number | null
  voidMadeAmountUsd?: number | null
  voidMadePctNetSalesUsd?: number | null
  cashOverShortUsd?: number | null
  totalDiscountsUsd?: number | null
  highDiscountAmountUsd?: number | null
  highDiscPctNetSalesUsd?: number | null
  overtimeHours?: number | null
  totalHoursWorked?: number | null
  // ProfitKeeper catalog
  totalLabor?: number | null
  totalLaborPct?: number | null
  totalLaborOtHours?: number | null
  actualFoodCostUsd?: number | null
  actualFoodPct?: number | null
  targetFoodCostUsd?: number | null
  targetFoodPct?: number | null
  foodVariancePct?: number | null
  bozocoroNetSalesUsd?: number | null
  badOrderNetSalesUsd?: number | null
  zeroedOrders?: number | null
  cancelledOrderNetSalesUsd?: number | null
  refundedOrders?: number | null
  doorDashDeliveryPct?: number | null
  aggregatorFeesCommissionsPct?: number | null
  restaurantLevelEbitda?: number | null
  // Offers catalog
  offerDiscountAmountUsd?: number | null
  averageDiscountUsd?: number | null
  redeemedCount?: number | null
  grossMarginPerOrderUsd?: number | null
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

/** Tableau Leadership API response (store + date summary) */
type TableauLeadership = {
  store_number: string
  date: string
  labor_pct: number
  food_pct: number
  bozocoro_pct: number
  osat_pct: number
  avg_otd_time: string
  [key: string]: unknown
}

/** Tableau BoZoCoRo API response (detail by category) */
type TableauBozocoroDetail = { employee: string; order_id: string; amount: number; time: string; reason?: string }
type TableauBozocoro = {
  store_number: string
  date: string
  zeroed_out: { summary: { count: number; total_value: number }; details: TableauBozocoroDetail[] }
  bad_orders: { summary: { count: number; total_value: number }; details: TableauBozocoroDetail[] }
  cancelled: { summary: { count: number; total_value: number }; details: TableauBozocoroDetail[] }
  refunds: { summary: { count: number; total_value: number }; details: TableauBozocoroDetail[] }
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
  tableauLeadership,
  tableauBozocoro,
  tableauLoading,
}: {
  store: StoreUI
  reports: ReportPoint[]
  cubeStore?: CubeStoreRow | null
  cubeDateLabel?: string
  showLyBanner?: string
  tableauLeadership?: TableauLeadership | null
  tableauBozocoro?: TableauBozocoro | null
  tableauLoading?: boolean
}) {
  const [isFlipped, setIsFlipped] = useState(false)
  const [bozocoroExpanded, setBozocoroExpanded] = useState(false)
  const [bozocoroTab, setBozocoroTab] = useState<'zeroed' | 'bad' | 'cancelled' | 'refunds'>('zeroed')
  const latest = reports?.[reports.length - 1]
  const idx = Number.isFinite(Number(store.number))
    ? Number(store.number) % STORE_COLORS.length
    : 0
  const storeColor = STORE_COLORS[idx]
  const canFlip = Boolean(cubeStore)

  const cardBaseStyle: React.CSSProperties = {
    background: 'var(--bg-surface)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 10,
    padding: 14,
    paddingBottom: 14,
    position: 'relative',
    overflow: 'visible',
    height: 'auto',
    minHeight: 'unset',
    display: 'flex',
    flexDirection: 'column',
    boxSizing: 'border-box',
  }
  const cardBaseStylePadded: React.CSSProperties = { ...cardBaseStyle, padding: 14, paddingBottom: 14 }

  const topBarStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    background: storeColor,
  }

  // Back face content (detail metrics) — grouped into sections
  const metricCell = (label: string, value: string | number, key?: string) => (
    <div key={key || label} style={{ background: 'var(--bg-base)', borderRadius: 8, padding: '12px' }}>
      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: "'Inter', sans-serif", fontWeight: 500, letterSpacing: '0.08em', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-primary)' }}>{value}</div>
    </div>
  )
  const sectionTitle = (title: string) => (
    <div key={title} style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: "'Inter', sans-serif", fontWeight: 600, letterSpacing: '0.08em', marginTop: 16, marginBottom: 8, gridColumn: '1 / -1' }}>{title}</div>
  )
  const fmtUsd = (v: number | null | undefined) => v != null ? `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'N/A'
  const fmtPct = (v: number | null | undefined) => v != null ? `${v}%` : 'N/A'
  const fmtNum = (v: number | null | undefined) => v != null ? v.toLocaleString() : 'N/A'

  const backContent = cubeStore && (
    <div style={cardBaseStylePadded} onClick={() => canFlip && setIsFlipped(false)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { setIsFlipped(false) } }} aria-label="Flip card back">
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
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, flex: 1, overflowY: 'auto', maxHeight: 520 }}>
        {sectionTitle('SALES & ORDERS')}
        {metricCell('Net Sales', fmtUsd(cubeStore.netSales))}
        {metricCell('Avg Ticket', fmtUsd(cubeStore.avgTicket))}
        {metricCell('Online Sales', fmtUsd(cubeStore.onlineSales))}
        {metricCell('Carryout', `${fmtNum(cubeStore.carryoutOrders)} orders (${cubeStore.carryoutPct ?? 0}%)`)}
        {metricCell('Delivery', `${fmtNum(cubeStore.deliveryOrders)} orders (${cubeStore.deliveryPct ?? 0}%)`)}
        {metricCell('App Sales', fmtUsd(cubeStore.appSales))}
        {metricCell('Web Sales', fmtUsd(cubeStore.webSales))}

        {sectionTitle('LABOR')}
        {metricCell('Labor $', fmtUsd(cubeStore.totalLabor))}
        {metricCell('Labor %', fmtPct(cubeStore.totalLaborPct))}
        {/* OT Hours (Period) — commented out
        {metricCell('OT Hours (Period)', fmtNum(cubeStore.totalLaborOtHours ?? cubeStore.overtimeHours))}
        */}
        {metricCell('Total Hours', fmtNum(cubeStore.totalHoursWorked))}

        {sectionTitle('FOOD COST')}
        {metricCell('Actual Food $', fmtUsd(cubeStore.actualFoodCostUsd ?? cubeStore.foodCostUsd))}
        {metricCell('Actual Food %', fmtPct(cubeStore.actualFoodPct))}
        {metricCell('Target Food %', fmtPct(cubeStore.targetFoodPct))}
        {metricCell('Food Variance %', fmtPct(cubeStore.foodVariancePct))}

        {sectionTitle('VOIDS & CASH')}
        {metricCell('Void Orders', fmtNum(cubeStore.voidMadeOrders))}
        {metricCell('Void Amount $', fmtUsd(cubeStore.voidMadeAmountUsd))}
        {metricCell('Void % of Sales', fmtPct(cubeStore.voidMadePctNetSalesUsd))}
        {metricCell('Cash Over/Short', fmtUsd(cubeStore.cashOverShortUsd))}

        {sectionTitle('BOZOCORO')}
        {metricCell('BoZoCoRo $ (All Time)', fmtUsd(cubeStore.bozocoroNetSalesUsd))}
        {metricCell('Bad Orders $ (All Time)', fmtUsd(cubeStore.badOrderNetSalesUsd))}
        {metricCell('Zeroed Orders (All Time)', fmtNum(cubeStore.zeroedOrders))}
        {metricCell('Cancelled Orders $ (All Time)', fmtUsd(cubeStore.cancelledOrderNetSalesUsd))}
        {metricCell('Refunded Orders (All Time)', fmtNum(cubeStore.refundedOrders))}

        {sectionTitle('DISCOUNTS & OFFERS')}
        {metricCell('Total Discounts', fmtUsd(cubeStore.totalDiscountsUsd))}
        {metricCell('High Discounts', fmtUsd(cubeStore.highDiscountAmountUsd))}
        {metricCell('High Disc %', fmtPct(cubeStore.highDiscPctNetSalesUsd))}
        {metricCell('Avg Discount $', fmtUsd(cubeStore.averageDiscountUsd ?? cubeStore.avgDiscount))}
        {metricCell('Offers Redeemed', fmtNum(cubeStore.redeemedCount))}
        {metricCell('Gross Margin/Order', fmtUsd(cubeStore.grossMarginPerOrderUsd))}

        {sectionTitle('DELIVERY')}
        {/* DoorDash % (Period) — commented out
        {metricCell('DoorDash % (Period)', fmtPct(cubeStore.doorDashDeliveryPct))}
        {metricCell('Aggregator Fees % (Period)', fmtPct(cubeStore.aggregatorFeesCommissionsPct))}
        */}

        {sectionTitle('PROFITABILITY')}
        {metricCell('EBITDA (All Time)', fmtUsd(cubeStore.restaurantLevelEbitda))}
      </div>
    </div>
  )

  if (!latest) return null

  const netSalesVal = cubeStore?.netSales ?? latest?.net_sales ?? 0
  const laborPctVal = cubeStore != null ? (cubeStore.totalLaborPct ?? cubeStore.laborPct) : (latest?.labor_pct ?? 0)
  const foodCostUsdVal = cubeStore != null ? (cubeStore.actualFoodCostUsd ?? cubeStore.foodCostUsd) : (latest as any)?.food_cost_usd
  const foodCostPctVal = cubeStore != null ? (cubeStore.actualFoodPct ?? (cubeStore.netSales && cubeStore.foodCostUsd ? (cubeStore.foodCostUsd / cubeStore.netSales) * 100 : null)) : (latest?.food_cost_pct ?? 0)
  const flmPctVal = cubeStore?.flmPct ?? (latest?.flm_pct ?? 0)
  const dddVal = cubeStore?.dddSales ?? (latest as any)?.doordash_sales ?? 0
  const aggregatorVal = cubeStore?.aggregatorSales ?? (latest as any)?.ubereats_sales ?? 0
  const compPct = (latest as any)?.comp_pct
  const laborTarget = TARGETS.labor_pct ?? 28.68
  const flmTarget = TARGETS.flm_pct ?? 55.11
  const laborGood = laborPctVal != null && laborPctVal <= laborTarget
  const flmGood = flmPctVal != null && flmPctVal < flmTarget
  const foodGood = foodCostPctVal != null && (TARGETS.food_cost_pct == null || foodCostPctVal <= TARGETS.food_cost_pct)

  const frontContent = (
    <div style={cardBaseStyle}>
      <div style={topBarStyle} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div>
          <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 15, color: 'var(--text-primary)', lineHeight: 1.2 }}>
            {store.name}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontFamily: "'Inter', sans-serif" }}>{store.location}</span>
            {!showLyBanner && compPct != null && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  padding: '1px 6px',
                  borderRadius: 4,
                  background: compPct >= 0 ? 'var(--success-subtle)' : 'var(--danger-subtle)',
                  color: compPct >= 0 ? 'var(--success-text)' : 'var(--danger-text)',
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                Comp {compPct >= 0 ? '+' : ''}{compPct}%
              </span>
            )}
            {showLyBanner && (
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: "'Inter', sans-serif", fontWeight: 500 }}>Showing LY: {showLyBanner}</span>
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
                fontWeight: 600,
                color: 'var(--text-tertiary)',
                background: 'transparent',
                border: '1px solid var(--border-default)',
                borderRadius: 5,
                padding: '3px 9px',
                cursor: 'pointer',
              }}
            >
              View →
            </button>
          )}
          <div style={{ width: 24, height: 24, borderRadius: 5, background: `${storeColor}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: storeColor, fontWeight: 500 }}>
            {store.number.slice(-2)}
          </div>
        </div>
      </div>

      {/* 2 rows × 3 cols — compact metric grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        <div style={{ background: 'var(--bg-base)', borderRadius: 7, padding: '8px 10px' }}>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 4 }}>Net Sales</div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 17, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.1 }}>${Number(netSalesVal).toLocaleString('en-US', { maximumFractionDigits: 0 })}</div>
          <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', marginTop: 2 }}>{compPct != null ? (compPct >= 0 ? '↑' : '↓') + ' vs prev period' : '—'}</div>
        </div>
        <div style={{ background: laborGood ? 'var(--bg-base)' : 'var(--danger-subtle)', borderRadius: 7, padding: '8px 10px' }}>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: laborGood ? 'var(--text-tertiary)' : 'var(--danger-text)', marginBottom: 4 }}>Labor %</div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 17, fontWeight: 500, color: laborGood ? 'var(--success-text)' : 'var(--danger-text)', lineHeight: 1.1 }}>{laborPctVal != null ? `${Number(laborPctVal).toFixed(1)}%` : '—'}</div>
          <div style={{ fontSize: 10.5, color: laborGood ? 'var(--success-text)' : 'var(--danger-text)', marginTop: 2 }}>{laborGood ? `Target: ${laborTarget}%` : '↑ Over target'}</div>
        </div>
        <div style={{ background: flmGood ? 'var(--bg-base)' : 'var(--danger-subtle)', borderRadius: 7, padding: '8px 10px' }}>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: flmGood ? 'var(--text-tertiary)' : 'var(--danger-text)', marginBottom: 4 }}>FLM %</div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 17, fontWeight: 500, color: flmGood ? 'var(--success-text)' : 'var(--danger-text)', lineHeight: 1.1 }}>{flmPctVal != null ? `${Number(flmPctVal).toFixed(1)}%` : '—'}</div>
          <div style={{ fontSize: 10.5, color: flmGood ? 'var(--success-text)' : 'var(--danger-text)', marginTop: 2 }}>Target: &lt;{flmTarget}%</div>
        </div>
        <div style={{ background: 'var(--bg-base)', borderRadius: 7, padding: '8px 10px' }}>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 4 }}>Food Cost</div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 17, fontWeight: 500, color: foodGood ? 'var(--text-primary)' : 'var(--danger-text)', lineHeight: 1.1 }}>
            {foodCostUsdVal != null ? `$${Number(foodCostUsdVal).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : foodCostPctVal != null ? `${Number(foodCostPctVal).toFixed(1)}%` : '—'}
          </div>
          <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', marginTop: 2 }}>{foodCostPctVal != null ? `${Number(foodCostPctVal).toFixed(1)}%` : '—'}</div>
        </div>
        <div style={{ background: 'var(--bg-base)', borderRadius: 7, padding: '8px 10px' }}>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 4 }}>Aggregator</div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 17, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.1 }}>
            ${Number(cubeStore ? (aggregatorVal ?? 0) : (Number(dddVal) + Number(aggregatorVal))).toLocaleString('en-US', { maximumFractionDigits: 0 })}
          </div>
          <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', marginTop: 2 }}>DD + UE + GH</div>
        </div>
        <div style={{ background: 'var(--bg-base)', borderRadius: 7, padding: '8px 10px' }}>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 4 }}>DoorDash</div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 17, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.1 }}>${Number(dddVal).toLocaleString('en-US', { maximumFractionDigits: 0 })}</div>
          <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', marginTop: 2 }}>—</div>
        </div>
      </div>
    </div>
  )

  if (!canFlip) {
    return <div style={{ height: 'auto' }}>{frontContent}</div>
  }

  return (
    <div style={{ perspective: 1000, height: 'auto', minHeight: 'unset' }}>
      <div
        style={{
          position: 'relative',
          height: 'auto',
          minHeight: 'unset',
          transformStyle: 'preserve-3d',
          transition: 'transform 0.4s ease',
          transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
        }}
      >
        <div
          style={{
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
            minHeight: '100%',
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

/** Forecast week calendar: WK N start = (year-1)-12-29 + (N * 7) days per user spec. */
function getWeekMonday(weekNum: number, year: number): string {
  const base = new Date(year - 1, 11, 29)
  base.setDate(base.getDate() + weekNum * 7)
  return base.toISOString().slice(0, 10)
}

/** Current week number for today (week of year: ceil(dayOfYear/7)). March 5, 2026 = WK10. */
function getCurrentWeekNumber(year: number): number {
  const now = new Date()
  const startOfYear = new Date(year, 0, 1)
  const dayOfYear = Math.floor((now.getTime() - startOfYear.getTime()) / 86400000) + 1
  const weekNum = Math.ceil(dayOfYear / 7)
  return Math.max(1, Math.min(53, weekNum))
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
  const [activeTab, setActiveTab] = useState<'dashboard' | 'trends' | 'operations' | 'analytics' | 'forecast' | 'live' | 'guest'>('dashboard')
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
  const [refreshCountdown, setRefreshCountdown] = useState(15 * 60)
  const [liveStalenessTick, setLiveStalenessTick] = useState(0)
  const [selectedStore, setSelectedStore] = useState<any>(null)
  const [showStoreModal, setShowStoreModal] = useState(false)
  const [sessionExpired, setSessionExpired] = useState(false)

  // HotSchedules Labor tab
  type HotschedulesLaborRow = {
    id?: string
    store_number: string
    week: string
    week_bd: string
    instore_scheduled_hours: number
    instore_actual_hours: number
    instore_forecasted_hours: number
    instore_optimal_hours?: number
    manager_scheduled_hours: number
    manager_actual_hours: number
    manager_forecasted_hours: number
    manager_optimal_hours?: number
    driver_scheduled_hours: number
    driver_actual_hours: number
    driver_forecasted_hours: number
    driver_optimal_hours?: number
    total_scheduled_hours?: number
    total_actual_hours?: number
    synced_at?: string
  }
  const [laborData, setLaborData] = useState<HotschedulesLaborRow[]>([])
  const [laborLoading, setLaborLoading] = useState(false)
  const [laborError, setLaborError] = useState<string | null>(null)
  const [laborSelectedWeek, setLaborSelectedWeek] = useState<string>('')
  const [auditPeriod, setAuditPeriod] = useState<'current_period' | 'last_period' | 'last_year'>('current_period')
  const [auditTab, setAuditTab] = useState<'summary' | 'details' | 'fraud'>('summary')
  const [auditRefreshKey, setAuditRefreshKey] = useState(0)
  const [auditDetailsFilter, setAuditDetailsFilter] = useState<{ store?: string; manager?: string }>({})
  const [laborTrendStore, setLaborTrendStore] = useState<string | null>(null)
  const [laborPctByStore, setLaborPctByStore] = useState<Record<string, number | null>>({})
  const [laborCubeLoading, setLaborCubeLoading] = useState(false)

  // Forecast tab: last 8 completed weeks (set in fetch effect); 2-week projection window (LY fetches)
  const FORECAST_YEAR = 2026
  const [forecastWeeksCurrent, setForecastWeeksCurrent] = useState<string[]>([])
  const [forecastWindowStart, setForecastWindowStart] = useState(getCurrentWeekNumber(FORECAST_YEAR))
  type ForecastWeekData = { week: string; stores: Array<{ storeNumber: string; netSales?: number | null; lyNetSales?: number | null; totalLaborPct?: number | null; laborPct?: number | null }> }
  const [forecastDataByWeek, setForecastDataByWeek] = useState<Record<string, ForecastWeekData['stores']>>({})
  const [forecastWk9ScheduledByStore, setForecastWk9ScheduledByStore] = useState<Record<string, number>>({})
  const [forecastLoading, setForecastLoading] = useState(false)
  const [forecastError, setForecastError] = useState<string | null>(null)
  const AVG_WAGE = 17
  const minForecastWindowStart = getCurrentWeekNumber(FORECAST_YEAR)
  const forecastLyWeekKeys = (start: number) => {
    const min = minForecastWindowStart
    return Array.from({ length: start + 2 - min }, (_, i) => `${FORECAST_YEAR - 1}-W${String(min + i).padStart(2, '0')}`)
  }

  // Reset forecast window to current week whenever user opens Forecast tab
  useEffect(() => {
    if (activeTab === 'forecast') {
      setForecastWindowStart(getCurrentWeekNumber(FORECAST_YEAR))
    }
  }, [activeTab])

  // Profit tab: P&L trailing chart
  const PROFIT_STORE_ALL = 'all'
  const PROFIT_STORES = ['2021', '2081', '2259', '2292', '2481', '3011']
  const PROFIT_STORE_NAMES: Record<string, string> = { '2021': 'Tapo', '2081': 'Westhills', '2259': 'Northridge', '2292': 'Canoga', '2481': 'Madera', '3011': 'Chatsworth' }
  const [profitStore, setProfitStore] = useState<string>(PROFIT_STORES[0])
  const [profitRange, setProfitRange] = useState<'last3' | 'last6' | 'lySame'>('last3')
  const [profitMetricToggles, setProfitMetricToggles] = useState({ netSales: true, ebitda: true, labor: true, foodCost: true, flm: true })
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
  const [profitTrendDataByStore, setProfitTrendDataByStore] = useState<Record<string, ProfitTrendPoint[]>>({})
  const [profitLoading, setProfitLoading] = useState(false)

  // Tableau: date picker (default today), data by store, loading, 30-min cache
  const [tableauDate, setTableauDate] = useState<string>(() => new Date().toISOString().slice(0, 10))
  const [tableauDataByStore, setTableauDataByStore] = useState<Record<string, { leadership: TableauLeadership | null; bozocoro: TableauBozocoro | null }>>({})
  const [tableauLoading, setTableauLoading] = useState(false)
  const tableauCacheRef = useRef<Record<string, { leadership: TableauLeadership | null; bozocoro: TableauBozocoro | null; ts: number }>>({})
  const TABLEAU_CACHE_MS = 30 * 60 * 1000

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

  // Check scraper session status (Microsoft / extranet)
  useEffect(() => {
    const checkScraperStatus = async () => {
      try {
        const res = await fetch('/api/scraper-status', { cache: 'no-store' })
        const json = await res.json()

        const expired =
          json?.session_expired === true ||
          json?.live?.session_expired === true ||
          json?.smg?.session_expired === true

        setSessionExpired(Boolean(expired))
      } catch (err) {
        console.error('Failed to fetch scraper status:', err)
      }
    }

    void checkScraperStatus()
  }, [])

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

  // Fetch Tableau Leadership + BoZoCoRo for selected stores and tableauDate; 30-min cache
  useEffect(() => {
    const safe = selectedStores.filter((n) => stores.some((s) => s.number === n))
    const storesToFetch = safe.length > 0 ? safe : stores.slice(0, 3).map((s) => s.number)
    if (storesToFetch.length === 0 || !tableauDate) return

    const cache = tableauCacheRef.current
    const now = Date.now()

    const run = async () => {
      setTableauLoading(true)
      const next: Record<string, { leadership: TableauLeadership | null; bozocoro: TableauBozocoro | null }> = {}
      for (const storeNum of storesToFetch) {
        const key = `${storeNum}-${tableauDate}`
        const cached = cache[key]
        if (cached && now - cached.ts < TABLEAU_CACHE_MS) {
          next[storeNum] = { leadership: cached.leadership, bozocoro: cached.bozocoro }
          continue
        }
        try {
          const [leadRes, bozRes] = await Promise.all([
            fetch(`/api/tableau-leadership?store=${encodeURIComponent(storeNum)}&date=${encodeURIComponent(tableauDate)}`, { cache: 'no-store' }),
            fetch(`/api/tableau-bozocoro?store=${encodeURIComponent(storeNum)}&date=${encodeURIComponent(tableauDate)}`, { cache: 'no-store' }),
          ])
          const leadership: TableauLeadership | null = leadRes.ok ? await leadRes.json() : null
          const bozocoro: TableauBozocoro | null = bozRes.ok ? await bozRes.json() : null
          next[storeNum] = { leadership, bozocoro }
          cache[key] = { leadership, bozocoro, ts: Date.now() }
        } catch {
          next[storeNum] = { leadership: null, bozocoro: null }
        }
      }
      setTableauDataByStore((prev) => ({ ...prev, ...next }))
      setTableauLoading(false)
    }
    void run()
  }, [tableauDate, selectedStores.join(','), stores.length])

  // Fetch live data from Supabase via /api/live-data (no scrape, no API key needed)
  const fetchLiveData = useCallback(async () => {
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
        }
        setRefreshCountdown(15 * 60)
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
  }, [liveLastUpdated])

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

  // Auto-refresh countdown timer - count down every second, refresh and reset when 0
  useEffect(() => {
    if (activeTab !== 'live') return

    void fetchLiveData()

    const countdownInterval = setInterval(() => {
      setRefreshCountdown((prev) => {
        const next = prev - 1
        if (next <= 0) {
          void fetchLiveData()
          return 15 * 60
        }
        return next
      })
    }, 1000)

    return () => clearInterval(countdownInterval)
  }, [activeTab, fetchLiveData])

  // Staleness tick - updates every minute so "last scraped X mins ago" stays current
  useEffect(() => {
    if (activeTab !== 'live' || !liveLastUpdated) return
    const t = setInterval(() => setLiveStalenessTick((prev) => prev + 1), 60000)
    return () => clearInterval(t)
  }, [activeTab, liveLastUpdated])

  // HotSchedules Labor: fetch when Labor tab is active
  useEffect(() => {
    if (activeTab !== 'operations') return
    let cancelled = false
    setLaborError(null)
    setLaborLoading(true)
    fetch('/api/hotschedules/data', { cache: 'no-store' })
      .then((res) => {
        if (cancelled) return
        if (!res.ok) throw new Error(res.statusText)
        return res.json()
      })
      .then((json) => {
        if (cancelled) return
        setLaborData(json.data ?? [])
      })
      .catch((err) => {
        if (!cancelled) setLaborError(err.message ?? 'Failed to load labor data')
      })
      .finally(() => {
        if (!cancelled) setLaborLoading(false)
      })
    return () => { cancelled = true }
  }, [activeTab])

  // Parse "WK9 2026" or "WK12 2026" to cube date "2026-W09"
  const parseLaborWeekToCubeDate = (weekStr: string): string | null => {
    const m = weekStr.match(/^WK\s*(\d+)\s+(\d{4})$/)
    if (!m) return null
    const week = m[1]
    const year = m[2]
    return `${year}-W${week.padStart(2, '0')}`
  }

  // Labor tab: fetch cube labor % for selected week (period=weekly, date=year-Wweek)
  useEffect(() => {
    if (activeTab !== 'operations' || laborData.length === 0) return
    const weeksWithActuals = Array.from(new Set(laborData.filter((r) => (r.total_actual_hours ?? 0) > 0).map((r) => r.week))).sort((a, b) => {
      const aRow = laborData.find((r) => r.week === a)
      const bRow = laborData.find((r) => r.week === b)
      return (bRow?.week_bd ?? '').localeCompare(aRow?.week_bd ?? '')
    })
    const selectedWeek = laborSelectedWeek && weeksWithActuals.includes(laborSelectedWeek) ? laborSelectedWeek : (weeksWithActuals[0] ?? '')
    const cubeDate = selectedWeek ? parseLaborWeekToCubeDate(selectedWeek) : null
    if (!cubeDate) return
    let cancelled = false
    setLaborCubeLoading(true)
    fetch(`/api/cube?date=${encodeURIComponent(cubeDate)}&period=weekly`, { cache: 'no-store', credentials: 'include' })
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return
        if (!json.success || !Array.isArray(json.stores)) {
          setLaborPctByStore({})
          return
        }
        const byStore: Record<string, number | null> = {}
        for (const s of json.stores as { storeNumber: string; totalLaborPct?: number | null; laborPct?: number | null }[]) {
          const sn = String(s.storeNumber)
          const pct = s.totalLaborPct ?? s.laborPct ?? null
          byStore[sn] = pct != null ? pct : null
        }
        setLaborPctByStore(byStore)
      })
      .catch(() => {
        if (!cancelled) setLaborPctByStore({})
      })
      .finally(() => {
        if (!cancelled) setLaborCubeLoading(false)
      })
    return () => { cancelled = true }
  }, [activeTab, laborData, laborSelectedWeek])

  // Forecast tab: fetch 8 current + LY (for forecastWindowStart) + HotSchedules; recalc 8 weeks on every tab open
  useEffect(() => {
    if (activeTab !== 'forecast') return
    const currentWk = getCurrentWeekNumber(FORECAST_YEAR)
    // 8 weeks ending at currentWk-1 (last completed): (currentWk-8) through (currentWk-1). When WK10 completes (currentWk=11) → WK03–WK10
    const currentWeeks = Array.from({ length: 8 }, (_, i) => `${FORECAST_YEAR}-W${String(Math.max(1, currentWk - 8 + i)).padStart(2, '0')}`)
    setForecastWeeksCurrent(currentWeeks)
    const lyWeeks = forecastLyWeekKeys(forecastWindowStart)
    const weeks = [...currentWeeks, ...lyWeeks]
    let cancelled = false
    setForecastError(null)
    setForecastLoading(true)
    const cubePromise = Promise.all(
      weeks.map((weekKey) =>
        fetch(`/api/cube?date=${encodeURIComponent(weekKey)}&period=week`, { cache: 'no-store', credentials: 'include' }).then((r) => r.json()).then((json) => ({ weekKey, json }))
      )
    )
    const hsPromise = fetch('/api/hotschedules/data', { cache: 'no-store' }).then((r) => r.json()).then((json) => json?.data ?? []).catch(() => [])
    Promise.all([cubePromise, hsPromise])
      .then(([results, hsData]) => {
        if (cancelled) return
        const byWeek: Record<string, ForecastWeekData['stores']> = {}
        for (const { weekKey, json } of results) {
          if (json?.success && Array.isArray(json.stores)) {
            byWeek[weekKey] = json.stores.map((s: { storeNumber: string; netSales?: number | null; lyNetSales?: number | null; totalLaborPct?: number | null; laborPct?: number | null }) => ({
              storeNumber: String(s.storeNumber),
              netSales: s.netSales ?? null,
              lyNetSales: s.lyNetSales ?? null,
              totalLaborPct: s.totalLaborPct ?? s.laborPct ?? null,
              laborPct: s.laborPct ?? s.totalLaborPct ?? null,
            }))
          } else {
            byWeek[weekKey] = []
          }
        }
        setForecastDataByWeek(byWeek)
        const hsRows = hsData as { store_number: string; week: string; week_bd?: string; total_scheduled_hours?: number; instore_scheduled_hours?: number; manager_scheduled_hours?: number; driver_scheduled_hours?: number }[]
        const mostRecentHsRow = hsRows.reduce<typeof hsRows[0] | null>((latest, row) => (row.week_bd != null && row.week_bd > (latest?.week_bd ?? '')) ? row : latest, null)
        const mostRecentHsWeek = mostRecentHsRow?.week ?? null
        const wk9ByStore: Record<string, number> = {}
        const wk9Rows = mostRecentHsWeek ? hsRows.filter((row) => row.week === mostRecentHsWeek) : []
        for (const row of wk9Rows) {
          const sn = row.store_number
          const total = row.total_scheduled_hours ?? ((row.instore_scheduled_hours ?? 0) + (row.manager_scheduled_hours ?? 0) + (row.driver_scheduled_hours ?? 0))
          if (total > 0) wk9ByStore[sn] = total
        }
        setForecastWk9ScheduledByStore(wk9ByStore)
      })
      .catch((err) => {
        if (!cancelled) setForecastError(err?.message ?? 'Failed to load forecast data')
      })
      .finally(() => {
        if (!cancelled) setForecastLoading(false)
      })
    return () => { cancelled = true }
  }, [activeTab, forecastWindowStart])

  // Profit tab: fetch cube monthly for each period in range, extract selected store
  useEffect(() => {
    if (activeTab !== 'analytics') return
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentPeriod = now.getMonth() + 1 // 1-12 = P1-P12

    const getPeriodsForRange = (range: 'last3' | 'last6' | 'lySame'): { year: number; period: number }[] => {
      if (range === 'last3') {
        return Array.from({ length: 3 }, (_, i) => ({ year: currentYear, period: currentPeriod - 2 + i })).filter((p) => p.period >= 1 && p.period <= 12)
      }
      if (range === 'last6') {
        const out: { year: number; period: number }[] = []
        for (let i = 5; i >= 0; i--) {
          let period = currentPeriod - i
          let year = currentYear
          while (period < 1) { period += 12; year-- }
          while (period > 12) { period -= 12; year++ }
          out.push({ year, period })
        }
        return out
      }
      // lySame: same period numbers, last year (e.g. P1, P2, P3 2025)
      return Array.from({ length: 3 }, (_, i) => ({ year: currentYear - 1, period: currentPeriod - 2 + i })).filter((p) => p.period >= 1 && p.period <= 12)
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
        .then((json): { year: number; period: number; stores: CubeStoreRow[] } => {
          const stores = json?.success && Array.isArray(json.stores) ? (json.stores as CubeStoreRow[]) : []
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
            const compPct = store && store.lyNetSales != null && store.lyNetSales > 0 && store.netSales != null
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
    return () => { cancelled = true }
  }, [activeTab, profitRange])

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

  // KPI summary row for dashboard (group totals / averages for selected stores)
  const kpiSummary = useMemo(() => {
    const selected = selectedStoresSafe
    if (selected.length === 0) return null
    if (dataSource === 'cube' && cubeData?.length) {
      const rows = selected.map((num) => cubeData.find((s) => String(s.storeNumber) === num)).filter(Boolean) as CubeStoreRow[]
      if (rows.length === 0) return null
      const totalNetSales = rows.reduce((s, r) => s + (r.netSales ?? 0), 0)
      const totalLy = rows.reduce((s, r) => s + (r.lyNetSales ?? 0), 0)
      const compPct = totalLy && totalNetSales ? ((totalNetSales - totalLy) / totalLy) * 100 : null
      const laborPcts = rows.map((r) => r.totalLaborPct ?? r.laborPct).filter((v): v is number => v != null)
      const avgLabor = laborPcts.length ? laborPcts.reduce((a, b) => a + b, 0) / laborPcts.length : null
      const foodCostPcts = rows.filter((r) => r.netSales && (r.actualFoodPct != null || (r.foodCostUsd != null))).map((r) => r.actualFoodPct ?? (r.netSales && r.foodCostUsd ? (r.foodCostUsd / r.netSales) * 100 : 0))
      const avgFood = foodCostPcts.length ? foodCostPcts.reduce((a, b) => a + b, 0) / foodCostPcts.length : null
      const flmPcts = rows.map((r) => r.flmPct).filter((v): v is number => v != null)
      const avgFlm = flmPcts.length ? flmPcts.reduce((a, b) => a + b, 0) / flmPcts.length : null
      const totalOrders = rows.reduce((s, r) => s + (r.totalOrders ?? 0), 0)
      return {
        totalNetSales,
        totalLy,
        compPct,
        avgLaborPct: avgLabor,
        avgFoodCostPct: avgFood,
        avgFlmPct: avgFlm,
        totalOrders,
        avgSmgScore: null as number | null,
      }
    }
    const reportRows = selected.flatMap((num) => reports[num] || [])
    if (reportRows.length === 0) return null
    const latestByStore = selected.map((num) => reports[num]?.[reports[num].length - 1]).filter(Boolean) as ReportPoint[]
    if (latestByStore.length === 0) return null
    const totalNetSales = latestByStore.reduce((s, r) => s + (r.net_sales ?? 0), 0)
    const avgLabor = latestByStore.reduce((s, r) => s + (r.labor_pct ?? 0), 0) / latestByStore.length
    const avgFood = latestByStore.reduce((s, r) => s + (r.food_cost_pct ?? 0), 0) / latestByStore.length
    const avgFlm = latestByStore.reduce((s, r) => s + (r.flm_pct ?? 0), 0) / latestByStore.length
    return {
      totalNetSales,
      totalLy: null,
      compPct: null,
      avgLaborPct: avgLabor,
      avgFoodCostPct: avgFood,
      avgFlmPct: avgFlm,
      totalOrders: null,
      avgSmgScore: null,
    }
  }, [dataSource, cubeData, selectedStoresSafe, reports])

  // Weekly sales trend for bottom charts row — group reports by week, last 6 weeks
  const weeklyTrendData = useMemo(() => {
    const getWeekKey = (dateStr: string) => {
      const d = new Date(dateStr)
      const day = d.getDay()
      const diff = d.getDate() - day + (day === 0 ? -6 : 1)
      const monday = new Date(d)
      monday.setDate(diff)
      return monday.toISOString().slice(0, 10)
    }
    const byWeek: Record<string, number> = {}
    selectedStoresSafe.forEach((storeNum) => {
      const pts = reports[storeNum] ?? []
      pts.forEach((r) => {
        const weekKey = getWeekKey(r.report_date)
        byWeek[weekKey] = (byWeek[weekKey] || 0) + (r.net_sales ?? 0)
      })
    })
    return Object.entries(byWeek)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([label, total]) => ({ label: label.slice(0, 10), total }))
  }, [reports, selectedStoresSafe])

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
    <div style={{ background: 'var(--bg-base, #0a0b0f)', minHeight: '100vh', color: 'var(--text-primary, #f1f3f9)' }}>
      {sessionExpired && (
        <div
          onClick={() => {
            window.location.href = '/api/reauth/live'
          }}
          style={{
            backgroundColor: '#b91c1c',
            color: '#fef2f2',
            padding: '10px 24px',
            textAlign: 'center',
            fontFamily: "'Inter', sans-serif",
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          ⚠️ Microsoft session expired — extranet login required. Click here to re-authenticate.
        </div>
      )}
      {/* Header — 56px height, compact tabs per mockup */}
      <div style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-subtle)', padding: '0 28px' }}>
        <div style={{ maxWidth: 1440, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 56 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: 7,
                background: 'var(--brand)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: "'Inter', sans-serif",
                fontSize: 11,
                fontWeight: 700,
                color: '#fff',
                letterSpacing: '0.03em',
              }}
            >
              PJ
            </div>
            <div>
              <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>Papa Johns Ops</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: "'Inter', sans-serif", fontWeight: 400, marginTop: -2 }}>
                {stores.length} store{stores.length === 1 ? '' : 's'} · Reporting
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
              style={{
                padding: '6px 13px',
                borderRadius: 6,
                border: 'none',
                cursor: 'pointer',
                fontFamily: "'Inter', sans-serif",
                fontSize: 13,
                fontWeight: activeTab === 'dashboard' ? 600 : 500,
                background: activeTab === 'dashboard' ? 'var(--brand)' : 'transparent',
                color: activeTab === 'dashboard' ? '#fff' : 'var(--text-tertiary)',
                transition: 'color 0.15s, background 0.15s',
              }}
            >
              Dashboard
            </button>
            <Link
              href="/trends"
              style={{
                padding: '6px 13px',
                borderRadius: 6,
                fontFamily: "'Inter', sans-serif",
                fontSize: 13,
                fontWeight: 500,
                background: 'transparent',
                color: 'var(--text-tertiary)',
                textDecoration: 'none',
                transition: 'color 0.15s, background 0.15s',
              }}
              className="tab-btn"
            >
              Trends
            </Link>
            {[
              ['operations', 'Operations'],
              ['analytics', 'Analytics'],
              ['forecast', 'Forecast'],
              ['live', 'Live'],
              ['guest', 'Guest'],
            ].map(([key, label]) => (
              <button
                key={key}
                onClick={() => setActiveTab(key as 'operations' | 'analytics' | 'forecast' | 'live' | 'guest')}
                className={`tab-btn ${activeTab === key ? 'active' : ''}`}
                style={{
                  padding: '6px 13px',
                  borderRadius: 6,
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 13,
                  fontWeight: activeTab === key ? 600 : 500,
                  background: activeTab === key ? 'var(--brand)' : 'transparent',
                  color: activeTab === key ? '#fff' : 'var(--text-tertiary)',
                  transition: 'color 0.15s, background 0.15s',
                }}
              >
                {label}
              </button>
            ))}
            <Link
              href="/ai"
              style={{
                padding: '6px 13px',
                borderRadius: 6,
                fontFamily: "'Inter', sans-serif",
                fontSize: 13,
                fontWeight: 500,
                background: 'transparent',
                color: 'var(--text-tertiary)',
                textDecoration: 'none',
                transition: 'color 0.15s, background 0.15s',
              }}
              className="tab-btn"
            >
              ✦ AI
            </Link>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: 'var(--text-tertiary)' }}>
              {lastUpdated ? `Updated ${lastUpdated}` : ''}
            </span>
            <span
              style={{
                padding: '3px 8px',
                borderRadius: 5,
                fontSize: 10,
                fontWeight: 500,
                fontFamily: "'JetBrains Mono', monospace",
                letterSpacing: '0.06em',
                border: '1px solid var(--border-default)',
                background: 'transparent',
                color: 'var(--text-secondary)',
              }}
            >
              {dataSource === 'cube' && activeCubeDate
                ? `CUBE · ${formatCubeDateLabel(activeCubeDate, cubePeriod)}`
                : dataSource === 'cube'
                  ? 'LIVE CUBE'
                  : isRealData
                    ? 'LIVE DATA'
                    : 'DEMO DATA'}
            </span>
          </div>
        </div>
      </div>

      {/* Alert banner — labor / EBITDA warnings (dashboard tab, when cube data loaded) */}
      {activeTab === 'dashboard' && (() => {
        const alerts: { storeName: string; message: string }[] = []
        const laborTarget = TARGETS.labor_pct ?? 28.68
        if (dataSource === 'cube' && cubeData?.length) {
          selectedStoresSafe.forEach((num) => {
            const store = stores.find((s) => s.number === num)
            const row = cubeData.find((s) => String(s.storeNumber) === num)
            if (!store || !row) return
            const laborPct = row.totalLaborPct ?? row.laborPct ?? null
            if (laborPct != null && laborPct > laborTarget) {
              alerts.push({ storeName: `${store.name} ${store.location}`, message: `Labor % at ${laborPct.toFixed(1)}% exceeds target.` })
            }
            const ebitda = row.restaurantLevelEbitda
            if (ebitda != null && ebitda < 0) {
              alerts.push({ storeName: `${store.name} ${store.location}`, message: `EBITDA negative for current period.` })
            }
          })
        }
        if (alerts.length === 0) return null
        return (
          <div
            style={{
              background: 'rgba(239,68,68,0.08)',
              borderBottom: '1px solid rgba(239,68,68,0.2)',
              padding: '9px 28px',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              flexWrap: 'wrap',
              fontSize: 12.5,
              color: '#fca5a5',
              fontFamily: "'Inter', sans-serif",
            }}
          >
            <span style={{ fontSize: 14 }}>⚠</span>
            {alerts.map((a, i) => (
              <span key={i}>
                {i > 0 && <span style={{ color: 'var(--text-tertiary)', margin: '0 4px' }}>·</span>}
                <span style={{ color: 'var(--danger-text)', fontWeight: 600 }}>{a.storeName}</span>
                {' — '}{a.message}
              </span>
            ))}
          </div>
        )
      })()}

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

      <div style={{ maxWidth: 1440, margin: '0 auto', padding: '20px 28px 40px' }}>
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
        {false && !loading && (
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

        {/* OPERATIONS TAB — Labor + Audit */}
        {!loading && activeTab === 'operations' && (
          <div className="fade-in">
            {/* Labor section (same as former Labor tab) */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <div>
                <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: 20, marginBottom: 8, color: 'var(--text-primary)' }}>HotSchedules Labor</div>
                <div style={{ fontSize: 13, color: 'var(--text-tertiary)', fontFamily: "'Inter', sans-serif", fontWeight: 400 }}>
                  Scheduled vs actual hours by store and category
                </div>
              </div>
            </div>

            {laborError && (
              <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 20, marginBottom: 24 }}>
                <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 15, marginBottom: 8, color: 'var(--danger-text)' }}>Error</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontFamily: "'Inter', sans-serif" }}>{laborError}</div>
              </div>
            )}

            {laborLoading && laborData.length === 0 && (
              <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 40, textAlign: 'center' }}>
                <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 15, color: 'var(--text-primary)', marginBottom: 8 }}>Loading labor data...</div>
                <div style={{ height: 2, borderRadius: 1, background: 'var(--bg-elevated)', width: '100%', maxWidth: 400, margin: '0 auto' }} />
              </div>
            )}

            {!laborLoading && laborData.length > 0 && (() => {
              const byStore = laborData.reduce<Record<string, HotschedulesLaborRow[]>>((acc, row) => {
                const sn = row.store_number
                if (!acc[sn]) acc[sn] = []
                acc[sn].push(row)
                return acc
              }, {})
              const weeksWithActuals = Array.from(new Set(laborData.filter((r) => (r.total_actual_hours ?? 0) > 0).map((r) => r.week))).sort((a, b) => {
                const aRow = laborData.find((r) => r.week === a)
                const bRow = laborData.find((r) => r.week === b)
                return (bRow?.week_bd ?? '').localeCompare(aRow?.week_bd ?? '')
              })
              const selectedWeek = laborSelectedWeek && weeksWithActuals.includes(laborSelectedWeek) ? laborSelectedWeek : (weeksWithActuals[0] ?? '')
              const weekRows = laborData.filter((r) => r.week === selectedWeek)
              const totalSchedWeek = weekRows.reduce((sum, r) => sum + (r.total_scheduled_hours ?? (r.instore_scheduled_hours + r.manager_scheduled_hours + r.driver_scheduled_hours)), 0)
              const totalActualWeek = weekRows.reduce((sum, r) => sum + (r.total_actual_hours ?? (r.instore_actual_hours + r.manager_actual_hours + r.driver_actual_hours)), 0)
              const varianceWeek = totalActualWeek - totalSchedWeek
              const fmtHr = (n: number) => (n != null && !Number.isNaN(n) ? n.toFixed(1) : '—')
              const variance = (s: number, a: number) => (s != null && a != null && !Number.isNaN(s) && !Number.isNaN(a) ? s - a : null)
              const storeOrder = ['2021', '2081', '2259', '2292', '2481', '3011'].filter((sn) => weekRows.some((r) => r.store_number === sn))
              return (
                <>
                  {/* Summary bar (above week dropdown) — styled like Live tab LIVE/STALE banner */}
                  <div
                    style={{
                      padding: '12px 16px',
                      marginBottom: 16,
                      borderRadius: 8,
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border-subtle)',
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      gap: 24,
                      fontFamily: "'Inter', sans-serif",
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    <span style={{ color: 'var(--text-tertiary)' }}>Total scheduled</span>
                    <span style={{ color: 'var(--text-primary)', fontFamily: "'JetBrains Mono', monospace" }}>{fmtHr(totalSchedWeek)}h</span>
                    <span style={{ color: 'var(--text-tertiary)' }}>Total actual</span>
                    <span style={{ color: 'var(--text-primary)', fontFamily: "'JetBrains Mono', monospace" }}>{fmtHr(totalActualWeek)}h</span>
                    <span style={{ color: 'var(--text-tertiary)' }}>Variance (actual − scheduled)</span>
                    <span
                      style={{
                        color: varianceWeek > 0 ? 'var(--danger-text)' : varianceWeek < 0 ? 'var(--success-text)' : 'var(--text-secondary)',
                        fontFamily: "'JetBrains Mono', monospace",
                      }}
                    >
                      {varianceWeek >= 0 ? '+' : ''}{fmtHr(varianceWeek)}h
                    </span>
                    <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 400, color: 'var(--text-tertiary)' }}>
                      Data synced daily from HotSchedules via Tableau
                    </span>
                  </div>

                  {/* Week selector */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', fontFamily: "'Inter', sans-serif'" }}>Week:</span>
                    <select
                      value={selectedWeek}
                      onChange={(e) => setLaborSelectedWeek(e.target.value)}
                      style={{
                        padding: '8px 12px',
                        borderRadius: 8,
                        border: '1px solid var(--border-subtle)',
                        background: 'var(--bg-surface)',
                        color: 'var(--text-primary)',
                        fontFamily: "'Inter', sans-serif",
                        fontSize: 13,
                        fontWeight: 500,
                        minWidth: 140,
                      }}
                    >
                      {weeksWithActuals.map((w) => (
                        <option key={w} value={w}>{w}</option>
                      ))}
                    </select>
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))',
                      gap: 16,
                    }}
                  >
                    {storeOrder.map((storeNum) => {
                      const current = weekRows.find((r) => r.store_number === storeNum)
                      if (!current) return null
                      const storeIdx = parseInt(storeNum, 10) % STORE_COLORS.length
                      const storeColor = STORE_COLORS[storeIdx]
                      const vInstore = variance(current.instore_scheduled_hours, current.instore_actual_hours)
                      const vManager = variance(current.manager_scheduled_hours, current.manager_actual_hours)
                      const vDriver = variance(current.driver_scheduled_hours, current.driver_actual_hours)
                      const totalSched = (current.total_scheduled_hours ?? (current.instore_scheduled_hours + current.manager_scheduled_hours + current.driver_scheduled_hours))
                      const totalActual = (current.total_actual_hours ?? (current.instore_actual_hours + current.manager_actual_hours + current.driver_actual_hours))
                      const vTotal = totalSched != null && totalActual != null ? totalSched - totalActual : null
                      const borderColor = totalActual > totalSched ? 'var(--danger-text)' : totalActual < totalSched ? 'var(--success-text)' : 'var(--border-subtle)'
                      const rowsForStore = byStore[storeNum] ?? []
                      const sortedStore = [...rowsForStore].sort((a, b) => (b.week_bd || '').localeCompare(a.week_bd || ''))
                      const trendData = sortedStore
                        .slice(0, 8)
                        .reverse()
                        .map((r) => ({
                          week: r.week,
                          scheduled: r.total_scheduled_hours ?? (r.instore_scheduled_hours + r.manager_scheduled_hours + r.driver_scheduled_hours),
                          actual: r.total_actual_hours ?? (r.instore_actual_hours + r.manager_actual_hours + r.driver_actual_hours),
                        }))
                        .filter((d) => d.scheduled !== 0 || d.actual !== 0)
                      const showTrend = laborTrendStore === storeNum
                      return (
                        <div
                          key={storeNum}
                          style={{
                            background: 'var(--bg-surface)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: 12,
                            padding: 20,
                            position: 'relative',
                            overflow: 'hidden',
                          }}
                        >
                          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: borderColor }} />
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                            <div>
                              <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 15, color: 'var(--text-primary)' }}>Store {storeNum}</div>
                              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2, fontFamily: "'Inter', sans-serif", fontWeight: 400 }}>{current.week}</div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <button
                                type="button"
                                onClick={() => setLaborTrendStore(showTrend ? null : storeNum)}
                                style={{
                                  padding: '6px 12px',
                                  borderRadius: 6,
                                  border: '1px solid var(--border-subtle)',
                                  background: showTrend ? 'var(--bg-overlay)' : 'transparent',
                                  color: 'var(--text-secondary)',
                                  fontSize: 11,
                                  fontWeight: 600,
                                  fontFamily: "'Inter', sans-serif",
                                  cursor: 'pointer',
                                }}
                              >
                                {showTrend ? 'Hide Trend' : 'Show Trend'}
                              </button>
                              <div style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--bg-overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: storeColor, fontWeight: 500 }}>
                                {storeNum.slice(-2)}
                              </div>
                            </div>
                          </div>
                          <div style={{ display: 'grid', gap: 10, fontSize: 12, fontFamily: "'Inter', sans-serif'" }}>
                            {[
                              { label: 'Instore', sched: current.instore_scheduled_hours, actual: current.instore_actual_hours, v: vInstore },
                              { label: 'Manager', sched: current.manager_scheduled_hours, actual: current.manager_actual_hours, v: vManager },
                              { label: 'Driver', sched: current.driver_scheduled_hours, actual: current.driver_actual_hours, v: vDriver },
                            ].map(({ label, sched, actual, v }) => (
                              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--bg-base)', borderRadius: 8 }}>
                                <span style={{ color: 'var(--text-tertiary)', fontWeight: 500 }}>{label}</span>
                                <span style={{ color: 'var(--text-primary)' }}>Sched: {fmtHr(sched)}h</span>
                                <span style={{ color: 'var(--text-primary)' }}>Actual: {fmtHr(actual)}h</span>
                                <span style={{ color: v != null ? (v < 0 ? 'var(--danger-text)' : v > 0 ? 'var(--success-text)' : 'var(--text-primary)') : 'var(--text-primary)', fontWeight: 600 }}>
                                  {v != null ? (v >= 0 ? `+${fmtHr(v)}` : fmtHr(v)) : '—'}h
                                </span>
                              </div>
                            ))}
                          </div>
                          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: "'Inter', sans-serif", fontWeight: 600, letterSpacing: '0.08em' }}>TOTAL</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                              <span style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-primary)' }}>{fmtHr(totalSched)}h sched</span>
                              <span style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-primary)' }}>{fmtHr(totalActual)}h actual</span>
                              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, color: vTotal != null ? (vTotal < 0 ? 'var(--danger-text)' : vTotal > 0 ? 'var(--success-text)' : 'var(--text-primary)') : 'var(--text-primary)' }}>
                                {vTotal != null ? (vTotal >= 0 ? `+${fmtHr(vTotal)}` : fmtHr(vTotal)) : '—'}h
                              </span>
                            </div>
                          </div>
                          {/* Labor % from cube (weekly) for selected week */}
                          <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: "'Inter', sans-serif", fontWeight: 600, letterSpacing: '0.08em' }}>LABOR %</span>
                            {laborCubeLoading ? (
                              <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>—</span>
                            ) : (
                              <span
                                style={{
                                  fontSize: 13,
                                  fontWeight: 600,
                                  fontFamily: "'JetBrains Mono', monospace",
                                  color: (() => {
                                    const pct = laborPctByStore[storeNum]
                                    if (pct == null) return 'var(--text-primary)'
                                    return pct > 28 ? 'var(--danger-text)' : 'var(--success-text)'
                                  })(),
                                }}
                              >
                                {laborPctByStore[storeNum] != null ? `${laborPctByStore[storeNum]}%` : '—'}
                              </span>
                            )}
                          </div>
                          {showTrend && trendData.length > 0 && (
                            <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border-subtle)', height: 120 }}>
                              <ResponsiveContainer width="100%" height={120}>
                                <LineChart data={trendData} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
                                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                                  <XAxis dataKey="week" tick={{ fontSize: 9, fill: 'var(--text-tertiary)' }} />
                                  <YAxis tick={{ fontSize: 9, fill: 'var(--text-tertiary)' }} width={28} />
                                  <Tooltip contentStyle={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, fontSize: 11 }} />
                                  <Line type="monotone" dataKey="scheduled" stroke="#3b82f6" strokeWidth={2} dot={false} name="Scheduled" />
                                  <Line type="monotone" dataKey="actual" stroke="#f97316" strokeWidth={2} dot={false} name="Actual" />
                                </LineChart>
                              </ResponsiveContainer>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </>
              )
            })()}

            {!laborLoading && laborData.length === 0 && !laborError && (
              <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 40, textAlign: 'center' }}>
                <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 15, color: 'var(--text-primary)', marginBottom: 8 }}>No labor data yet</div>
                <div style={{ fontSize: 13, color: 'var(--text-tertiary)', fontFamily: "'Inter', sans-serif" }}>
                  Data is synced from Tableau once daily. Run the scraper job or wait for the next sync.
                </div>
              </div>
            )}

            {/* Section divider */}
            <div style={{ borderTop: '1px solid var(--border-subtle)', margin: '32px 0' }} />
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 16, fontFamily: "'Inter', sans-serif" }}>
              Audit — Zero, Bad & Canceled Orders
            </div>

            {/* SECTION 2 — AUDIT */}
            <div style={{ marginBottom: 20 }}>
              <AuditUpload
                selectedTimePeriod={auditPeriod}
                onUploadComplete={() => {
                  setAuditRefreshKey((k) => k + 1)
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid var(--border-subtle)', paddingBottom: 0 }}>
              {[
                { value: 'current_period' as const, label: 'Current Period' },
                { value: 'last_period' as const, label: 'Last Period' },
                { value: 'last_year' as const, label: 'Last Year' },
              ].map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setAuditPeriod(tab.value)}
                  style={{
                    padding: '10px 20px',
                    borderRadius: 8,
                    border: 'none',
                    fontFamily: "'Inter', sans-serif",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                    background: auditPeriod === tab.value ? 'var(--brand)' : 'transparent',
                    color: auditPeriod === tab.value ? '#fff' : 'var(--text-tertiary)',
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div style={{ marginBottom: 24 }}>
              <AuditSummaryComparisonTable period={auditPeriod} refreshKey={auditRefreshKey} />
            </div>
            <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid var(--border-subtle)' }}>
              {(['summary', 'details', 'fraud'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setAuditTab(tab)}
                  style={{
                    padding: '10px 20px',
                    borderRadius: 8,
                    border: 'none',
                    fontFamily: "'Inter', sans-serif",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                    background: auditTab === tab ? 'var(--brand)' : 'transparent',
                    color: auditTab === tab ? '#fff' : 'var(--text-tertiary)',
                  }}
                >
                  {tab === 'summary' ? 'Summary' : tab === 'details' ? 'Details' : 'Fraud Flags'}
                </button>
              ))}
            </div>
            {auditTab === 'summary' && (
              <AuditSummaryTable timePeriod={auditPeriod} refreshKey={auditRefreshKey} />
            )}
            {auditTab === 'details' && (
              <AuditDetailsTable
                timePeriod={auditPeriod}
                refreshKey={auditRefreshKey}
                initialStore={auditDetailsFilter.store}
                initialManager={auditDetailsFilter.manager}
              />
            )}
            {auditTab === 'fraud' && (
              <FraudFlags
                timePeriod={auditPeriod}
                onViewDetails={(storeNumber, managerName) => {
                  setAuditDetailsFilter({ store: storeNumber, manager: managerName })
                  setAuditTab('details')
                }}
              />
            )}
          </div>
        )}

        {/* FORECAST TAB */}
        {!loading && activeTab === 'forecast' && (
          <div className="fade-in">
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: 20, marginBottom: 8, color: 'var(--text-primary)' }}>Sales & Labor Forecast</div>
              <div style={{ fontSize: 13, color: 'var(--text-tertiary)', fontFamily: "'Inter', sans-serif", fontWeight: 400 }}>
                {`Next 2 weeks at a time, projected from LY same-week sales × current 4-week comp trend (WK${Math.max(1, getCurrentWeekNumber(FORECAST_YEAR) - 4)}–WK${Math.max(1, getCurrentWeekNumber(FORECAST_YEAR) - 1)})`}
              </div>
            </div>

            {forecastLoading && (
              <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 40, textAlign: 'center' }}>
                <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 15, color: 'var(--text-primary)', marginBottom: 12 }}>Loading forecast data…</div>
                <div style={{ width: 24, height: 24, border: '2px solid var(--brand)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto' }} />
              </div>
            )}

            {forecastError && !forecastLoading && (
              <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 20, marginBottom: 24 }}>
                <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 15, marginBottom: 8, color: 'var(--danger-text)' }}>Error</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontFamily: "'Inter', sans-serif" }}>{forecastError}</div>
              </div>
            )}

            {!forecastLoading && !forecastError && Object.keys(forecastDataByWeek).length > 0 && forecastWeeksCurrent.length > 0 && (() => {
              const STORE_ORDER = ['2021', '2081', '2259', '2292', '2481', '3011']
              const currentWk = getCurrentWeekNumber(FORECAST_YEAR)
              const last4Weeks = Array.from({ length: 4 }, (_, i) => `${FORECAST_YEAR}-W${String(Math.max(1, currentWk - 4 + i)).padStart(2, '0')}`)
              const lyWeekKeys = forecastLyWeekKeys(forecastWindowStart)

              const getStoreInWeek = (weekKey: string, storeNum: string) => {
                const arr = forecastDataByWeek[weekKey]
                if (!arr) return null
                return arr.find((s) => String(s.storeNumber) === storeNum) ?? null
              }

              const compPctDefault = -15

              const linearTrendFallback = (storeNum: string, numWeeks: number): number[] => {
                const sales: number[] = []
                for (const w of forecastWeeksCurrent) {
                  const s = getStoreInWeek(w, storeNum)
                  const n = s?.netSales
                  if (n != null && !Number.isNaN(n)) sales.push(n)
                }
                if (sales.length < 2 || numWeeks <= 0) return Array(numWeeks).fill(0)
                const n = sales.length
                let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0
                for (let i = 0; i < n; i++) {
                  sumX += i
                  sumY += sales[i]
                  sumXY += i * sales[i]
                  sumX2 += i * i
                }
                const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX) || 0
                const intercept = (sumY - slope * sumX) / n
                return Array.from({ length: numWeeks }, (_, i) => Math.max(0, intercept + slope * (n + i)))
              }

              const storeResults: Array<{
                storeNum: string
                compPct: number
                adjustedComp: number
                lySales: (number | null)[]
                lyFallback: boolean
                projSales: number[]
                avgLaborPct: number
                projLabor: number[]
                sparklineActual: number[]
                sparklineProj: number[]
              }> = []

              for (const storeNum of STORE_ORDER) {
                const compPcts: number[] = []
                for (const w of last4Weeks) {
                  const s = getStoreInWeek(w, storeNum)
                  const net = s?.netSales ?? 0
                  const ly = s?.lyNetSales
                  if (ly != null && ly > 0) compPcts.push(((net - ly) / ly) * 100)
                }
                const compPct = compPcts.length > 0 ? compPcts.reduce((a, b) => a + b, 0) / compPcts.length : compPctDefault
                const compMultiplier = storeNum === '2481' ? 0.50 : 0.7
                const adjustedComp = compPct * compMultiplier

                const lySales: (number | null)[] = lyWeekKeys.map((key) => {
                  const s = getStoreInWeek(key, storeNum)
                  return s?.netSales != null ? s.netSales : null
                })
                const fallback = linearTrendFallback(storeNum, lyWeekKeys.length)
                let lyFallback = false
                const resolvedLy = lySales.map((val, i) => {
                  if (val != null) return val
                  lyFallback = true
                  return fallback[i] ?? 0
                })

                const projSales = resolvedLy.map((ly) => (ly ?? 0) * (1 + adjustedComp / 100))

                const laborPcts: number[] = []
                for (const w of last4Weeks) {
                  const s = getStoreInWeek(w, storeNum)
                  const p = s?.totalLaborPct ?? s?.laborPct
                  if (p != null && !Number.isNaN(p)) laborPcts.push(p)
                }
                const avgLaborPct = laborPcts.length > 0 ? laborPcts.reduce((a, b) => a + b, 0) / laborPcts.length : 0

                const projLabor = projSales.map((sales) => sales * (avgLaborPct / 100))

                storeResults.push({
                  storeNum,
                  compPct,
                  adjustedComp,
                  lySales,
                  lyFallback,
                  projSales,
                  avgLaborPct,
                  projLabor,
                  sparklineActual: forecastWeeksCurrent.map((w) => getStoreInWeek(w, storeNum)?.netSales ?? 0),
                  sparklineProj: projSales,
                })
              }

              const totalProjByWeek = (() => {
                const len = lyWeekKeys.length
                const i0 = len - 2
                const i1 = len - 1
                return [
                  storeResults.reduce((s, r) => s + (r.projSales[i0] ?? 0), 0),
                  storeResults.reduce((s, r) => s + (r.projSales[i1] ?? 0), 0),
                ]
              })()
              const avgComp = storeResults.length > 0 ? storeResults.reduce((s, r) => s + r.compPct, 0) / storeResults.length : 0

              const fmtUsd = (n: number) => `$${Math.round(n).toLocaleString()}`
              const fmtPct = (n: number) => `${n >= 0 ? '' : ''}${n.toFixed(1)}%`

              return (
                <>
                  <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '12px 16px', marginBottom: 12, fontFamily: "'Inter', sans-serif", fontSize: 13 }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                      Forecasting WK{forecastWindowStart}–WK{forecastWindowStart + 1} {FORECAST_YEAR} • Total projected: {fmtUsd(totalProjByWeek[0])} (WK{forecastWindowStart}) | {fmtUsd(totalProjByWeek[1])} (WK{forecastWindowStart + 1})
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
                      Comp trend adjusted to 70% to account for mean reversion
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                    {storeResults.map((r) => {
                      const storeIdx = parseInt(r.storeNum, 10) % STORE_COLORS.length
                      const storeColor = STORE_COLORS[storeIdx]
                      const currentIdx0 = lyWeekKeys.length - 2
                      const currentIdx1 = lyWeekKeys.length - 1
                      const chartData = [
                        ...forecastWeeksCurrent.map((w, i) => ({
                          week: `WK${w.split('-W')[1] ?? String(i + 1).padStart(2, '0')}`,
                          actual: r.sparklineActual[i],
                          projDim: null as number | null,
                          projBright: null as number | null,
                        })),
                        ...r.projSales.map((val, i) => {
                          const weekNum = minForecastWindowStart + i
                          const currentWkNum = getCurrentWeekNumber(FORECAST_YEAR)
                          const isProjected = weekNum >= currentWkNum
                          const isCurrentView = weekNum >= forecastWindowStart && weekNum <= forecastWindowStart + 1
                          return {
                            week: `WK${weekNum}`,
                            actual: isProjected ? null : (val as number | null),
                            projDim: isProjected && !isCurrentView ? val : null,
                            projBright: isProjected && isCurrentView ? val : null,
                          }
                        }),
                      ]
                      return (
                        <div
                          key={r.storeNum}
                          style={{
                            background: 'var(--bg-surface)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: 12,
                            padding: 10,
                            position: 'relative',
                            overflow: 'hidden',
                          }}
                        >
                          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: storeColor }} />
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>Store {r.storeNum}</span>
                              <span style={{ width: 24, height: 24, borderRadius: 6, background: 'var(--bg-overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: storeColor, fontWeight: 500 }}>
                                {r.storeNum.slice(-2)}
                              </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <button
                                type="button"
                                disabled={forecastWindowStart <= minForecastWindowStart}
                                onClick={() => setForecastWindowStart((w) => Math.max(minForecastWindowStart, w - 2))}
                                style={{
                                  padding: '4px 6px',
                                  border: 'none',
                                  borderRadius: 6,
                                  background: forecastWindowStart <= minForecastWindowStart ? 'var(--bg-overlay)' : 'var(--bg-base)',
                                  color: forecastWindowStart <= minForecastWindowStart ? 'var(--text-tertiary)' : 'var(--text-primary)',
                                  fontSize: 14,
                                  cursor: forecastWindowStart <= minForecastWindowStart ? 'not-allowed' : 'pointer',
                                  lineHeight: 1,
                                }}
                                aria-label="Previous 2 weeks"
                              >
                                ←
                              </button>
                              <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 12, color: 'var(--text-secondary)', minWidth: 100, textAlign: 'center' }}>
                                WK{forecastWindowStart}–WK{forecastWindowStart + 1} {FORECAST_YEAR}
                              </span>
                              <button
                                type="button"
                                onClick={() => setForecastWindowStart((w) => w + 2)}
                                style={{
                                  padding: '4px 6px',
                                  border: 'none',
                                  borderRadius: 6,
                                  background: 'var(--bg-base)',
                                  color: 'var(--text-primary)',
                                  fontSize: 14,
                                  cursor: 'pointer',
                                  lineHeight: 1,
                                }}
                                aria-label="Next 2 weeks"
                              >
                                →
                              </button>
                            </div>
                          </div>
                          {r.lyFallback && (
                            <div style={{ fontSize: 9, color: 'var(--warning-text)', marginBottom: 4, fontFamily: "'Inter', sans-serif'" }}>LY data unavailable — using trend</div>
                          )}
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, minWidth: 0 }}>
                            {[currentIdx0, currentIdx1].map((idx) => (
                              <div key={idx} style={{ background: 'var(--bg-base)', borderRadius: 8, padding: 8 }}>
                                <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 4, fontFamily: "'Inter', sans-serif", letterSpacing: '0.04em' }}>{`WK${minForecastWindowStart + idx} ${FORECAST_YEAR}`}</div>
                                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: "'Inter', sans-serif", marginBottom: 6 }}>
                                  LY {r.lySales[idx] != null ? fmtUsd(r.lySales[idx]) : '—'}  •  Comp {fmtPct(r.compPct)}  →  Applied {fmtPct(r.adjustedComp)}
                                </div>
                                <div style={{ marginBottom: 6 }}>
                                  <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '0.06em', fontFamily: "'Inter', sans-serif'" }}>PROJ SALES</div>
                                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 20, fontWeight: 700, color: '#fff' }}>{fmtUsd(r.projSales[idx])}</span>
                                    <span style={{ color: 'var(--danger-text)', fontSize: 14 }}>↓</span>
                                  </div>
                                </div>
                                <div style={{ height: 1, background: 'var(--border-subtle)', margin: '6px 0' }} />
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 9, fontFamily: "'Inter', sans-serif'", color: 'var(--text-tertiary)' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ letterSpacing: '0.04em', fontWeight: 600 }}>VARIANCE</span>
                                    <Lock size={12} style={{ color: 'var(--text-tertiary)', opacity: 0.5 }} />
                                  </div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ letterSpacing: '0.04em', fontWeight: 600 }}>PROJ LABOR $</span>
                                    <Lock size={12} style={{ color: 'var(--text-tertiary)', opacity: 0.5 }} />
                                  </div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ letterSpacing: '0.04em', fontWeight: 600 }}>HOURS NEEDED</span>
                                    <Lock size={12} style={{ color: 'var(--text-tertiary)', opacity: 0.5 }} />
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                          <div style={{ marginTop: 8, height: 80 }}>
                            <ResponsiveContainer width="100%" height={80}>
                              <LineChart data={chartData} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                                <XAxis dataKey="week" tick={{ fontSize: 8, fill: 'var(--text-tertiary)' }} />
                                <YAxis tick={{ fontSize: 8, fill: 'var(--text-tertiary)' }} width={28} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                                <Tooltip contentStyle={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, fontSize: 10 }} formatter={(val: number | undefined) => [val != null ? fmtUsd(val) : '—', '']} />
                                <Line type="monotone" dataKey="actual" stroke="#3b82f6" strokeWidth={2} dot={false} name="Actual" connectNulls />
                                <Line type="monotone" dataKey="projDim" stroke="#f97316" strokeWidth={1.5} strokeDasharray="4 4" strokeOpacity={0.5} dot={false} name="Projected (prior)" connectNulls />
                                <Line type="monotone" dataKey="projBright" stroke="#f97316" strokeWidth={2.5} strokeDasharray="4 4" dot={false} name="Projected" connectNulls />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </>
              )
            })()}
          </div>
        )}

        {/* ANALYTICS TAB — Profitability content + Profit (P&L), no nested nav */}
        {!loading && activeTab === 'analytics' && (
          <div className="fade-in">
            <ProfitabilityContent />
            <div style={{ borderTop: '1px solid var(--border-subtle)', margin: '32px 0' }} />
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 16, fontFamily: "'Inter', sans-serif" }}>
              Profit & EBITDA
            </div>
            <div style={{ marginTop: 0 }}>
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '16px 20px', marginBottom: 24, display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: "'Inter', sans-serif", fontWeight: 600, letterSpacing: '0.12em', marginBottom: 6 }}>STORE</div>
                <select
                  value={profitStore}
                  onChange={(e) => setProfitStore(e.target.value)}
                  style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-default)', background: 'var(--bg-overlay)', color: 'var(--text-primary)', fontFamily: "'Inter', sans-serif", fontSize: 13, minWidth: 140 }}
                >
                  <option value={PROFIT_STORE_ALL}>All Stores</option>
                  {PROFIT_STORES.map((s) => (
                    <option key={s} value={s}>{s} {PROFIT_STORE_NAMES[s] ?? ''}</option>
                  ))}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: "'Inter', sans-serif", fontWeight: 600, letterSpacing: '0.12em', marginBottom: 6 }}>RANGE</div>
                <div style={{ display: 'flex', gap: 4, background: 'var(--bg-overlay)', borderRadius: 8, padding: 4, border: '1px solid var(--border-subtle)' }}>
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
              <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 40, textAlign: 'center', marginBottom: 24 }}>
                <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 15, color: 'var(--text-primary)', marginBottom: 12 }}>Loading…</div>
                <div style={{ width: 24, height: 24, border: '2px solid var(--brand)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto' }} />
              </div>
            )}

            {!profitLoading && (() => {
              const isAllStores = profitStore === PROFIT_STORE_ALL
              const singleStoreData = (profitTrendDataByStore[profitStore] ?? []) as ProfitTrendPoint[]
              const allStoresHaveData = PROFIT_STORES.every((s) => (profitTrendDataByStore[s] ?? []).length > 0)
              const hasData = isAllStores ? allStoresHaveData : singleStoreData.length > 0
              if (!hasData) return null
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
              const allDollars = dataForChart.flatMap((d) => [d.netSales ?? 0, d.restaurantLevelEbitda ?? 0].filter((v) => !Number.isNaN(v)))
              const maxDollar = Math.max(0, ...allDollars)
              const minDollar = Math.min(0, ...allDollars)
              const dollarMax = maxDollar > 0 ? Math.ceil(maxDollar / 10000) * 10000 + 5000 : 100000
              const dollarMin = minDollar < 0 ? Math.floor(minDollar / 10000) * 10000 - 5000 : 0
              const fmtUsd = (n: number | null | undefined) => (n != null && !Number.isNaN(n) ? `$${Math.round(n).toLocaleString()}` : '—')
              const fmtPct = (n: number | null | undefined) => (n != null && !Number.isNaN(n) ? `${n.toFixed(1)}%` : '—')
              const metricPills = [
                { key: 'netSales' as const, label: 'Net Sales', color: '#22c55e' },
                { key: 'ebitda' as const, label: 'EBITDA', color: '#3b82f6' },
                { key: 'labor' as const, label: 'Labor %', color: '#ef4444' },
                { key: 'foodCost' as const, label: 'Food Cost %', color: '#f97316' },
                { key: 'flm' as const, label: 'FLM %', color: '#eab308' },
              ]
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {/* 1) Metric toggles — at top */}
                  <div style={{ order: 0, marginBottom: 12 }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {metricPills.map(({ key, label, color }) => (
                        <button
                          key={key}
                          onClick={() => setProfitMetricToggles((t) => ({ ...t, [key]: !t[key] }))}
                          style={{
                            padding: '6px 12px',
                            borderRadius: 20,
                            border: `1px solid ${profitMetricToggles[key] ? color : 'var(--border-subtle)'}`,
                            background: profitMetricToggles[key] ? color : 'var(--bg-overlay)',
                            color: profitMetricToggles[key] ? '#fff' : 'var(--text-tertiary)',
                            fontFamily: "'Inter', sans-serif",
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 2) LATEST PERIOD summary card — before chart (single store only) */}
                  {!isAllStores && (() => {
                    const previous = dataForChart.length >= 2 ? dataForChart[dataForChart.length - 2] : null
                    const vs = (curr: number | null | undefined, prev: number | null | undefined, higherIsBetter: boolean) => {
                      if (curr == null || prev == null || Number.isNaN(curr) || Number.isNaN(prev)) return { arrow: '', color: 'var(--text-primary)' as const }
                      const improved = higherIsBetter ? curr > prev : curr < prev
                      const same = curr === prev
                      if (same) return { arrow: '', color: 'var(--text-primary)' as const }
                      return { arrow: improved ? ' ↑' : ' ↓', color: improved ? 'var(--success-text)' as const : 'var(--danger-text)' as const }
                    }
                    const netSalesVs = vs(latest?.netSales ?? null, previous?.netSales ?? null, true)
                    const ebitdaCurr = latest?.restaurantLevelEbitda ?? null
                    const ebitdaPrev = previous?.restaurantLevelEbitda ?? null
                    const ebitdaVs = (() => {
                      if (ebitdaCurr == null) return { arrow: '', color: 'var(--text-primary)' as const }
                      const improved = ebitdaPrev != null && !Number.isNaN(ebitdaPrev) ? ebitdaCurr > ebitdaPrev : false
                      const same = ebitdaPrev != null && ebitdaCurr === ebitdaPrev
                      const ebitdaColor = ebitdaCurr >= 0 ? 'var(--success-text)' as const : 'var(--danger-text)' as const
                      if (same) return { arrow: '', color: ebitdaColor }
                      return { arrow: improved ? ' ↑' : ' ↓', color: improved ? 'var(--success-text)' as const : 'var(--danger-text)' as const }
                    })()
                    const laborVs = vs(latest?.laborPct ?? null, previous?.laborPct ?? null, false)
                    const foodVs = vs(latest?.foodCostPct ?? null, previous?.foodCostPct ?? null, false)
                    const flmVs = vs(latest?.flmPct ?? null, previous?.flmPct ?? null, true)
                    const compVs = vs(latest?.compPct ?? null, previous?.compPct ?? null, true)
                    return (
                      <div style={{ order: 1, background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 12, padding: '20px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.12)', marginBottom: 24 }}>
                        <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: "'Inter', sans-serif", fontWeight: 600, letterSpacing: '0.12em', marginBottom: 12 }}>LATEST PERIOD — {latest?.periodLabel ?? '—'}{previous ? ` vs ${previous.periodLabel}` : ''}</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'center' }}>
                          <div>
                            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 4 }}>NET SALES</div>
                            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 18, fontWeight: 700, color: netSalesVs.color }}>{fmtUsd(latest?.netSales)}{netSalesVs.arrow}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 4 }}>EBITDA</div>
                            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 18, fontWeight: 700, color: ebitdaCurr != null ? (ebitdaCurr >= 0 ? 'var(--success-text)' : 'var(--danger-text)') : 'var(--text-primary)' }}>{fmtUsd(latest?.restaurantLevelEbitda)}{ebitdaVs.arrow && <span style={{ color: ebitdaVs.color }}>{ebitdaVs.arrow}</span>}</div>
                            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontStyle: 'italic', marginTop: 4 }}>* EBITDA is a rolling total, not period-specific</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 4 }}>LABOR %</div>
                            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 18, fontWeight: 700, color: laborVs.color }}>{fmtPct(latest?.laborPct)}{laborVs.arrow}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 4 }}>FOOD COST %</div>
                            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 18, fontWeight: 700, color: foodVs.color }}>{fmtPct(latest?.foodCostPct)}{foodVs.arrow}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 4 }}>FLM %</div>
                            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 18, fontWeight: 700, color: flmVs.color }}>{fmtPct(latest?.flmPct)}{flmVs.arrow}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 4 }}>COMP %</div>
                            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 18, fontWeight: 700, color: compVs.color }}>{latest?.compPct != null ? `${latest.compPct.toFixed(1)}%` : '—'}{compVs.arrow}</div>
                          </div>
                        </div>
                      </div>
                    )
                  })()}

                  {/* 3) Chart — after summary */}
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
                        const miniDollars = miniData.flatMap((d) => [d.netSales ?? 0, d.restaurantLevelEbitda ?? 0].filter((v) => !Number.isNaN(v)))
                        const miniMax = Math.max(0, ...miniDollars)
                        const miniMin = Math.min(0, ...miniDollars)
                        const miniDollarMax = miniMax > 0 ? Math.ceil(miniMax / 10000) * 10000 + 5000 : 100000
                        const miniDollarMin = miniMin < 0 ? Math.floor(miniMin / 10000) * 10000 - 5000 : 0
                        return (
                          <div key={storeNum} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 12 }}>
                            <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', marginBottom: 8 }}>{PROFIT_STORE_NAMES[storeNum] ?? storeNum}</div>
                            <div style={{ height: 200 }}>
                              <ResponsiveContainer width="100%" height={200}>
                                <ComposedChart data={miniData} margin={{ top: 8, right: 8, left: 4, bottom: 4 }}>
                                  <CartesianGrid strokeDasharray="2 2" stroke="var(--border-subtle)" />
                                  <XAxis dataKey="periodLabel" tick={{ fontSize: 9, fill: 'var(--text-secondary)' }} />
                                  <YAxis yAxisId="left" orientation="left" domain={[miniDollarMin, miniDollarMax]} tick={{ fontSize: 8, fill: 'var(--text-tertiary)' }} tickFormatter={(v) => (v >= 1000 || v <= -1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`)} />
                                  <YAxis yAxisId="right" orientation="right" domain={[-50, 100]} tick={{ fontSize: 8, fill: 'var(--text-tertiary)' }} tickFormatter={(v) => `${v}%`} />
                                  <Tooltip contentStyle={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, fontSize: 11 }} formatter={(v: unknown) => [typeof v === 'number' && !Number.isNaN(v) ? (Math.abs(v) >= 100 ? `$${Math.round(v).toLocaleString()}` : `${v.toFixed(1)}%`) : '—', '']} />
                                  {profitMetricToggles.netSales && <Line yAxisId="left" type="monotone" dataKey="netSales" name="Net Sales" stroke="#22c55e" strokeWidth={1.5} dot={{ r: 3 }} connectNulls />}
                                  {profitMetricToggles.ebitda && <Line yAxisId="left" type="monotone" dataKey="restaurantLevelEbitda" name="EBITDA" stroke="#3b82f6" strokeWidth={1.5} dot={{ r: 3 }} connectNulls />}
                                  {profitMetricToggles.labor && <Line yAxisId="right" type="monotone" dataKey="laborPct" name="Labor %" stroke="#ef4444" strokeWidth={1.5} dot={{ r: 3 }} connectNulls />}
                                  {profitMetricToggles.foodCost && <Line yAxisId="right" type="monotone" dataKey="foodCostPct" name="Food Cost %" stroke="#f97316" strokeWidth={1.5} dot={{ r: 3 }} connectNulls />}
                                  {profitMetricToggles.flm && <Line yAxisId="right" type="monotone" dataKey="flmPct" name="FLM %" stroke="#eab308" strokeWidth={1.5} strokeDasharray="4 4" dot={{ r: 3 }} connectNulls />}
                                </ComposedChart>
                              </ResponsiveContainer>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                  <div style={{ order: 2, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 16, marginBottom: 24 }}>
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: 18, color: 'var(--text-primary)' }}>{storeName} — Trailing {nPeriods} Periods</div>
                      <div style={{ fontSize: 12, color: 'var(--text-tertiary)', fontFamily: "'Inter', sans-serif", marginTop: 4 }}>Net Income vs. Controllables</div>
                    </div>
                    <div style={{ height: 420 }}>
                      <ResponsiveContainer width="100%" height={420}>
                        <ComposedChart data={chartData} margin={{ top: 24, right: 24, left: 8, bottom: 8 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                          <XAxis dataKey="periodLabel" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
                          <YAxis yAxisId="left" orientation="left" domain={[dollarMin, dollarMax]} tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} tickFormatter={(v) => (v >= 1000 || v <= -1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`)} />
                          <YAxis yAxisId="right" orientation="right" domain={[-50, 100]} tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} tickFormatter={(v) => `${v}%`} />
                          <ReferenceLine yAxisId="left" y={0} stroke="var(--border-default)" strokeDasharray="2 2" />
                          <Tooltip
                            contentStyle={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, fontSize: 12 }}
                            content={({ active, payload }) => {
                              if (!active || !payload?.length) return null
                              const p = payload[0]?.payload as typeof chartData[0]
                              if (!p) return null
                              return (
                                <div style={{ padding: 6 }}>
                                  <div style={{ fontWeight: 600, marginBottom: 6 }}>{p.periodLabel}</div>
                                  {profitMetricToggles.netSales && <div>Net Sales: {fmtUsd(p.netSales)}</div>}
                                  {profitMetricToggles.ebitda && (
                                    <div>
                                      <div>EBITDA: {fmtUsd(p.restaurantLevelEbitda)}</div>
                                      <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontStyle: 'italic', marginTop: 2 }}>EBITDA data is not period-filtered — shown as reference only</div>
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
                            <Line yAxisId="left" type="monotone" dataKey="netSales" name="Net Sales" stroke="#22c55e" strokeWidth={2} dot={{ r: 4 }} connectNulls>
                              <LabelList dataKey="netSales" position="top" formatter={(v: unknown) => (typeof v === 'number' && !Number.isNaN(v) ? `$${Math.round(v).toLocaleString()}` : '')} />
                            </Line>
                          )}
                          {profitMetricToggles.ebitda && (
                            <Line yAxisId="left" type="monotone" dataKey="restaurantLevelEbitda" name="EBITDA" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} connectNulls>
                              <LabelList dataKey="restaurantLevelEbitda" position="top" formatter={(v: unknown) => (typeof v === 'number' && !Number.isNaN(v) ? `$${Math.round(v).toLocaleString()}` : '')} />
                            </Line>
                          )}
                          {profitMetricToggles.labor && (
                            <Line yAxisId="right" type="monotone" dataKey="laborPct" name="Labor %" stroke="#ef4444" strokeWidth={2} dot={{ r: 4 }} connectNulls>
                              <LabelList dataKey="laborPct" position="top" formatter={(v: unknown) => (typeof v === 'number' && !Number.isNaN(v) ? `${v.toFixed(1)}%` : '')} />
                            </Line>
                          )}
                          {profitMetricToggles.foodCost && (
                            <Line yAxisId="right" type="monotone" dataKey="foodCostPct" name="Food Cost %" stroke="#f97316" strokeWidth={2} dot={{ r: 4 }} connectNulls>
                              <LabelList dataKey="foodCostPct" position="top" formatter={(v: unknown) => (typeof v === 'number' && !Number.isNaN(v) ? `${v.toFixed(1)}%` : '')} />
                            </Line>
                          )}
                          {profitMetricToggles.flm && (
                            <Line yAxisId="right" type="monotone" dataKey="flmPct" name="FLM %" stroke="#eab308" strokeWidth={2} strokeDasharray="4 4" dot={{ r: 4 }} connectNulls>
                              <LabelList dataKey="flmPct" position="top" formatter={(v: unknown) => (typeof v === 'number' && !Number.isNaN(v) ? `${v.toFixed(1)}%` : '')} />
                            </Line>
                          )}
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  )}

                  {/* 4) ROADMAP — at bottom */}
                  {hasData && (
                    <div style={{ order: 3, opacity: 0.7, marginTop: 32 }}>
                      <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: "'Inter', sans-serif", fontWeight: 600, letterSpacing: '0.12em', marginBottom: 12 }}>ROADMAP</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
                        {[
                          { icon: TrendingUp, name: 'Controllable % Analysis', desc: 'Labor + food cost combined as % of sales, period over period trend', accent: '#3b82f6' },
                          { icon: Package, name: 'Food Cost Variance by Ingredient', desc: 'Drill down into actual vs theoretical food cost by menu item', accent: '#f97316' },
                          { icon: Users, name: 'Employee-Level Labor Data', desc: 'Individual employee hours, overtime alerts, and scheduling efficiency', accent: '#ef4444' },
                          { icon: Bell, name: 'Smart Alerts', desc: 'Email and SMS notifications when labor spikes, food cost exceeds target, or sales drop', accent: '#eab308' },
                        ].map(({ icon: Icon, name, desc, accent }) => (
                          <div
                            key={name}
                            style={{
                              background: 'var(--bg-surface)',
                              border: '1px solid var(--border-subtle)',
                              borderLeftWidth: 4,
                              borderLeftColor: accent,
                              borderRadius: 12,
                              padding: 16,
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 8 }}>
                              <div style={{ color: accent, flexShrink: 0 }}>
                                <Icon size={20} strokeWidth={2} />
                              </div>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', marginBottom: 4 }}>{name}</div>
                                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.4 }}>{desc}</div>
                              </div>
                            </div>
                            <span style={{ display: 'inline-block', fontSize: 10, fontWeight: 600, background: 'rgba(217, 119, 6, 0.25)', color: '#b45309', padding: '4px 10px', borderRadius: 20 }}>Coming Soon</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })()}

            {!profitLoading && Object.keys(profitTrendDataByStore).length === 0 && (
              <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 40, textAlign: 'center' }}>
                <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 15, color: 'var(--text-primary)', marginBottom: 8 }}>No data</div>
                <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Select store and range to load period trend.</div>
              </div>
            )}
            </div>
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
                {/* Refresh Now: reloads latest data from Supabase via /api/live-data only (no scrape; Railway cron runs /api/cron every 15 min) */}
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
                  Click &quot;Refresh Now&quot; to reload the latest data from the database (scraper runs every 15 min on Railway)
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
        {!loading && activeTab === 'guest' && (
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
        {false && !loading && (
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
            {/* KPI Summary Row — 6 cells (mockup) */}
            {kpiSummary && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(6, 1fr)',
                  gap: 1,
                  background: 'var(--border-subtle)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 10,
                  overflow: 'hidden',
                  marginBottom: 20,
                }}
              >
                <div style={{ background: 'var(--bg-surface)', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>Total Net Sales</div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 22, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.1 }}>
                    ${kpiSummary.totalNetSales.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                  </div>
                  <div style={{ fontSize: 11, color: kpiSummary.compPct != null ? (kpiSummary.compPct < 0 ? 'var(--danger-text)' : 'var(--success-text)') : 'var(--text-tertiary)' }}>
                    {kpiSummary.compPct != null ? `${kpiSummary.compPct < 0 ? '↓' : '↑'} ${Math.abs(kpiSummary.compPct).toFixed(1)}% vs LY` : '—'}
                  </div>
                </div>
                <div style={{ background: 'var(--bg-surface)', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>Avg Labor %</div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 22, fontWeight: 500, color: (TARGETS.labor_pct != null && (kpiSummary.avgLaborPct ?? 0) <= TARGETS.labor_pct) ? 'var(--success-text)' : 'var(--text-primary)', lineHeight: 1.1 }}>
                    {kpiSummary.avgLaborPct != null ? `${kpiSummary.avgLaborPct.toFixed(1)}%` : '—'}
                  </div>
                  <div style={{ fontSize: 11, color: (TARGETS.labor_pct != null && (kpiSummary.avgLaborPct ?? 0) <= TARGETS.labor_pct) ? 'var(--success-text)' : 'var(--text-tertiary)' }}>
                    {(TARGETS.labor_pct != null && (kpiSummary.avgLaborPct ?? 0) <= TARGETS.labor_pct) ? 'On target' : '—'}
                  </div>
                </div>
                <div style={{ background: 'var(--bg-surface)', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>Avg Food Cost</div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 22, fontWeight: 500, color: (TARGETS.food_cost_pct != null && (kpiSummary.avgFoodCostPct ?? 0) <= TARGETS.food_cost_pct) ? 'var(--success-text)' : (kpiSummary.avgFoodCostPct ?? 0) > (TARGETS.food_cost_pct ?? 0) ? 'var(--warning-text, #f59e0b)' : 'var(--text-primary)', lineHeight: 1.1 }}>
                    {kpiSummary.avgFoodCostPct != null ? `${kpiSummary.avgFoodCostPct.toFixed(1)}%` : '—'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                    {TARGETS.food_cost_pct != null && kpiSummary.avgFoodCostPct != null ? `${(kpiSummary.avgFoodCostPct - TARGETS.food_cost_pct >= 0 ? '+' : '')}${(kpiSummary.avgFoodCostPct - TARGETS.food_cost_pct).toFixed(1)}% vs ideal` : '—'}
                  </div>
                </div>
                <div style={{ background: 'var(--bg-surface)', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>Avg FLM %</div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 22, fontWeight: 500, color: (TARGETS.flm_pct != null && (kpiSummary.avgFlmPct ?? 0) <= TARGETS.flm_pct) ? 'var(--success-text)' : 'var(--warning-text, #f59e0b)', lineHeight: 1.1 }}>
                    {kpiSummary.avgFlmPct != null ? `${kpiSummary.avgFlmPct.toFixed(1)}%` : '—'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                    {TARGETS.flm_pct != null ? `Target: <${TARGETS.flm_pct}%` : '—'}
                  </div>
                </div>
                <div style={{ background: 'var(--bg-surface)', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>Total Orders</div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 22, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.1 }}>
                    {kpiSummary.totalOrders != null ? kpiSummary.totalOrders.toLocaleString() : '—'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>—</div>
                </div>
                <div style={{ background: 'var(--bg-surface)', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>Avg SMG Score</div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 22, fontWeight: 500, color: 'var(--success-text)', lineHeight: 1.1 }}>
                    {kpiSummary.avgSmgScore != null ? kpiSummary.avgSmgScore.toFixed(1) : '—'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>—</div>
                </div>
              </div>
            )}

            {/* Single merged controls bar */}
            <div
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 10,
                padding: '10px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                flexWrap: 'wrap',
                marginBottom: 16,
              }}
            >
              {/* Left: store chips + All · None */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
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
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: "'Inter', sans-serif" }}>
                  <span style={{ color: 'var(--brand)', cursor: 'pointer', fontWeight: 500 }} onClick={selectAll}>All</span>
                  {' · '}
                  <span style={{ cursor: 'pointer', fontWeight: 500 }} onClick={selectNone}>None</span>
                </span>
              </div>

              <div style={{ width: 1, height: 20, background: 'var(--border-subtle)', flexShrink: 0 }} />

              {/* Middle: metric focus chips (no label) */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                {METRICS.filter((m) => ['net_sales', 'labor_pct', 'food_cost_pct', 'flm_pct', 'doordash_sales', 'ubereats_sales'].includes(m.key)).map((m) => (
                  <div
                    key={m.key}
                    className={`metric-chip ${activeMetric === m.key ? 'active' : ''}`}
                    onClick={() => setActiveMetric((prev) => (prev === m.key ? null : m.key))}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 6,
                      fontSize: 12,
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
              </div>

              <div style={{ width: 1, height: 20, background: 'var(--border-subtle)', flexShrink: 0 }} />

              {/* Right: period + picker + Load Cube (when cube) */}
              {dataSource === 'cube' && (
                <>
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
                          padding: '6px 12px',
                          borderRadius: 6,
                          border: 'none',
                          cursor: 'pointer',
                          fontFamily: "'Inter', sans-serif",
                          fontSize: 12,
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
                  {cubePeriod === 'yearly' ? (
                    <select
                      value={cubeDate}
                      onChange={(e) => {
                        const val = e.target.value
                        setCubeDate(val)
                        void loadCubeData(val, 'yearly')
                      }}
                      style={{
                        padding: '6px 10px',
                        borderRadius: 6,
                        border: '1px solid var(--border-default)',
                        background: 'var(--bg-overlay)',
                        color: 'var(--text-primary)',
                        fontFamily: "'Inter', sans-serif",
                        fontSize: 12,
                      }}
                    >
                      {[2022, 2023, 2024, 2025, 2026].map((y) => (
                        <option key={y} value={String(y)}>{y}</option>
                      ))}
                    </select>
                  ) : cubePeriod === 'weekly' ? (
                    <div style={{ display: 'flex', gap: 6 }}>
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
                          padding: '6px 10px',
                          borderRadius: 6,
                          border: '1px solid var(--border-default)',
                          background: 'var(--bg-overlay)',
                          color: 'var(--text-primary)',
                          fontFamily: "'Inter', sans-serif",
                          fontSize: 12,
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
                          padding: '6px 10px',
                          borderRadius: 6,
                          border: '1px solid var(--border-default)',
                          background: 'var(--bg-overlay)',
                          color: 'var(--text-primary)',
                          fontFamily: "'Inter', sans-serif",
                          fontSize: 12,
                        }}
                      >
                        {Array.from({ length: 52 }, (_, i) => i + 1).map((w) => (
                          <option key={w} value={w}>W{w}</option>
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
                        padding: '6px 10px',
                        borderRadius: 6,
                        border: '1px solid var(--border-default)',
                        background: 'var(--bg-overlay)',
                        color: 'var(--text-primary)',
                        fontFamily: "'Inter', sans-serif",
                        fontSize: 12,
                      }}
                    />
                  )}
                  <button
                    onClick={() => void loadCubeData()}
                    disabled={cubeLoading}
                    style={{
                      padding: '6px 14px',
                      borderRadius: 6,
                      border: 'none',
                      cursor: cubeLoading ? 'not-allowed' : 'pointer',
                      fontFamily: "'Inter', sans-serif",
                      fontSize: 12,
                      fontWeight: 600,
                      letterSpacing: '0.04em',
                      background: 'var(--brand)',
                      color: '#fff',
                    }}
                  >
                    {cubeLoading ? (
                      <>
                        <span style={{ display: 'inline-block', width: 10, height: 10, border: '2px solid rgba(255,255,255,0.5)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite', marginRight: 6, verticalAlign: 'middle' }} />
                        Loading…
                      </>
                    ) : (
                      'Load Cube Data'
                    )}
                  </button>
                </>
              )}

            </div>

            {/* Store KPI Cards — tighter grid per mockup */}
            <>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: 12,
                    marginBottom: 20,
                    alignItems: 'start',
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
                        tableauLeadership={tableauDataByStore[num]?.leadership ?? null}
                        tableauBozocoro={tableauDataByStore[num]?.bozocoro ?? null}
                        tableauLoading={tableauLoading}
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

                {/* Bottom charts row — weekly trend, labor ranking, food cost variance (mockup) */}
                {(() => {
                  const laborTarget = TARGETS.labor_pct ?? 28.68
                  const groupTotalLatestWeek = weeklyTrendData.length > 0 ? (weeklyTrendData[weeklyTrendData.length - 1]?.total ?? 0) : 0
                  const laborRows = selectedStoresSafe
                    .map((num) => {
                      const s = stores.find((x) => x.number === num)
                      const r = cubeData?.find((x) => String(x.storeNumber) === num)
                      const pct = r?.totalLaborPct ?? r?.laborPct ?? null
                      return { storeNum: num, location: s?.location ?? num, laborPct: pct }
                    })
                    .filter((x) => x.laborPct != null)
                    .sort((a, b) => (a.laborPct ?? 0) - (b.laborPct ?? 0))
                  const laborMax = Math.max(...laborRows.map((r) => r.laborPct ?? 0), 1)
                  const idealFood = TARGETS.food_cost_pct ?? 26.42
                  const fcRows = selectedStoresSafe
                    .map((num) => {
                      const s = stores.find((x) => x.number === num)
                      const r = cubeData?.find((x) => String(x.storeNumber) === num)
                      const actual = r?.actualFoodPct ?? (r?.netSales && r?.foodCostUsd ? (r.foodCostUsd / r.netSales) * 100 : null)
                      const gap = actual != null ? actual - idealFood : null
                      return { storeNum: num, location: s?.location ?? s?.name ?? num, actual, gap }
                    })
                    .filter((x) => x.actual != null)
                    .sort((a, b) => (b.gap ?? 0) - (a.gap ?? 0))
                  return (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 1fr', gap: 12, marginTop: 16 }}>
                      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: 16, minHeight: 180 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 14 }}>📊 Weekly Sales Trend</div>
                        <div style={{ height: 120 }}>
                          <ResponsiveContainer width="100%" height={120}>
                            <BarChart data={weeklyTrendData} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
                              <Bar dataKey="total" fill="var(--brand)" radius={[3, 3, 0, 0]} />
                              <XAxis dataKey="label" tick={{ fontSize: 9, fill: 'var(--text-tertiary)' }} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 10, borderTop: '1px solid var(--border-subtle)', marginTop: 4 }}>
                          <div>
                            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Group Total (latest week)</div>
                            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, color: 'var(--text-primary)', fontWeight: 500 }}>
                              ${groupTotalLatestWeek.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: 16 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 14 }}>👥 Labor % Ranking</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {(laborRows.length ? laborRows : []).map((row) => {
                            const pct = row.laborPct ?? 0
                            const isOver = laborTarget != null && pct > laborTarget
                            return (
                              <div key={row.storeNum} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div style={{ fontSize: 12, color: 'var(--text-secondary)', width: 72, flexShrink: 0, textAlign: 'right' }}>{row.location}</div>
                                <div style={{ flex: 1, height: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
                                  <div style={{ width: `${(pct / laborMax) * 100}%`, height: '100%', borderRadius: 4, background: isOver ? 'var(--danger-text)' : pct > (laborTarget ?? 0) * 0.95 ? 'var(--warning-text, #f59e0b)' : 'var(--success-text)' }} />
                                </div>
                                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 500, width: 36, textAlign: 'right', flexShrink: 0, color: isOver ? 'var(--danger-text)' : 'var(--text-primary)' }}>
                                  {pct.toFixed(1)}%{isOver ? ' ▲' : ''}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: 16 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 14 }}>🍕 Food Cost Variance</div>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                          <thead>
                            <tr>
                              <th style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-tertiary)', textAlign: 'left', paddingBottom: 8, borderBottom: '1px solid var(--border-subtle)' }}>Store</th>
                              <th style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-tertiary)', textAlign: 'right', paddingBottom: 8, borderBottom: '1px solid var(--border-subtle)' }}>Actual %</th>
                              <th style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-tertiary)', textAlign: 'right', paddingBottom: 8, borderBottom: '1px solid var(--border-subtle)' }}>Ideal %</th>
                              <th style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-tertiary)', textAlign: 'right', paddingBottom: 8, borderBottom: '1px solid var(--border-subtle)' }}>Gap</th>
                            </tr>
                          </thead>
                          <tbody>
                            {fcRows.map((row) => (
                              <tr key={row.storeNum}>
                                <td style={{ padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.03)', color: 'var(--text-primary)', fontWeight: 500 }}>{row.location}</td>
                                <td style={{ padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.03)', textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", fontSize: 11.5, color: 'var(--text-secondary)' }}>{row.actual != null ? `${row.actual.toFixed(1)}%` : '—'}</td>
                                <td style={{ padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.03)', textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", fontSize: 11.5, color: 'var(--text-secondary)' }}>{idealFood}%</td>
                                <td style={{ padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.03)', textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", fontSize: 11.5, fontWeight: 600, color: (row.gap ?? 0) > 3 ? 'var(--danger-text)' : (row.gap ?? 0) > 1.5 ? 'var(--warning-text, #f59e0b)' : 'var(--success-text)' }}>
                                  {row.gap != null ? `${row.gap >= 0 ? '+' : ''}${row.gap.toFixed(1)}%` : '—'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )
                })()}
              </>

            {/* Targets row — slim chips per mockup */}
            <div style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
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
                const onTarget = targetVal != null && isGood(m.key, targetVal - 0.01)
                return (
                  <div
                    key={m.key}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 7,
                      padding: '6px 12px',
                      borderRadius: 7,
                      border: '1px solid var(--border-subtle)',
                      background: 'var(--bg-surface)',
                      fontSize: 11.5,
                      fontFamily: "'Inter', sans-serif",
                    }}
                  >
                    <span style={{ color: 'var(--text-tertiary)' }}>{m.label} Target</span>
                    <span style={{ color: 'var(--text-secondary)', fontFamily: "'JetBrains Mono', monospace'" }}>{targetLabel}</span>
                    {targetVal != null && (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: '1px 6px',
                          borderRadius: 4,
                          letterSpacing: '0.04em',
                          background: onTarget ? 'var(--success-subtle)' : 'var(--danger-subtle)',
                          color: onTarget ? 'var(--success-text)' : 'var(--danger-text)',
                        }}
                      >
                        {onTarget ? 'ON TARGET' : 'OFF TARGET'}
                      </span>
                    )}
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
