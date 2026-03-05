'use client'

import { useEffect, useState } from 'react'

const AUDIT_TYPE_LABELS: Record<string, string> = {
  bad_order: 'Bad Order',
  zeroed_out: 'Zeroed Out',
  canceled: 'Canceled',
  refund: 'Refund',
}
function formatAuditType(t: string): string {
  return (AUDIT_TYPE_LABELS[t] ?? t) || '—'
}

interface FraudFlagsProps {
  timePeriod: string
  store?: string
  onViewDetails?: (store?: string, manager?: string) => void
}

export default function FraudFlags({ timePeriod, store, onViewDetails }: FraudFlagsProps) {
  const [data, setData] = useState<{
    repeatCustomer?: Array<{ customer_name: string | null; customer_number: string | null; incidents: number; total_amount: number; types: string[]; stores: string[] }>
    cashCancellations?: Array<{ store_number: string; manager_name: string; cash_incidents: number; total_amount: number; audit_type: string }>
    managerTrend?: Array<{ manager_name: string; store_number: string; audit_type: string; current_incidents: number; last_incidents: number; increase: number }>
    storePerformance?: Array<{ store_number: string; metrics: Array<{ audit_type: string; current: number; last: number; pctChange: number }>; gettingWorse: boolean; currTotal: number; lastTotal: number }>
    highValue?: Array<{ store_number?: string; manager_name?: string; customer_name?: string; amount: number; audit_type?: string; reason?: string; business_date?: string; order_type?: string }>
    sameManagerAllTypes?: Array<{ manager_name: string; store_number: string; type_count: number; types: string[]; total_incidents: number; total_amount: number }>
    summary?: { highRisk: number; mediumRisk: number; lowRisk: number }
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!timePeriod) return
    setLoading(true)
    const params = new URLSearchParams({ time_period: timePeriod })
    if (store) params.set('store', store)
    fetch(`/api/audit/fraud?${params}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error)
        else setData(d)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [timePeriod, store])

  const fmt = (v: number, type: 'currency' | 'number') =>
    type === 'currency' ? `$${v.toFixed(2)}` : v.toLocaleString()
  const dateStr = (v: string | undefined) => (v ? new Date(v).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric', year: '2-digit' }) : '—')

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-tertiary)' }}>
        Loading fraud flags…
      </div>
    )
  }
  if (error) {
    return (
      <div style={{ padding: 24, color: 'var(--danger-text)' }}>
        Error: {error}
      </div>
    )
  }

  const periodLabel = timePeriod === 'current_period' ? 'Current Period' : timePeriod === 'last_period' ? 'Last Period' : 'Last Year'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      {/* Summary bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          padding: '14px 18px',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            🚨 <strong style={{ color: 'var(--danger-text)' }}>{data?.summary?.highRisk ?? 0}</strong> High Risk
          </span>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            ⚠️ <strong style={{ color: 'var(--warning-text, #eab308)' }}>{data?.summary?.mediumRisk ?? 0}</strong> Medium
          </span>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            ✓ <strong style={{ color: 'var(--success-text)' }}>{data?.summary?.lowRisk ?? 0}</strong> Low
          </span>
        </div>
        <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
          Based on {periodLabel} data
        </span>
      </div>

      {/* FLAG 1: Repeat Customer Abuse */}
      <section>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
          🔴 FLAG 1: Repeat Customer Abuse
        </h3>
        <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 12 }}>
          Customers appearing 2+ times across bad order, canceled, or refund in the same period.
        </p>
        {(data?.repeatCustomer?.length ?? 0) === 0 ? (
          <div style={{ padding: 16, background: 'var(--bg-overlay)', borderRadius: 8, color: 'var(--text-tertiary)', fontSize: 13 }}>No repeat customers flagged.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(data?.repeatCustomer ?? []).map((c, i) => (
              <div
                key={i}
                style={{
                  padding: '12px 14px',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 8,
                  borderLeft: `4px solid ${c.incidents >= 3 ? 'var(--danger-text)' : 'var(--warning-text, #eab308)'}`,
                }}
              >
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                  {c.incidents >= 3 ? '🔴' : '🟡'} {c.customer_name ?? 'Unknown'} — {c.incidents} incidents across {c.types.map(formatAuditType).join(' + ')}
                </span>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                  Stores: {c.stores.join(', ')} | Total: {fmt(c.total_amount, 'currency')}
                </div>
                {onViewDetails && (
                  <button
                    type="button"
                    onClick={() => onViewDetails()}
                    style={{ marginTop: 8, fontSize: 11, color: 'var(--brand)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  >
                    View Details →
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* FLAG 2: Cash Order Cancellations */}
      <section>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
          ⚠️ FLAG 2: Cash Order Cancellations
        </h3>
        <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 12 }}>
          Cash orders that were canceled or voided — highest fraud risk with no digital trail.
        </p>
        {(data?.cashCancellations?.length ?? 0) === 0 ? (
          <div style={{ padding: 16, background: 'var(--bg-overlay)', borderRadius: 8, color: 'var(--text-tertiary)', fontSize: 13 }}>No cash cancellations flagged.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(data?.cashCancellations ?? []).map((x, i) => (
              <div
                key={i}
                style={{
                  padding: '12px 14px',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 8,
                }}
              >
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                  ⚠️ Store {x.store_number} — {x.manager_name}
                </span>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                  {x.cash_incidents} cash {x.audit_type === 'canceled' ? 'cancellations' : 'order voids'} | {fmt(x.total_amount, 'currency')} total
                </div>
                {onViewDetails && (
                  <button
                    type="button"
                    onClick={() => onViewDetails(x.store_number, x.manager_name)}
                    style={{ marginTop: 8, fontSize: 11, color: 'var(--brand)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  >
                    View Details →
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* FLAG 3: Manager Incident Trend */}
      <section>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
          📈 FLAG 3: Manager Incident Trend
        </h3>
        <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 12 }}>
          Managers whose incidents increased vs. last period (current vs last period comparison).
        </p>
        {(data?.managerTrend?.length ?? 0) === 0 ? (
          <div style={{ padding: 16, background: 'var(--bg-overlay)', borderRadius: 8, color: 'var(--text-tertiary)', fontSize: 13 }}>No significant increases.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(data?.managerTrend ?? []).map((x, i) => (
              <div
                key={i}
                style={{
                  padding: '12px 14px',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 8,
                }}
              >
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                  📈 {x.manager_name} — Store {x.store_number}
                </span>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                  {formatAuditType(x.audit_type)}: {x.current_incidents} this period vs {x.last_incidents} last period ▲ worse
                </div>
                {onViewDetails && (
                  <button
                    type="button"
                    onClick={() => onViewDetails(x.store_number, x.manager_name)}
                    style={{ marginTop: 8, fontSize: 11, color: 'var(--brand)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  >
                    View Details →
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* FLAG 4: Store Performance vs Last Period */}
      <section>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
          🏪 FLAG 4: Store Performance vs Last Period
        </h3>
        <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 12 }}>
          Stores where total incidents increased more than 20% vs. last period.
        </p>
        {(data?.storePerformance?.length ?? 0) === 0 ? (
          <div style={{ padding: 16, background: 'var(--bg-overlay)', borderRadius: 8, color: 'var(--text-tertiary)', fontSize: 13 }}>No store data.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(data?.storePerformance ?? []).map((s, i) => (
              <div
                key={i}
                style={{
                  padding: '12px 14px',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 8,
                  borderLeft: `4px solid ${s.gettingWorse ? 'var(--danger-text)' : 'var(--success-text)'}`,
                }}
              >
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                  {s.gettingWorse ? '🔴' : '🟢'} Store {s.store_number} — {s.gettingWorse ? 'Getting Worse' : 'Improving'}
                </span>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>
                  {s.metrics.filter((m) => m.current > 0 || m.last > 0).map((m) => (
                    <div key={m.audit_type}>
                      {formatAuditType(m.audit_type)}: {m.current} → {m.last} ({m.pctChange > 0 ? '+' : ''}{m.pctChange}%) {m.pctChange <= 0 ? '✓' : ''}
                    </div>
                  ))}
                </div>
                {onViewDetails && (
                  <button
                    type="button"
                    onClick={() => onViewDetails(s.store_number)}
                    style={{ marginTop: 8, fontSize: 11, color: 'var(--brand)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  >
                    View Details →
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* FLAG 5: High Value Single Transactions */}
      <section>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
          🔴 FLAG 5: High Value Single Transactions
        </h3>
        <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 12 }}>
          Any single void/cancel/refund over $50 — need manual review.
        </p>
        {(data?.highValue?.length ?? 0) === 0 ? (
          <div style={{ padding: 16, background: 'var(--bg-overlay)', borderRadius: 8, color: 'var(--text-tertiary)', fontSize: 13 }}>No high-value transactions.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(data?.highValue ?? []).map((x, i) => (
              <div
                key={i}
                style={{
                  padding: '12px 14px',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 8,
                  borderLeft: '4px solid var(--danger-text)',
                }}
              >
                <span style={{ fontWeight: 600, color: 'var(--danger-text)' }}>
                  🔴 {fmt(x.amount, 'currency')} — Store {x.store_number}, {x.manager_name}
                </span>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                  {formatAuditType(x.audit_type ?? '')} | {x.reason ?? '—'} | {x.order_type ?? '—'} | {dateStr(x.business_date)}
                </div>
                {onViewDetails && (
                  <button
                    type="button"
                    onClick={() => onViewDetails(x.store_number, x.manager_name)}
                    style={{ marginTop: 8, fontSize: 11, color: 'var(--brand)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  >
                    View Details →
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* FLAG 6: Same Manager All Audit Types */}
      <section>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
          🚨 FLAG 6: Same Manager Multiple Audit Types
        </h3>
        <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 12 }}>
          Managers appearing in 2+ different audit types — indicates systemic issues.
        </p>
        {(data?.sameManagerAllTypes?.length ?? 0) === 0 ? (
          <div style={{ padding: 16, background: 'var(--bg-overlay)', borderRadius: 8, color: 'var(--text-tertiary)', fontSize: 13 }}>No managers flagged.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(data?.sameManagerAllTypes ?? []).map((x, i) => (
              <div
                key={i}
                style={{
                  padding: '12px 14px',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 8,
                  borderLeft: `4px solid ${x.type_count >= 3 ? 'var(--danger-text)' : 'var(--warning-text, #eab308)'}`,
                }}
              >
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                  🚨 {x.manager_name} — Store {x.store_number}
                </span>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                  Appears in: {x.types.map(formatAuditType).join(' + ')}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  {x.total_incidents} total incidents | {fmt(x.total_amount, 'currency')} total
                  {x.type_count >= 3 && (
                    <span style={{ marginLeft: 8, color: 'var(--danger-text)', fontWeight: 600 }}>→ HIGH RISK: Multiple manipulation types</span>
                  )}
                </div>
                {onViewDetails && (
                  <button
                    type="button"
                    onClick={() => onViewDetails(x.store_number, x.manager_name)}
                    style={{ marginTop: 8, fontSize: 11, color: 'var(--brand)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  >
                    View Details →
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
