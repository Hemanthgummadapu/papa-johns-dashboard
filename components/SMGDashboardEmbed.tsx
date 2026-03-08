'use client'

import { useState, useEffect } from 'react'
import { Lock } from 'lucide-react'
import SMGComments from './SMGComments'

interface SMGScore {
  id: string
  store_id: string
  period: string
  scraped_at: string
  focus_accuracy_current: number | null
  focus_accuracy_vs_previous: number | null
  focus_wait_time_current: number | null
  focus_wait_time_vs_previous: number | null
  osat_my_score: number | null
  osat_vs_last_period: number | null
  osat_pj_score: number | null
  osat_vs_pj: number | null
  accuracy_my_score: number | null
  accuracy_vs_last_period: number | null
  accuracy_pj_score: number | null
  accuracy_vs_pj: number | null
  csc_my_score: number | null
  csc_vs_last_period: number | null
  csc_pj_score: number | null
  csc_vs_pj: number | null
  comp_orders_my_score: number | null
  comp_orders_vs_last_period: number | null
  comp_orders_pj_score: number | null
  comp_orders_vs_pj: number | null
  comp_sales_my_score: number | null
  comp_sales_vs_last_period: number | null
  comp_sales_pj_score: number | null
  comp_sales_vs_pj: number | null
  ranking_store_responses: number | null
  ranking_store_osat: number | null
  ranking_store_taste_of_food: number | null
  ranking_store_accuracy_of_order: number | null
  ranking_store_wait_time: number | null
  ranking_store_friendliness: number | null
  ranking_pj_responses: number | null
  ranking_pj_osat: number | null
  ranking_pj_taste_of_food: number | null
  ranking_pj_accuracy_of_order: number | null
  ranking_pj_wait_time: number | null
  ranking_pj_friendliness: number | null
}

const STORE_COLORS = ['#e8410a', '#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#06b6d4']

const STORE_NAMES: Record<string, string> = {
  '2021': 'Tapo',
  '2081': 'Chatsworth',
  '2259': 'Canoga Park',
  '2292': 'Westhills',
  '2481': 'Madera',
  '3011': 'Northridge',
}

function normalizeStoreId(storeId: string): string {
  const n = parseInt(storeId.replace(/^0+/, ''), 10)
  return Number.isNaN(n) ? storeId : String(n)
}

const LockIcon = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: 4, flexShrink: 0 }}>
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
)

const EnvelopeIcon = ({ color = '#e8441a', size = 14 }: { color?: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: 6, flexShrink: 0 }}>
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
    <polyline points="22,6 12,13 2,6" />
  </svg>
)

export default function SMGDashboardEmbed() {
  const [data, setData] = useState<SMGScore[]>([])
  const [lastScraped, setLastScraped] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [selectedStore, setSelectedStore] = useState<string | null>(null)
  const [showStoreModal, setShowStoreModal] = useState(false)
  const [countdownSeconds, setCountdownSeconds] = useState(0)

  // Fetch data function
  const fetchData = async () => {
    try {
      // Add timestamp to bust cache
      const res = await fetch(`/api/smg-data?t=${Date.now()}`, { 
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
        }
      })
      if (res.ok) {
        const json = await res.json()
        setData(json.data || [])
        setLastScraped(json.lastScraped || null)
        setCountdownSeconds(5 * 60 * 60)
      }
    } catch (error) {
      console.error('Error fetching SMG data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Auto-countdown: count down every second, refresh when 0 and reset to 5 hours
  useEffect(() => {
    const interval = setInterval(() => {
      setCountdownSeconds((prev) => {
        const next = prev - 1
        if (next <= 0) {
          fetchData()
          return 5 * 60 * 60
        }
        return next
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  // Set initial countdown when data first loads (5 hours in seconds)
  useEffect(() => {
    if (lastScraped) {
      setCountdownSeconds(5 * 60 * 60)
    }
  }, [lastScraped])

  const formatCountdownDisplay = (seconds: number) => {
    if (seconds <= 0) return 'Due now'
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    if (h > 0) return `${h}h ${m}m ${s}s`
    if (m > 0) return `${m}m ${s}s`
    return `${s}s`
  }

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (showStoreModal) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [showStoreModal])

  // Initial data fetch
  useEffect(() => {
    fetchData()
  }, [])

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchData()
    setCountdownSeconds(5 * 60 * 60)
    setTimeout(() => setRefreshing(false), 1000)
  }

  const formatNumber = (value: number | null) => {
    if (value === null) return '—'
    return value.toFixed(1)
  }

  const formatPercent = (value: number | null) => {
    if (value === null) return '—'
    return `${value.toFixed(1)}%`
  }

  // Get top bar color for card based on OSAT
  const getTopBarColorByOSAT = (osat: number | null) => {
    if (osat === null) return 'var(--border-subtle)'
    if (osat >= 80) return '#22c55e'
    if (osat >= 65) return '#f59e0b'
    return '#ef4444'
  }

  // Get value color for metric vs threshold (PJ avg)
  const getMetricValueColor = (value: number | null, threshold: number) => {
    if (value === null) return 'rgba(255,255,255,0.25)'
    return value > threshold ? '#22c55e' : '#ef4444'
  }

  // Get border color for card based on OSAT comparison
  const getBorderColor = (storeOSAT: number | null, pjOSAT: number | null) => {
    if (storeOSAT === null || pjOSAT === null) return 'var(--border-subtle)'
    if (storeOSAT >= pjOSAT) return 'var(--success-text)'
    return 'var(--danger-text)'
  }

  // Get comparison badge for vs PJ
  const getComparisonBadge = (storeScore: number | null, pjScore: number | null) => {
    if (storeScore === null || pjScore === null) {
      return { text: '—', color: 'var(--text-tertiary)' }
    }
    const diff = storeScore - pjScore
    if (diff > 0) {
      return { text: `↑ +${diff.toFixed(1)}`, color: 'var(--success-text)' }
    } else if (diff < 0) {
      return { text: `↓ ${diff.toFixed(1)}`, color: 'var(--danger-text)' }
    }
    return { text: '—', color: 'var(--text-tertiary)' }
  }

  // Format delta for "Vs Last Period" and "Vs PJ"
  const formatDelta = (value: number | null) => {
    if (value === null) return { text: '—', color: 'var(--text-tertiary)' }
    if (value > 0) {
      return { text: `↑ +${value.toFixed(1)}`, color: 'var(--success-text)' }
    } else if (value < 0) {
      // For negative values, show absolute value with minus sign
      return { text: `↓ -${Math.abs(value).toFixed(1)}`, color: 'var(--danger-text)' }
    }
    return { text: '—', color: 'var(--text-tertiary)' }
  }

  // Get focus difference badge
  const getFocusDifference = (current: number | null, previous: number | null) => {
    if (current === null || previous === null) return null
    return current - previous
  }

  // Get ranking score color
  const getRankingColor = (storeValue: number | null, pjValue: number | null) => {
    if (storeValue === null || pjValue === null) return 'var(--text-primary)'
    if (storeValue >= pjValue) return 'var(--success-text)'
    return 'var(--danger-text)'
  }

  const selectedStoreData = selectedStore ? data.find(d => d.store_id === selectedStore) : null

  if (loading) {
    return (
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 40, textAlign: 'center' }}>
        <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 15, color: 'var(--text-primary)', marginBottom: 8 }}>Loading Guest Experience data...</div>
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 40, textAlign: 'center' }}>
        <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 15, color: 'var(--text-primary)', marginBottom: 8 }}>No data available</div>
        <div style={{ fontSize: 13, color: 'var(--text-tertiary)', fontFamily: "'Inter', sans-serif" }}>
          Data will appear here once it has been scraped and saved to the database.
        </div>
      </div>
    )
  }

  // Calculate staleness (5.5 hour threshold for 5-hour scrape interval)
  const isStale = lastScraped ? (Date.now() - new Date(lastScraped).getTime()) > (5.5 * 60 * 60 * 1000) : false
  const hoursAgo = lastScraped ? Math.floor((Date.now() - new Date(lastScraped).getTime()) / (60 * 60 * 1000)) : 0

  return (
    <div style={{ position: 'relative' }}>
      {/* Slim header row */}
      <div className="guest-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>Guest Experience</div>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>SMG Guest Experience scores and case management</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {lastScraped && (
            <div
              style={{
                padding: '4px 10px',
                borderRadius: 6,
                fontSize: 11,
                fontWeight: 600,
                background: isStale ? 'rgba(239,68,26,0.1)' : 'rgba(34,197,94,0.1)',
                border: isStale ? '1px solid rgba(239,68,26,0.2)' : '1px solid rgba(34,197,94,0.3)',
                color: isStale ? '#ef4444' : '#22c55e',
              }}
            >
              {isStale ? `⚠ Stale · last scraped ${hoursAgo} hours ago` : '● LIVE'}
            </div>
          )}
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
            Last scraped: {lastScraped ? new Date(lastScraped).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Never'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
            Next scrape: {formatCountdownDisplay(countdownSeconds) || '—'}
          </div>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            style={{
              padding: '5px 12px',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 600,
              background: '#e8410a',
              color: '#fff',
              border: 'none',
              cursor: refreshing ? 'not-allowed' : 'pointer',
              opacity: refreshing ? 0.7 : 1,
            }}
          >
            {refreshing ? 'Refreshing...' : '↻ Refresh'}
          </button>
        </div>
      </div>
      {/* GRID VIEW */}
      <div
        className="guest-cards-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 16,
          opacity: showStoreModal ? 0.3 : 1,
          transition: 'opacity 0.2s',
        }}
      >
        {data.map((store, idx) => {
          const storeKey = normalizeStoreId(store.store_id)
          const storeColor = STORE_COLORS[idx % STORE_COLORS.length]
          const displayName = `${storeKey} · ${STORE_NAMES[storeKey] ?? storeKey}`
          const topBarColor = getTopBarColorByOSAT(store.ranking_store_osat)
          const osatBadge = getComparisonBadge(store.ranking_store_osat, store.ranking_pj_osat)
          const accuracyBadge = getComparisonBadge(store.ranking_store_accuracy_of_order, store.ranking_pj_accuracy_of_order)
          const waitTimeBadge = getComparisonBadge(store.ranking_store_wait_time, store.ranking_pj_wait_time)
          const tasteBadge = getComparisonBadge(store.ranking_store_taste_of_food, store.ranking_pj_taste_of_food)
          const osatColor = getMetricValueColor(store.ranking_store_osat, 65)
          const accuracyColor = getMetricValueColor(store.ranking_store_accuracy_of_order, 72)
          const waitTimeColor = getMetricValueColor(store.ranking_store_wait_time, 65)
          const tasteColor = getMetricValueColor(store.ranking_store_taste_of_food, 62)

          return (
            <div
              key={store.store_id}
              onClick={() => {
                setSelectedStore(store.store_id)
                setShowStoreModal(true)
              }}
              style={{
                background: '#13151c',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 12,
                padding: 16,
                position: 'relative',
                overflow: 'hidden',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                if (!showStoreModal) {
                  e.currentTarget.style.borderColor = storeColor
                  e.currentTarget.style.transform = 'translateY(-2px)'
                }
              }}
              onMouseLeave={(e) => {
                if (!showStoreModal) {
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'
                  e.currentTarget.style.transform = 'none'
                }
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: 3,
                  background: topBarColor,
                  borderRadius: '12px 12px 0 0',
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 0 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                    {displayName}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                    {store.scraped_at ? new Date(store.scraped_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Never'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelectedStore(store.store_id)
                    setShowStoreModal(true)
                  }}
                  style={{
                    padding: '6px 13px',
                    borderRadius: 20,
                    fontSize: 13,
                    fontWeight: 500,
                    background: 'rgba(255,255,255,0.06)',
                    color: 'rgba(255,255,255,0.6)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.15s',
                  }}
                >
                  View →
                </button>
              </div>

              {/* Section 1 — SMG Score Metrics (existing) */}
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: 14 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }} className="guest-metric-grid">
                {/* OSAT */}
                <div style={{ background: '#0e1018', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 7, padding: '10px 12px' }}>
                  <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.35)', marginBottom: 6 }}>OSAT</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: osatColor }}>
                    {formatNumber(store.ranking_store_osat)}
                  </div>
                  <div style={{ fontSize: 11, marginTop: 3, color: osatBadge.color }}>
                    {osatBadge.text} vs PJ
                  </div>
                </div>

                {/* Accuracy */}
                <div style={{ background: '#0e1018', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 7, padding: '10px 12px' }}>
                  <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.35)', marginBottom: 6 }}>ACCURACY</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: accuracyColor }}>
                    {formatNumber(store.ranking_store_accuracy_of_order)}
                  </div>
                  <div style={{ fontSize: 11, marginTop: 3, color: accuracyBadge.color }}>
                    {accuracyBadge.text} vs PJ
                  </div>
                </div>

                {/* Wait Time */}
                <div style={{ background: '#0e1018', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 7, padding: '10px 12px' }}>
                  <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.35)', marginBottom: 6 }}>WAIT TIME</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: waitTimeColor }}>
                    {formatNumber(store.ranking_store_wait_time)}
                  </div>
                  <div style={{ fontSize: 11, marginTop: 3, color: waitTimeBadge.color }}>
                    {waitTimeBadge.text} vs PJ
                  </div>
                </div>

                {/* Taste of Food */}
                <div style={{ background: '#0e1018', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 7, padding: '10px 12px' }}>
                  <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.35)', marginBottom: 6 }}>TASTE</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: tasteColor }}>
                    {formatNumber(store.ranking_store_taste_of_food)}
                  </div>
                  <div style={{ fontSize: 11, marginTop: 3, color: tasteBadge.color }}>
                    {tasteBadge.text} vs PJ
                  </div>
                </div>
              </div>
              </div>

              {/* Section 2 — Case Intelligence Row (only when data is available) */}
              {store.ranking_store_responses != null && (
              <div className="border-t border-gray-700 pt-3 grid gap-3 text-center" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.3)', marginBottom: 4 }}>CASES</div>
                  <div className="flex justify-center items-center min-h-[18px]">
                    <Lock size={14} className="text-gray-500 flex-shrink-0" />
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.3)', marginBottom: 4 }}>AVG RESOLVE</div>
                  <div className="flex justify-center items-center min-h-[18px]">
                    <Lock size={14} className="text-gray-500 flex-shrink-0" />
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.3)', marginBottom: 4 }}>ESCALATED</div>
                  <div className="flex justify-center items-center min-h-[18px]">
                    <Lock size={14} className="text-gray-500 flex-shrink-0" />
                  </div>
                </div>
              </div>
              )}

              {/* Section 3 — Single coming-soon badge */}
              <div className="flex flex-wrap justify-start pt-3">
                <span className="inline-block rounded-full border border-gray-700 px-3 py-1 text-xs text-gray-500 select-none">
                  🔒 Case Management — Coming Soon
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Single subtle coming soon indicator — pill/badge at bottom center */}
      <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.04)', display: 'flex', justifyContent: 'center' }}>
        <span style={{
          display: 'inline-block',
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 20,
          padding: '6px 14px',
          fontSize: 10,
          fontWeight: 600,
          color: 'rgba(255,255,255,0.4)',
          letterSpacing: '0.05em',
        }}>
          Alerts & notifications — Coming soon
        </span>
      </div>

      {/* Comments section - hidden when modal is open */}
      {!showStoreModal && (
        <div style={{ marginTop: 40 }}>
          <SMGComments comments={[]} />
        </div>
      )}

      {/* MODAL VIEW */}
      {showStoreModal && selectedStoreData && (
        <div
          className="fixed inset-0 z-[99999] flex items-start justify-center overflow-hidden p-6 pt-14"
          style={{ background: 'transparent', pointerEvents: 'none' }}
          onClick={() => setShowStoreModal(false)}
        >
          <div
            className="flex max-h-[80vh] w-full max-w-[860px] flex-col overflow-hidden rounded-2xl border border-[var(--border-subtle)] shadow-2xl"
            style={{
              background: 'var(--bg-surface)',
              fontFamily: "'Inter', sans-serif",
              pointerEvents: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header — fixed at top, does not scroll */}
            <div className="flex flex-shrink-0 items-center justify-between border-b border-[var(--border-subtle)] px-8 py-5">
              <div>
                <div className="text-2xl font-bold text-[var(--text-primary)]">
                  {(() => { const k = normalizeStoreId(selectedStoreData.store_id); return `${k} · ${STORE_NAMES[k] ?? k}`; })()}
                </div>
                <div className="mt-1 text-sm text-[var(--text-tertiary)]">
                  Last scraped: {selectedStoreData.scraped_at ? new Date(selectedStoreData.scraped_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Never'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowStoreModal(false)}
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-[var(--border-default)] bg-[var(--bg-overlay)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
                style={{ fontSize: 18 }}
              >
                ×
              </button>
            </div>

            {/* Scrollable body */}
            <div className="guest-modal-scroll flex-1 overflow-y-auto overflow-x-hidden px-8 pb-8 pt-6">

            {/* SECTION 1 — WHERE SHOULD I FOCUS? */}
            <div style={{ marginTop: 40 }}>
              <div style={{ 
                color: 'var(--text-primary)', 
                fontSize: 18, 
                fontWeight: 600, 
                fontFamily: "'Inter', sans-serif",
                borderBottom: '2px solid var(--border-subtle)',
                paddingBottom: 8,
                marginBottom: 16
              }}>
                WHERE SHOULD I FOCUS?
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th className="text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]" style={{ padding: '12px 0', borderBottom: '1px solid var(--border-subtle)' }}>METRIC</th>
                    <th className="text-center text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]" style={{ padding: '12px 0', borderBottom: '1px solid var(--border-subtle)' }}>CURRENT</th>
                    <th className="text-right text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]" style={{ padding: '12px 0', borderBottom: '1px solid var(--border-subtle)' }}>VS PREVIOUS</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ textAlign: 'left', fontSize: 14, color: 'var(--text-primary)', padding: '18px 0', borderBottom: '1px solid var(--border-subtle)' }}>Accuracy of Order</td>
                    <td style={{ textAlign: 'center', fontSize: 14, color: 'var(--text-primary)', fontWeight: 700, padding: '18px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                      {formatNumber(selectedStoreData.focus_accuracy_current)}%
                    </td>
                    <td style={{ textAlign: 'right', fontSize: 14, fontWeight: 700, padding: '18px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                      {(() => {
                        const diff = selectedStoreData.focus_accuracy_vs_previous
                        if (diff === null || diff === undefined) return <span style={{ color: 'var(--text-tertiary)' }}>—</span>
                        if (diff > 0) {
                          return <span style={{ color: 'var(--success-text)' }}>↑ +{diff.toFixed(1)}</span>
                        } else if (diff < 0) {
                          return <span style={{ color: 'var(--danger-text)' }}>↓ {diff.toFixed(1)}</span>
                        }
                        return <span style={{ color: 'var(--text-tertiary)' }}>—</span>
                      })()}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ textAlign: 'left', fontSize: 14, color: 'var(--text-primary)', padding: '18px 0', borderBottom: '1px solid var(--border-subtle)' }}>Wait Time</td>
                    <td style={{ textAlign: 'center', fontSize: 14, color: 'var(--text-primary)', fontWeight: 700, padding: '18px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                      {formatNumber(selectedStoreData.focus_wait_time_current)}%
                    </td>
                    <td style={{ textAlign: 'right', fontSize: 14, fontWeight: 700, padding: '18px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                      {(() => {
                        const diff = selectedStoreData.focus_wait_time_vs_previous
                        if (diff === null || diff === undefined) return <span style={{ color: 'var(--text-tertiary)' }}>—</span>
                        if (diff > 0) {
                          return <span style={{ color: 'var(--success-text)' }}>↑ +{diff.toFixed(1)}</span>
                        } else if (diff < 0) {
                          return <span style={{ color: 'var(--danger-text)' }}>↓ {diff.toFixed(1)}</span>
                        }
                        return <span style={{ color: 'var(--text-tertiary)' }}>—</span>
                      })()}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* SECTION 2 — HOW ARE WE DOING? */}
            <div style={{ marginTop: 40 }}>
              <div style={{ 
                color: 'var(--text-primary)', 
                fontSize: 18, 
                fontWeight: 600, 
                fontFamily: "'Inter', sans-serif",
                borderBottom: '2px solid var(--border-subtle)',
                paddingBottom: 8,
                marginBottom: 16
              }}>
                HOW ARE WE DOING?
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th className="text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]" style={{ padding: '12px 0', borderBottom: '1px solid var(--border-subtle)' }}>METRIC</th>
                    <th className="text-center text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]" style={{ padding: '12px 0', borderBottom: '1px solid var(--border-subtle)' }}>MY SCORE</th>
                    <th className="text-center text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]" style={{ padding: '12px 0', borderBottom: '1px solid var(--border-subtle)' }}>VS LAST PERIOD</th>
                    <th className="text-center text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]" style={{ padding: '12px 0', borderBottom: '1px solid var(--border-subtle)' }}>PAPA JOHN'S</th>
                    <th className="text-center text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]" style={{ padding: '12px 0', borderBottom: '1px solid var(--border-subtle)' }}>VS PJ</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { key: 'osat', label: 'Overall Satisfaction', my: selectedStoreData.osat_my_score, vsLast: selectedStoreData.osat_vs_last_period, pj: selectedStoreData.osat_pj_score, vsPj: selectedStoreData.osat_vs_pj },
                    { key: 'accuracy', label: 'Accuracy of Order', my: selectedStoreData.accuracy_my_score, vsLast: selectedStoreData.accuracy_vs_last_period, pj: selectedStoreData.accuracy_pj_score, vsPj: selectedStoreData.accuracy_vs_pj },
                    { key: 'csc', label: 'CSC', my: selectedStoreData.csc_my_score, vsLast: selectedStoreData.csc_vs_last_period, pj: selectedStoreData.csc_pj_score, vsPj: selectedStoreData.csc_vs_pj },
                    { key: 'comp_orders', label: 'Comp Orders', my: selectedStoreData.comp_orders_my_score, vsLast: selectedStoreData.comp_orders_vs_last_period, pj: selectedStoreData.comp_orders_pj_score, vsPj: selectedStoreData.comp_orders_vs_pj },
                    { key: 'comp_sales', label: 'Comp Sales', my: selectedStoreData.comp_sales_my_score, vsLast: selectedStoreData.comp_sales_vs_last_period, pj: selectedStoreData.comp_sales_pj_score, vsPj: selectedStoreData.comp_sales_vs_pj },
                  ].map((item, idx) => {
                    // vs_last_period is stored with correct sign from SMG (based on arrow/color)
                    // Positive = improving, Negative = declining
                    const vsLastDiff = item.vsLast !== null ? item.vsLast : null
                    const vsPjDiff = (item.my ?? 0) - (item.pj ?? 0)
                    return (
                      <tr key={item.key} className="py-3" style={{ background: idx % 2 === 0 ? 'transparent' : 'var(--bg-base)' }}>
                        <td className="py-3" style={{ textAlign: 'left', fontSize: 14, color: 'var(--text-primary)' }}>{item.label}</td>
                        <td className="py-3" style={{ textAlign: 'center', fontSize: 14, color: 'var(--text-primary)', fontWeight: 700 }}>
                          {formatNumber(item.my)}%
                        </td>
                        <td className="py-3" style={{ textAlign: 'center', fontSize: 14, fontWeight: 500 }}>
                          {vsLastDiff === null ? (
                            <span style={{ color: 'var(--text-tertiary)' }}>—</span>
                          ) : vsLastDiff > 0 ? (
                            <span style={{ color: 'var(--success-text)' }}>↑ +{vsLastDiff.toFixed(1)}</span>
                          ) : (
                            <span style={{ color: 'var(--danger-text)' }}>↓ {vsLastDiff.toFixed(1)}</span>
                          )}
                        </td>
                        <td className="py-3" style={{ textAlign: 'center', fontSize: 14, color: 'var(--info-text)', fontWeight: 700 }}>
                          {formatNumber(item.pj)}%
                        </td>
                        <td className="py-3" style={{ textAlign: 'center', fontSize: 14, fontWeight: 500 }}>
                          {vsPjDiff === 0 && (item.my === null || item.pj === null) ? (
                            <span style={{ color: 'var(--text-tertiary)' }}>—</span>
                          ) : vsPjDiff > 0 ? (
                            <span style={{ color: 'var(--success-text)' }}>↑ +{vsPjDiff.toFixed(1)}</span>
                          ) : vsPjDiff < 0 ? (
                            <span style={{ color: 'var(--danger-text)' }}>↓ {vsPjDiff.toFixed(1)}</span>
                          ) : (
                            <span style={{ color: 'var(--text-tertiary)' }}>—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* SECTION 3 — RANKING */}
            <div className="mt-6">
              <div
                className="mb-3"
                style={{ 
                  color: 'var(--text-primary)', 
                  fontSize: 18, 
                  fontWeight: 600, 
                  fontFamily: "'Inter', sans-serif",
                  borderBottom: '2px solid var(--border-subtle)',
                  paddingBottom: 8
                }}
              >
                RANKING
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th className="text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]" style={{ padding: '12px 12px', borderBottom: '1px solid var(--border-subtle)' }}>STORE</th>
                    <th className="text-center text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]" style={{ padding: '12px 12px', borderBottom: '1px solid var(--border-subtle)' }}>RESP</th>
                    <th className="text-center text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]" style={{ padding: '12px 12px', borderBottom: '1px solid var(--border-subtle)' }}>OSAT</th>
                    <th className="text-center text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]" style={{ padding: '12px 12px', borderBottom: '1px solid var(--border-subtle)' }}>TASTE</th>
                    <th className="text-center text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]" style={{ padding: '12px 12px', borderBottom: '1px solid var(--border-subtle)' }}>ACCURACY</th>
                    <th className="text-center text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]" style={{ padding: '12px 12px', borderBottom: '1px solid var(--border-subtle)' }}>WAIT TIME</th>
                    <th className="text-center text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]" style={{ padding: '12px 12px', borderBottom: '1px solid var(--border-subtle)' }}>FRIENDLINESS</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Store row */}
                  <tr>
                    <td style={{ textAlign: 'left', fontSize: 14, color: 'var(--text-primary)', fontWeight: 700, padding: '18px 12px' }}>
                      {(() => { const k = normalizeStoreId(selectedStoreData.store_id); return `${k} · ${STORE_NAMES[k] ?? k}`; })()}
                    </td>
                    <td style={{ textAlign: 'center', fontSize: 14, color: (selectedStoreData.ranking_store_responses ?? 0) >= (selectedStoreData.ranking_pj_responses ?? 0) ? 'var(--success-text)' : 'var(--danger-text)', fontWeight: 700, padding: '18px 12px' }}>
                      {selectedStoreData.ranking_store_responses ?? '—'}
                    </td>
                    <td style={{ textAlign: 'center', fontSize: 14, color: (selectedStoreData.ranking_store_osat ?? 0) >= (selectedStoreData.ranking_pj_osat ?? 0) ? 'var(--success-text)' : 'var(--danger-text)', fontWeight: 700, padding: '18px 12px' }}>
                      {formatNumber(selectedStoreData.ranking_store_osat)}%
                    </td>
                    <td style={{ textAlign: 'center', fontSize: 14, color: (selectedStoreData.ranking_store_taste_of_food ?? 0) >= (selectedStoreData.ranking_pj_taste_of_food ?? 0) ? 'var(--success-text)' : 'var(--danger-text)', fontWeight: 700, padding: '18px 12px' }}>
                      {formatNumber(selectedStoreData.ranking_store_taste_of_food)}%
                    </td>
                    <td style={{ textAlign: 'center', fontSize: 14, color: (selectedStoreData.ranking_store_accuracy_of_order ?? 0) >= (selectedStoreData.ranking_pj_accuracy_of_order ?? 0) ? 'var(--success-text)' : 'var(--danger-text)', fontWeight: 700, padding: '18px 12px' }}>
                      {formatNumber(selectedStoreData.ranking_store_accuracy_of_order)}%
                    </td>
                    <td style={{ textAlign: 'center', fontSize: 14, color: (selectedStoreData.ranking_store_wait_time ?? 0) >= (selectedStoreData.ranking_pj_wait_time ?? 0) ? 'var(--success-text)' : 'var(--danger-text)', fontWeight: 700, padding: '18px 12px' }}>
                      {formatNumber(selectedStoreData.ranking_store_wait_time)}%
                    </td>
                    <td style={{ textAlign: 'center', fontSize: 14, color: (selectedStoreData.ranking_store_friendliness ?? 0) >= (selectedStoreData.ranking_pj_friendliness ?? 0) ? 'var(--success-text)' : 'var(--danger-text)', fontWeight: 700, padding: '18px 12px' }}>
                      {formatNumber(selectedStoreData.ranking_store_friendliness)}%
                    </td>
                  </tr>
                  {/* Papa John's row */}
                  <tr style={{ background: 'var(--bg-base)' }}>
                    <td style={{ textAlign: 'left', fontSize: 14, color: 'var(--info-text)', fontWeight: 700, padding: '18px 12px' }}>
                      Papa John's
                    </td>
                    <td style={{ textAlign: 'center', fontSize: 14, color: 'var(--info-text)', fontWeight: 700, padding: '18px 12px' }}>
                      {selectedStoreData.ranking_pj_responses ?? '—'}
                    </td>
                    <td style={{ textAlign: 'center', fontSize: 14, color: 'var(--info-text)', fontWeight: 700, padding: '18px 12px' }}>
                      {formatNumber(selectedStoreData.ranking_pj_osat)}%
                    </td>
                    <td style={{ textAlign: 'center', fontSize: 14, color: 'var(--info-text)', fontWeight: 700, padding: '18px 12px' }}>
                      {formatNumber(selectedStoreData.ranking_pj_taste_of_food)}%
                    </td>
                    <td style={{ textAlign: 'center', fontSize: 14, color: 'var(--info-text)', fontWeight: 700, padding: '18px 12px' }}>
                      {formatNumber(selectedStoreData.ranking_pj_accuracy_of_order)}%
                    </td>
                    <td style={{ textAlign: 'center', fontSize: 14, color: 'var(--info-text)', fontWeight: 700, padding: '18px 12px' }}>
                      {formatNumber(selectedStoreData.ranking_pj_wait_time)}%
                    </td>
                    <td style={{ textAlign: 'center', fontSize: 14, color: 'var(--info-text)', fontWeight: 700, padding: '18px 12px' }}>
                      {formatNumber(selectedStoreData.ranking_pj_friendliness)}%
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
