'use client'

import { useEffect, useState } from 'react'

interface AuditSummaryComparisonTableProps {
  period: string
  refreshKey?: number
}

export default function AuditSummaryComparisonTable({ period, refreshKey }: AuditSummaryComparisonTableProps) {
  const [auditType, setAuditType] = useState('bad_order')
  const [data, setData] = useState<Array<Record<string, unknown>>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!period) {
      setData([])
      setLoading(false)
      return
    }
    setLoading(true)
    Promise.all([
      fetch(`/api/audit/comparison?period=${encodeURIComponent(period)}`).then((r) => r.json()),
      fetch(`/api/audit/yoy?period=${encodeURIComponent(period)}`).then((r) => r.json()),
    ])
      .then(([compRes, yoyRes]) => {
        const compRows = (compRes.data ?? []) as Array<Record<string, unknown>>
        const yoyRows = (yoyRes.data ?? []) as Array<Record<string, unknown>>
        const yoyByKey: Record<string, { ly_percent?: number }> = {}
        yoyRows.forEach((r) => {
          const key = `${r.store_number}|${r.audit_type}`
          yoyByKey[key] = { ly_percent: Number(r.ly_percent) || 0 }
        })
        const merged = compRows
          .filter((r) => r.audit_type === auditType)
          .map((r) => {
            const key = `${r.store_number}|${r.audit_type}`
            const ly = yoyByKey[key]?.ly_percent
            const curr = Number(r.current_percent) || 0
            const prev = r.prev_percent != null ? Number(r.prev_percent) : null
            const yoyChange = ly != null && ly !== 0 ? ((curr - ly) / ly) * 100 : null
            return {
              ...r,
              percent_change: r.percent_change,
              yoy_change: yoyChange,
            } as Record<string, unknown>
          })
          .sort((a, b) => String(a.store_number).localeCompare(String(b.store_number)))
        setData(merged)
      })
      .finally(() => setLoading(false))
  }, [period, auditType, refreshKey])

  const fmt = (val: unknown, format: string) => {
    if (val == null) return '—'
    const n = Number(val)
    if (Number.isNaN(n)) return '—'
    if (format === 'percent') return `${n.toFixed(2)}%`
    if (format === 'change') return n > 0 ? `+${n.toFixed(1)}%` : `${n.toFixed(1)}%`
    return String(val)
  }

  const arrow = (change: number | null) => {
    if (change == null) return null
    if (change > 0) return <span style={{ color: 'var(--danger-text)' }}>▲</span>
    if (change < 0) return <span style={{ color: 'var(--success-text)' }}>▼</span>
    return <span style={{ color: 'var(--text-tertiary)' }}>—</span>
  }

  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ padding: 16, borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)' }}>Audit type</label>
        <select
          value={auditType}
          onChange={(e) => setAuditType(e.target.value)}
          style={{
            background: 'var(--bg-overlay)',
            border: '1px solid var(--border-default)',
            borderRadius: 8,
            padding: '8px 12px',
            fontSize: 13,
            color: 'var(--text-primary)',
          }}
        >
          <option value="bad_order">Bad Order</option>
          <option value="zeroed_out">Zeroed Out</option>
          <option value="canceled">Canceled</option>
          <option value="refund">Refund</option>
        </select>
      </div>
      {loading ? (
        <div style={{ padding: 24 }}>Loading…</div>
      ) : data.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)' }}>No comparison data — sync first</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-subtle)' }}>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)' }}>Store</th>
                <th style={{ padding: '10px 16px', textAlign: 'right', fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)' }}>Current %</th>
                <th style={{ padding: '10px 16px', textAlign: 'right', fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)' }}>Prev Period %</th>
                <th style={{ padding: '10px 16px', textAlign: 'right', fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)' }}>Change</th>
                <th style={{ padding: '10px 16px', textAlign: 'right', fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)' }}>YoY Change</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, i) => (
                <tr
                  key={i}
                  style={{
                    borderBottom: '1px solid var(--border-subtle)',
                    background: i % 2 === 0 ? 'var(--bg-surface)' : 'var(--bg-elevated)',
                  }}
                >
                  <td style={{ padding: '10px 16px', color: 'var(--text-primary)' }}>{String(row.store_number ?? '')}</td>
                  <td style={{ padding: '10px 16px', textAlign: 'right', color: 'var(--text-primary)' }}>{fmt(row.current_percent, 'percent')}</td>
                  <td style={{ padding: '10px 16px', textAlign: 'right', color: 'var(--text-secondary)' }}>{fmt(row.prev_percent, 'percent')}</td>
                  <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                    {arrow(Number(row.percent_change))}
                    {fmt(row.percent_change, 'change')}
                  </td>
                  <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                    {arrow(Number(row.yoy_change))}
                    {fmt(row.yoy_change, 'change')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
