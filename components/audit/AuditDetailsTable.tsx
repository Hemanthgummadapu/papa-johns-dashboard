'use client'

import { useEffect, useState } from 'react'

interface AuditDetailsTableProps {
  timePeriod: string
  refreshKey?: number
  initialStore?: string
  initialManager?: string
}

export default function AuditDetailsTable({ timePeriod, refreshKey, initialStore, initialManager }: AuditDetailsTableProps) {
  const [data, setData] = useState<Record<string, unknown>[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [auditType, setAuditType] = useState('bad_order')
  const [store, setStore] = useState(initialStore ?? '')
  const [manager, setManager] = useState(initialManager ?? '')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const limit = 500

  useEffect(() => {
    if (!timePeriod) return
    setLoading(true)
    const params = new URLSearchParams({ time_period: timePeriod, audit_type: auditType, page: String(page) })
    if (store) params.set('store', store)
    if (manager) params.set('manager', manager)
    if (dateFrom) params.set('from', dateFrom)
    if (dateTo) params.set('to', dateTo)
    fetch(`/api/audit/details?${params}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d.data ?? [])
        setTotal(d.total ?? 0)
      })
      .finally(() => setLoading(false))
  }, [timePeriod, auditType, store, manager, dateFrom, dateTo, page, refreshKey])

  useEffect(() => {
    if (initialStore !== undefined) setStore(initialStore)
    if (initialManager !== undefined) setManager(initialManager)
  }, [initialStore, initialManager])

  const timeStr = (v: unknown) => (v ? new Date(String(v)).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' }) : '—')
  const fmt = (v: unknown) => (v != null && !Number.isNaN(Number(v)) ? `$${Number(v).toFixed(2)}` : '—')
  const isAfterHours = (v: unknown) => {
    if (!v) return false
    const d = new Date(String(v))
    const h = d.getHours()
    return h >= 22 || h < 6
  }
  const isHighValue = (v: unknown) => (Number(v) || 0) > 50

  const AUDIT_TYPE_LABELS: Record<string, string> = {
    bad_order: 'Bad Order',
    zeroed_out: 'Zeroed Out',
    canceled: 'Canceled',
    refund: 'Refund',
  }
  const formatAuditType = (t: unknown) => {
    const s = String(t ?? '').trim()
    return (AUDIT_TYPE_LABELS[s] ?? s) || '—'
  }
  const isSelfApproved = (row: Record<string, unknown>) => {
    const m = String(row.manager_name ?? '').trim().toLowerCase()
    const a = String(row.approver_name ?? row.approver_user_id ?? '').trim().toLowerCase()
    return m && a && m === a
  }

  const periodBadge = (period: unknown) => {
    const p = String(period ?? '')
    if (p === 'current_period') return <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 600, background: 'var(--success-subtle)', color: 'var(--success-text)' }}>Current</span>
    if (p === 'last_period') return <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 600, background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa' }}>Last Period</span>
    if (p === 'last_year') return <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 600, background: 'var(--bg-overlay)', color: 'var(--text-tertiary)' }}>Last Year</span>
    return <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{p || '—'}</span>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <select
          value={auditType}
          onChange={(e) => { setAuditType(e.target.value); setPage(0) }}
          style={{ background: 'var(--bg-overlay)', border: '1px solid var(--border-default)', borderRadius: 8, padding: '8px 12px', color: 'var(--text-primary)', fontSize: 13 }}
        >
          <option value="bad_order">Bad order</option>
          <option value="zeroed_out">Zeroed out</option>
          <option value="canceled">Canceled</option>
          <option value="refund">Refund</option>
        </select>
        <input
          type="text"
          placeholder="Store #"
          value={store}
          onChange={(e) => { setStore(e.target.value); setPage(0) }}
          style={{ background: 'var(--bg-overlay)', border: '1px solid var(--border-default)', borderRadius: 8, padding: '8px 12px', color: 'var(--text-primary)', fontSize: 13, width: 100 }}
        />
        <input
          type="text"
          placeholder="Manager name"
          value={manager}
          onChange={(e) => { setManager(e.target.value); setPage(0) }}
          style={{ background: 'var(--bg-overlay)', border: '1px solid var(--border-default)', borderRadius: 8, padding: '8px 12px', color: 'var(--text-primary)', fontSize: 13, width: 160 }}
        />
        <label style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
          From <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(0) }} style={{ marginLeft: 4, background: 'var(--bg-overlay)', border: '1px solid var(--border-default)', borderRadius: 6, padding: '6px 8px', color: 'var(--text-primary)', fontSize: 12 }} />
        </label>
        <label style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
          To <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(0) }} style={{ marginLeft: 4, background: 'var(--bg-overlay)', border: '1px solid var(--border-default)', borderRadius: 6, padding: '6px 8px', color: 'var(--text-primary)', fontSize: 12 }} />
        </label>
      </div>
      {loading ? (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-tertiary)' }}>Loading…</div>
      ) : (
        <>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-tertiary)', fontWeight: 600 }}>Date</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text-tertiary)', fontWeight: 600 }}>Store</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-tertiary)', fontWeight: 600 }}>Manager</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-tertiary)', fontWeight: 600 }}>Approver</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text-tertiary)', fontWeight: 600 }}>Amount</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-tertiary)', fontWeight: 600 }}>Type</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-tertiary)', fontWeight: 600 }}>Reason</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-tertiary)', fontWeight: 600 }}>Period</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row, i) => {
                  const afterHours = isAfterHours(row.event_at)
                  const highVal = isHighValue(row.amount)
                  const selfApproved = isSelfApproved(row)
                  const highlight = highVal
                  const approverDisplay = String(row.approver_name ?? row.approver_user_id ?? '—')
                  return (
                    <tr
                      key={i}
                      style={{
                        borderBottom: '1px solid var(--border-subtle)',
                        background: selfApproved ? 'rgba(249, 115, 22, 0.12)' : highlight ? 'var(--danger-subtle)' : undefined,
                        borderLeft: afterHours ? '3px solid rgba(239, 68, 68, 0.6)' : undefined,
                      }}
                    >
                      <td style={{ padding: '8px 12px', color: 'var(--text-primary)' }}>{timeStr(row.order_placed_at)}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text-secondary)' }}>{String(row.store_number ?? '')}</td>
                      <td style={{ padding: '8px 12px', color: 'var(--text-primary)' }}>{String(row.manager_name ?? '')}</td>
                      <td style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>
                        {selfApproved && <span style={{ marginRight: 4 }} title="Self-approved">⚠</span>}
                        {approverDisplay || '—'}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: highVal ? 'var(--danger-text)' : 'var(--text-primary)' }}>{fmt(row.amount)}</td>
                      <td style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>{formatAuditType(row.audit_type)}</td>
                      <td style={{ padding: '8px 12px', color: 'var(--text-secondary)', maxWidth: 180 }}>{String(row.reason ?? '—')}</td>
                      <td style={{ padding: '8px 12px' }}>{periodBadge(row.time_period_label)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: 'var(--text-tertiary)' }}>
            <span>{total} total rows</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                disabled={page <= 0}
                onClick={() => setPage((p) => p - 1)}
                style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid var(--border-default)', background: 'var(--bg-overlay)', color: 'var(--text-primary)', cursor: page <= 0 ? 'not-allowed' : 'pointer' }}
              >
                Previous
              </button>
              <span>Page {page + 1}</span>
              <button
                type="button"
                disabled={data.length < limit}
                onClick={() => setPage((p) => p + 1)}
                style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid var(--border-default)', background: 'var(--bg-overlay)', color: 'var(--text-primary)', cursor: data.length < limit ? 'not-allowed' : 'pointer' }}
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
