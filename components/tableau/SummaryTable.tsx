'use client'

import { useEffect, useState } from 'react'

// Parse "P03 2026" -> { p: 3, y: 2026 }
function parsePeriod(period: string): { p: number; y: number } | null {
  const m = period.match(/^P(\d{1,2})\s+(\d{4})$/)
  if (!m) return null
  return { p: parseInt(m[1], 10), y: parseInt(m[2], 10) }
}

export function getPreviousPeriod(period: string): string | null {
  const parsed = parsePeriod(period)
  if (!parsed) return null
  const { p, y } = parsed
  if (p <= 1) return `P13 ${y - 1}`
  return `P${String(p - 1).padStart(2, '0')} ${y}`
}

export function getLastYearPeriod(period: string): string | null {
  const parsed = parsePeriod(period)
  if (!parsed) return null
  return `P${String(parsed.p).padStart(2, '0')} ${parsed.y - 1}`
}

interface Col {
  key: string
  label: string
  format?: 'percent' | 'currency' | 'number' | 'text'
}

interface Props {
  title: string
  endpoint: 'bad-orders' | 'zeroed-out' | 'canceled-orders' | 'refund-orders'
  columns: Col[]
  week?: string
  period?: string
  refreshKey?: number
  showVsPrevious?: boolean
  showVsLastYear?: boolean
}

export default function SummaryTable({
  title,
  endpoint,
  columns,
  week,
  period,
  refreshKey,
  showVsPrevious = false,
  showVsLastYear = false,
}: Props) {
  const [data, setData] = useState<Record<string, unknown>[]>([])
  const [prevData, setPrevData] = useState<Record<string, Record<string, unknown>> | null>(null)
  const [lyData, setLyData] = useState<Record<string, Record<string, unknown>> | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastSync, setLastSync] = useState<string | null>(null)

  const prevPeriod = period ? getPreviousPeriod(period) : null
  const lyPeriod = period ? getLastYearPeriod(period) : null
  const needPrev = showVsPrevious && prevPeriod
  const needLy = showVsLastYear && lyPeriod

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (week) params.set('week', week)
    if (period) params.set('period', period)

    const fetches: Promise<void>[] = [
      fetch(`/api/tableau/${endpoint}?${params}`)
        .then((r) => r.json())
        .then(({ data: resData }: { data?: Record<string, unknown>[] }) => {
          setData(resData ?? [])
          const first = resData?.[0]
          if (first && typeof first.synced_at === 'string') setLastSync(first.synced_at)
        }),
    ]

    if (needPrev) {
      const p = new URLSearchParams()
      if (week) p.set('week', week)
      p.set('period', prevPeriod!)
      fetches.push(
        fetch(`/api/tableau/${endpoint}?${p}`)
          .then((r) => r.json())
          .then(({ data: resData }: { data?: Record<string, unknown>[] }) => {
            const byStore: Record<string, Record<string, unknown>> = {}
            ;(resData ?? []).forEach((row) => {
              const sn = String(row.store_number ?? '')
              if (sn) byStore[sn] = row
            })
            setPrevData(byStore)
          })
      )
    } else setPrevData(null)

    if (needLy) {
      const p = new URLSearchParams()
      if (week) p.set('week', week)
      p.set('period', lyPeriod!)
      fetches.push(
        fetch(`/api/tableau/${endpoint}?${p}`)
          .then((r) => r.json())
          .then(({ data: resData }: { data?: Record<string, unknown>[] }) => {
            const byStore: Record<string, Record<string, unknown>> = {}
            ;(resData ?? []).forEach((row) => {
              const sn = String(row.store_number ?? '')
              if (sn) byStore[sn] = row
            })
            setLyData(byStore)
          })
      )
    } else setLyData(null)

    Promise.all(fetches).finally(() => setLoading(false))
  }, [endpoint, week, period, refreshKey, needPrev, needLy, prevPeriod, lyPeriod])

  const fmt = (val: unknown, format?: string) => {
    if (val == null || val === '') return '—'
    const n = Number(val)
    if (Number.isNaN(n)) return String(val)
    if (format === 'percent') return `${n.toFixed(2)}%`
    if (format === 'currency') return `$${n.toFixed(2)}`
    if (format === 'number') return n.toLocaleString()
    return String(val)
  }

  const num = (val: unknown): number | null => {
    if (val == null || val === '') return null
    const n = Number(val)
    return Number.isNaN(n) ? null : n
  }

  // For audit metrics, lower is better
  const arrow = (current: number | null, prev: number | null): string => {
    if (current == null || prev == null) return '—'
    if (current < prev) return '▼'
    if (current > prev) return '▲'
    return '—'
  }

  const yoyPct = (current: number | null, lastYear: number | null): string => {
    if (current == null || lastYear == null) return '—'
    if (lastYear === 0) return current === 0 ? '—' : '—'
    const pct = ((current - lastYear) / lastYear) * 100
    return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`
  }

  const metricColumns = columns.filter((c) => c.key !== 'store_number' && (c.format === 'percent' || c.format === 'currency' || c.format === 'number'))
  const showComparison = (showVsPrevious || showVsLastYear) && period && metricColumns.length > 0

  return (
    <div
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 12,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          background: 'var(--brand)',
          padding: '12px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <h2 style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 14, color: '#fff' }}>
          {title}
        </h2>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)' }}>
          {lastSync ? `Synced ${new Date(lastSync).toLocaleDateString()}` : 'Not synced yet'}
        </span>
      </div>

      {loading ? (
        <div style={{ padding: 16 }}>
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              style={{ height: 36, background: 'var(--bg-overlay)', borderRadius: 6, marginBottom: i < 4 ? 8 : 0 }}
            />
          ))}
        </div>
      ) : data.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)', fontFamily: "'Inter', sans-serif" }}>
          <p style={{ fontSize: 24, marginBottom: 8 }}>📭</p>
          <p style={{ fontWeight: 500, marginBottom: 4 }}>No data</p>
          <p style={{ fontSize: 12 }}>Click Sync to load</p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: 13, fontFamily: "'Inter', sans-serif", borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-subtle)' }}>
                {columns.map((col, idx) => (
                  <th
                    key={col.key}
                    style={{
                      padding: '10px 16px',
                      textAlign: idx === 0 ? 'left' : 'right',
                      fontSize: 11,
                      fontWeight: 600,
                      letterSpacing: '0.1em',
                      color: 'var(--text-tertiary)',
                      textTransform: 'uppercase',
                      borderBottom: '1px solid var(--border-subtle)',
                    }}
                  >
                    {col.label}
                  </th>
                ))}
                {showComparison && showVsPrevious && (
                  <>
                    {metricColumns.map((col) => (
                      <th
                        key={`prev-${col.key}`}
                        style={{
                          padding: '10px 16px',
                          textAlign: 'right',
                          fontSize: 10,
                          fontWeight: 600,
                          color: 'var(--text-tertiary)',
                          borderBottom: '1px solid var(--border-subtle)',
                        }}
                      >
                        Prev
                      </th>
                    ))}
                  </>
                )}
                {showComparison && showVsLastYear && (
                  <>
                    {metricColumns.map((col) => (
                      <th
                        key={`yoy-${col.key}`}
                        style={{
                          padding: '10px 16px',
                          textAlign: 'right',
                          fontSize: 10,
                          fontWeight: 600,
                          color: 'var(--text-tertiary)',
                          borderBottom: '1px solid var(--border-subtle)',
                        }}
                      >
                        YoY %
                      </th>
                    ))}
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {data.map((row, i) => {
                const storeNum = String(row.store_number ?? '')
                const prevRow = prevData?.[storeNum]
                const lyRow = lyData?.[storeNum]
                return (
                  <tr
                    key={i}
                    style={{
                      background: i % 2 === 0 ? 'var(--bg-surface)' : 'var(--bg-elevated)',
                      borderBottom: '1px solid var(--border-subtle)',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-overlay)' }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = i % 2 === 0 ? 'var(--bg-surface)' : 'var(--bg-elevated)'
                    }}
                  >
                    {columns.map((col, idx) => (
                      <td
                        key={col.key}
                        style={{
                          padding: '10px 16px',
                          textAlign: idx === 0 ? 'left' : 'right',
                          color: 'var(--text-primary)',
                        }}
                      >
                        {fmt(row[col.key], col.format)}
                      </td>
                    ))}
                    {showComparison && showVsPrevious && metricColumns.map((col) => {
                      const curr = num(row[col.key])
                      const prev = num(prevRow?.[col.key])
                      const arr = arrow(curr, prev)
                      return (
                        <td
                          key={`prev-${col.key}`}
                          style={{
                            padding: '10px 16px',
                            textAlign: 'right',
                            color: arr === '▼' ? 'var(--success-text)' : arr === '▲' ? 'var(--danger-text)' : 'var(--text-secondary)',
                            fontSize: 12,
                          }}
                        >
                          {prev != null ? `${fmt(prevRow?.[col.key], col.format)} ${arr}` : '—'}
                        </td>
                      )
                    })}
                    {showComparison && showVsLastYear && metricColumns.map((col) => {
                      const curr = num(row[col.key])
                      const ly = num(lyRow?.[col.key])
                      const pct = yoyPct(curr, ly)
                      const isBetter = curr != null && ly != null && curr < ly
                      const isWorse = curr != null && ly != null && curr > ly
                      return (
                        <td
                          key={`yoy-${col.key}`}
                          style={{
                            padding: '10px 16px',
                            textAlign: 'right',
                            color: isBetter ? 'var(--success-text)' : isWorse ? 'var(--danger-text)' : 'var(--text-secondary)',
                            fontSize: 12,
                          }}
                        >
                          {pct}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <div
        style={{
          padding: '8px 16px',
          background: 'var(--bg-base)',
          borderTop: '1px solid var(--border-subtle)',
          fontSize: 11,
          color: 'var(--text-tertiary)',
          textAlign: 'right',
          fontFamily: "'Inter', sans-serif",
        }}
      >
        {data.length} stores · {period || 'All periods'}
        {week ? ` · ${week}` : ''}
      </div>
    </div>
  )
}
