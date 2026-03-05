'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import AuditUpload from '@/components/audit/AuditUpload'
import AuditSummaryTable from '@/components/audit/AuditSummaryTable'
import AuditDetailsTable from '@/components/audit/AuditDetailsTable'
import FraudFlags from '@/components/audit/FraudFlags'

export type TimePeriodTab = 'current_period' | 'last_period' | 'last_year'

const TIME_PERIOD_TABS: { value: TimePeriodTab; label: string }[] = [
  { value: 'current_period', label: 'Current Period' },
  { value: 'last_period', label: 'Last Period' },
  { value: 'last_year', label: 'Last Year' },
]

const AUDIT_LABELS: Record<string, string> = {
  bad_order: 'Bad Orders',
  zeroed_out: 'Zeroed Out',
  canceled: 'Canceled',
  refund: 'Refund',
}

export default function AuditPage() {
  const router = useRouter()
  const [timePeriod, setTimePeriod] = useState<TimePeriodTab>('current_period')
  const [refreshKey, setRefreshKey] = useState(0)
  const [showSyncSettings, setShowSyncSettings] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'summary' | 'details' | 'fraud'>('summary')
  const [cardData, setCardData] = useState<Record<string, { totalIncidents: number; totalAmount: number }>>({})
  const [comparisonData, setComparisonData] = useState<Record<string, { totalIncidents: number; totalAmount: number }>>({})
  const [comparisonLabel, setComparisonLabel] = useState<string>('Last Period')
  const [detailsFilter, setDetailsFilter] = useState<{ store?: string; manager?: string }>({})

  const fetchSummaryData = useCallback(async () => {
    setCardData({})
    setComparisonData({})
    const res = await fetch(`/api/audit/summary/aggregate?time_period=${encodeURIComponent(timePeriod)}`)
    const resData = await res.json()
    const rows = (resData.data ?? []) as Array<{ audit_type: string; total_incidents: number; total_amount: number }>
    const next: Record<string, { totalIncidents: number; totalAmount: number }> = {}
    ;['bad_order', 'zeroed_out', 'canceled', 'refund'].forEach((audit_type) => {
      const cur = rows.find((r) => r.audit_type === audit_type)
      next[audit_type] = {
        totalIncidents: cur?.total_incidents ?? 0,
        totalAmount: cur?.total_amount ?? 0,
      }
    })
    setCardData(next)
    const compRows = (resData.comparison ?? []) as Array<{ audit_type: string; total_incidents: number; total_amount: number }>
    const comp: Record<string, { totalIncidents: number; totalAmount: number }> = {}
    ;['bad_order', 'zeroed_out', 'canceled', 'refund'].forEach((audit_type) => {
      const c = compRows.find((r) => r.audit_type === audit_type)
      comp[audit_type] = {
        totalIncidents: c?.total_incidents ?? 0,
        totalAmount: c?.total_amount ?? 0,
      }
    })
    setComparisonData(comp)
    setComparisonLabel(resData.comparisonLabel ?? 'Last Period')
  }, [timePeriod])

  useEffect(() => {
    fetchSummaryData()
  }, [fetchSummaryData, refreshKey])

  return (
    <div style={{ background: 'var(--bg-base, #0a0b0f)', minHeight: '100vh', color: 'var(--text-primary, #f1f3f9)' }}>
      <div style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-subtle)', padding: '0 32px' }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 32, height: 32, borderRadius: 6, background: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, color: '#fff' }}>PJ</div>
            <div>
              <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 16, color: 'var(--text-primary)' }}>Papa Johns Ops</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Audit — Zero, Bad & Canceled Orders</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 4, background: 'var(--bg-overlay)', borderRadius: 8, padding: 4, border: '1px solid var(--border-subtle)' }}>
            <Link href="/dashboard" style={{ padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, background: 'transparent', color: 'var(--text-tertiary)', textDecoration: 'none' }}>Dashboard</Link>
            <Link href="/trends" style={{ padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, background: 'transparent', color: 'var(--text-tertiary)', textDecoration: 'none' }}>Trends</Link>
            <Link href="/analytics/profitability" style={{ padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, background: 'transparent', color: 'var(--text-tertiary)', textDecoration: 'none' }}>Analytics</Link>
            <span style={{ padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, background: 'var(--brand)', color: '#fff' }}>Audit</span>
            <Link href="/ai" style={{ padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, background: 'transparent', color: 'var(--text-tertiary)', textDecoration: 'none' }}>✨ AI</Link>
            <Link href="/dashboard" style={{ padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, background: 'transparent', color: 'var(--text-tertiary)', textDecoration: 'none' }}>Live</Link>
            <Link href="/dashboard" style={{ padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, background: 'transparent', color: 'var(--text-tertiary)', textDecoration: 'none' }}>Guest Experience</Link>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11, color: 'var(--text-tertiary)' }}>
            {lastUpdated && <span>Last updated: {lastUpdated}</span>}
            <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 500, background: 'var(--success-subtle)', color: 'var(--success-text)' }}>
              {TIME_PERIOD_TABS.find((t) => t.value === timePeriod)?.label ?? timePeriod}
            </span>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1400, margin: '0 auto', padding: 24 }}>
        {/* Collapsible Upload at top — hidden by default */}
        <div style={{ marginBottom: 20 }}>
          <button
            type="button"
            onClick={() => setShowSyncSettings((s) => !s)}
            style={{
              padding: '8px 14px',
              borderRadius: 8,
              border: '1px solid var(--border-default)',
              background: 'var(--bg-overlay)',
              color: 'var(--text-secondary)',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {showSyncSettings ? '▼' : '▶'} Upload Tableau Data
          </button>
          {showSyncSettings && (
            <div style={{ marginTop: 12 }}>
              <AuditUpload
                selectedTimePeriod={timePeriod}
                onUploadComplete={() => {
                  setRefreshKey((k) => k + 1)
                  setLastUpdated(new Date().toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' }))
                  fetchSummaryData()
                  router.refresh()
                }}
              />
            </div>
          )}
        </div>

        {/* Time period tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid var(--border-subtle)' }}>
          {TIME_PERIOD_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setTimePeriod(tab.value)}
              style={{
                padding: '10px 20px',
                borderRadius: 8,
                border: 'none',
                fontFamily: "'Inter', sans-serif",
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                background: timePeriod === tab.value ? 'var(--brand)' : 'transparent',
                color: timePeriod === tab.value ? '#fff' : 'var(--text-tertiary)',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Summary cards — 4 cards for selected time period */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {(['bad_order', 'zeroed_out', 'canceled', 'refund'] as const).map((type) => {
            const d = cardData[type]
            const incidents = d?.totalIncidents ?? 0
            const amount = d?.totalAmount ?? 0
            const comp = comparisonData[type]
            const compIncidents = comp?.totalIncidents ?? 0
            return (
              <div
                key={type}
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 12,
                  padding: 16,
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 8 }}>{AUDIT_LABELS[type]}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>{incidents.toLocaleString()} incidents</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>${amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 8 }}>
                  vs {comparisonLabel}: {compIncidents} ▼
                </div>
              </div>
            )
          })}
        </div>

        {/* Content tabs: Summary | Details | Fraud Flags */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid var(--border-subtle)' }}>
          {(['summary', 'details', 'fraud'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '10px 20px',
                borderRadius: 8,
                border: 'none',
                fontFamily: "'Inter', sans-serif",
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                background: activeTab === tab ? 'var(--brand)' : 'transparent',
                color: activeTab === tab ? '#fff' : 'var(--text-tertiary)',
              }}
            >
              {tab === 'summary' ? 'Summary' : tab === 'details' ? 'Details' : 'Fraud Flags'}
            </button>
          ))}
        </div>

        {activeTab === 'summary' && (
          <AuditSummaryTable timePeriod={timePeriod} refreshKey={refreshKey} />
        )}
        {activeTab === 'details' && (
          <AuditDetailsTable
            timePeriod={timePeriod}
            refreshKey={refreshKey}
            initialStore={detailsFilter.store}
            initialManager={detailsFilter.manager}
          />
        )}
        {activeTab === 'fraud' && (
          <FraudFlags
            timePeriod={timePeriod}
            onViewDetails={(storeNumber, managerName) => {
              setDetailsFilter({ store: storeNumber, manager: managerName })
              setActiveTab('details')
            }}
          />
        )}
      </div>
    </div>
  )
}
