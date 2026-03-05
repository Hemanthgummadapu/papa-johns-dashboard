'use client'

import { useEffect, useState, useMemo } from 'react'

interface AuditSummaryTableProps {
  timePeriod: string
  refreshKey?: number
}

type SortKey = 'store_number' | 'bad_order' | 'zeroed_out' | 'canceled' | 'refund' | 'total_amount'

export default function AuditSummaryTable({ timePeriod, refreshKey }: AuditSummaryTableProps) {
  const [data, setData] = useState<Array<{ store_number: string; bad_order: number; zeroed_out: number; canceled: number; refund: number; total_amount: number }>>([])
  const [loading, setLoading] = useState(true)
  const [sortKey, setSortKey] = useState<SortKey>('store_number')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  useEffect(() => {
    if (!timePeriod) {
      setData([])
      setLoading(false)
      return
    }
    setLoading(true)
    fetch(`/api/audit/summary/by-store?time_period=${encodeURIComponent(timePeriod)}`)
      .then((r) => r.json())
      .then((res) => setData(res.data ?? []))
      .finally(() => setLoading(false))
  }, [timePeriod, refreshKey])

  const sortedData = useMemo(() => {
    if (!data.length) return data
    const k = sortKey
    const dir = sortDir === 'asc' ? 1 : -1
    return [...data].sort((a, b) => {
      const va = k === 'store_number' ? a.store_number : (a[k] as number)
      const vb = k === 'store_number' ? b.store_number : (b[k] as number)
      if (k === 'store_number') return dir * String(va).localeCompare(String(vb))
      return dir * (Number(va) - Number(vb))
    })
  }, [data, sortKey, sortDir])

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(key)
      setSortDir(key === 'store_number' ? 'asc' : 'desc')
    }
  }

  const Th = ({ label, sortKey: k }: { label: string; sortKey: SortKey }) => (
    <th
      style={{ padding: '10px 16px', textAlign: k === 'store_number' ? 'left' : 'right', fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', cursor: 'pointer', userSelect: 'none' }}
      onClick={() => handleSort(k)}
    >
      {label} {sortKey === k ? (sortDir === 'asc' ? '↑' : '↓') : ''}
    </th>
  )

  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 12, overflow: 'hidden' }}>
      {loading ? (
        <div style={{ padding: 16 }}>
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} style={{ height: 36, background: 'var(--bg-overlay)', borderRadius: 6, marginBottom: 8 }} />
          ))}
        </div>
      ) : data.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)' }}>No data — upload CSV for this time period first</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-subtle)' }}>
                <Th label="Store" sortKey="store_number" />
                <Th label="Bad Orders" sortKey="bad_order" />
                <Th label="Zeroed Out" sortKey="zeroed_out" />
                <Th label="Canceled" sortKey="canceled" />
                <Th label="Refund" sortKey="refund" />
                <Th label="Total Amount" sortKey="total_amount" />
              </tr>
            </thead>
            <tbody>
              {sortedData.map((row, i) => (
                <tr
                  key={row.store_number}
                  style={{
                    borderBottom: '1px solid var(--border-subtle)',
                    background: i % 2 === 0 ? 'var(--bg-surface)' : 'var(--bg-elevated)',
                  }}
                >
                  <td style={{ padding: '10px 16px', color: 'var(--text-primary)' }}>{row.store_number}</td>
                  <td style={{ padding: '10px 16px', textAlign: 'right', color: 'var(--text-primary)' }}>{row.bad_order}</td>
                  <td style={{ padding: '10px 16px', textAlign: 'right', color: 'var(--text-primary)' }}>{row.zeroed_out}</td>
                  <td style={{ padding: '10px 16px', textAlign: 'right', color: 'var(--text-primary)' }}>{row.canceled}</td>
                  <td style={{ padding: '10px 16px', textAlign: 'right', color: 'var(--text-primary)' }}>{row.refund}</td>
                  <td style={{ padding: '10px 16px', textAlign: 'right', color: 'var(--text-primary)' }}>${(row.total_amount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div style={{ padding: '8px 16px', background: 'var(--bg-base)', borderTop: '1px solid var(--border-subtle)', fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'right' }}>
        {data.length} stores
      </div>
    </div>
  )
}
