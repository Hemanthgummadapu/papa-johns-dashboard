'use client'

import { useState, useEffect } from 'react'

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

export default function SMGDashboardEmbed() {
  const [data, setData] = useState<SMGScore[]>([])
  const [lastScraped, setLastScraped] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [selectedStore, setSelectedStore] = useState<string | null>(null)
  const [showStoreModal, setShowStoreModal] = useState(false)
  const [countdown, setCountdown] = useState<string>('')

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
      }
    } catch (error) {
      console.error('Error fetching SMG data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Calculate and update countdown for next scrape (every 5 hours)
  useEffect(() => {
    const updateCountdown = () => {
      if (!lastScraped) {
        setCountdown('—')
        return
      }

      const lastScrapedTime = new Date(lastScraped).getTime()
      const nextScrapeTime = lastScrapedTime + (5 * 60 * 60 * 1000) // 5 hours in milliseconds
      const now = Date.now()
      const diff = nextScrapeTime - now

      if (diff <= 0) {
        setCountdown('Due now')
        return
      }

      const hours = Math.floor(diff / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((diff % (1000 * 60)) / 1000)

      if (hours > 0) {
        setCountdown(`${hours}h ${minutes}m ${seconds}s`)
      } else if (minutes > 0) {
        setCountdown(`${minutes}m ${seconds}s`)
      } else {
        setCountdown(`${seconds}s`)
      }
    }

    updateCountdown()
    const interval = setInterval(updateCountdown, 1000) // Update every second
    return () => clearInterval(interval)
  }, [lastScraped])

  // Auto-refresh every 5 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      fetchData()
    }, 5 * 60 * 1000) // refresh every 5 minutes
    return () => clearInterval(interval)
  }, [])

  // Initial data fetch
  useEffect(() => {
    fetchData()
  }, [])

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchData()
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

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 16, marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', fontFamily: "'Inter', sans-serif" }}>
          Last scraped:{' '}
          {lastScraped
            ? new Date(lastScraped).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })
            : 'Never'}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', fontFamily: "'Inter', sans-serif" }}>
          Next scrape:{' '}
          <span style={{ color: 'var(--text-secondary)', fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>
            {countdown || '—'}
          </span>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          style={{
            height: 32,
            padding: '0 12px',
            borderRadius: 8,
            border: '1px solid var(--border-default)',
            background: 'var(--bg-overlay)',
            color: 'var(--text-secondary)',
            cursor: refreshing ? 'not-allowed' : 'pointer',
            opacity: refreshing ? 0.6 : 1,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            fontSize: 12,
            fontFamily: "'Inter', sans-serif",
            fontWeight: 600,
            transition: 'all 0.15s',
          }}
          onMouseEnter={(e) => {
            if (!refreshing) {
              e.currentTarget.style.background = 'var(--bg-elevated)'
              e.currentTarget.style.color = 'var(--text-primary)'
            }
          }}
          onMouseLeave={(e) => {
            if (!refreshing) {
              e.currentTarget.style.background = 'var(--bg-overlay)'
              e.currentTarget.style.color = 'var(--text-secondary)'
            }
          }}
        >
          {refreshing ? '⏳ Refreshing...' : '🔄 Refresh'}
        </button>
      </div>
      {/* GRID VIEW */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))',
          gap: 16,
          opacity: showStoreModal ? 0.3 : 1,
          transition: 'opacity 0.2s',
        }}
      >
        {data.map((store, idx) => {
          const storeColor = STORE_COLORS[idx % STORE_COLORS.length]
          const borderColor = getBorderColor(store.ranking_store_osat, store.ranking_pj_osat)
          const osatBadge = getComparisonBadge(store.ranking_store_osat, store.ranking_pj_osat)
          const accuracyBadge = getComparisonBadge(store.ranking_store_accuracy_of_order, store.ranking_pj_accuracy_of_order)
          const waitTimeBadge = getComparisonBadge(store.ranking_store_wait_time, store.ranking_pj_wait_time)
          const tasteBadge = getComparisonBadge(store.ranking_store_taste_of_food, store.ranking_pj_taste_of_food)

          return (
            <div
              key={store.store_id}
              onClick={() => {
                setSelectedStore(store.store_id)
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
                if (!showStoreModal) {
                  e.currentTarget.style.borderColor = storeColor
                  e.currentTarget.style.transform = 'translateY(-2px)'
                }
              }}
              onMouseLeave={(e) => {
                if (!showStoreModal) {
                  e.currentTarget.style.borderColor = 'var(--border-subtle)'
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
                  background: borderColor,
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div>
                  <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 15, color: 'var(--text-primary)' }}>
                    Store {store.store_id}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2, fontFamily: "'Inter', sans-serif", fontWeight: 400 }}>
                    {store.scraped_at ? new Date(store.scraped_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Never'}
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
                  {store.store_id.slice(-2)}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {/* OSAT */}
                <div style={{ background: 'var(--bg-base)', borderRadius: 8, padding: '12px' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: "'Inter', sans-serif", fontWeight: 500, letterSpacing: '0.08em', marginBottom: 8 }}>
                    OSAT
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-primary)', marginBottom: 4 }}>
                    {formatNumber(store.ranking_store_osat)}
                  </div>
                  <div style={{ fontSize: 11, color: osatBadge.color, fontFamily: "'Inter', sans-serif" }}>
                    {osatBadge.text} vs PJ
                  </div>
                </div>

                {/* Accuracy */}
                <div style={{ background: 'var(--bg-base)', borderRadius: 8, padding: '12px' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: "'Inter', sans-serif", fontWeight: 500, letterSpacing: '0.08em', marginBottom: 8 }}>
                    ACCURACY
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-primary)', marginBottom: 4 }}>
                    {formatNumber(store.ranking_store_accuracy_of_order)}
                  </div>
                  <div style={{ fontSize: 11, color: accuracyBadge.color, fontFamily: "'Inter', sans-serif" }}>
                    {accuracyBadge.text} vs PJ
                  </div>
                </div>

                {/* Wait Time */}
                <div style={{ background: 'var(--bg-base)', borderRadius: 8, padding: '12px' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: "'Inter', sans-serif", fontWeight: 500, letterSpacing: '0.08em', marginBottom: 8 }}>
                    WAIT TIME
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-primary)', marginBottom: 4 }}>
                    {formatNumber(store.ranking_store_wait_time)}
                  </div>
                  <div style={{ fontSize: 11, color: waitTimeBadge.color, fontFamily: "'Inter', sans-serif" }}>
                    {waitTimeBadge.text} vs PJ
                  </div>
                </div>

                {/* Taste of Food */}
                <div style={{ background: 'var(--bg-base)', borderRadius: 8, padding: '12px' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: "'Inter', sans-serif", fontWeight: 500, letterSpacing: '0.08em', marginBottom: 8 }}>
                    TASTE
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-primary)', marginBottom: 4 }}>
                    {formatNumber(store.ranking_store_taste_of_food)}
                  </div>
                  <div style={{ fontSize: 11, color: tasteBadge.color, fontFamily: "'Inter', sans-serif" }}>
                    {tasteBadge.text} vs PJ
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* MODAL VIEW */}
      {showStoreModal && selectedStoreData && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.85)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 40,
            overflowY: 'auto',
          }}
          onClick={() => setShowStoreModal(false)}
        >
          <div
            style={{
              background: 'var(--bg-surface)',
              borderRadius: 16,
              padding: 32,
              maxWidth: 860,
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              position: 'relative',
              margin: 'auto',
              border: '1px solid var(--border-subtle)',
              fontFamily: "'Inter', sans-serif",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <div>
                <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: 24, color: 'var(--text-primary)' }}>
                  Store {selectedStoreData.store_id}
                </div>
                <div style={{ fontSize: 14, color: 'var(--text-tertiary)', marginTop: 4, fontFamily: "'Inter', sans-serif" }}>
                  Last scraped: {selectedStoreData.scraped_at ? new Date(selectedStoreData.scraped_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Never'}
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

            {/* SECTION 1 — WHERE SHOULD I FOCUS? */}
            <div style={{ marginTop: 28 }}>
              <div style={{ 
                color: 'var(--text-primary)', 
                fontSize: 16, 
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
                    <th style={{ textAlign: 'left', fontSize: 14, color: 'var(--text-primary)', fontWeight: 400, padding: '14px 0', borderBottom: '1px solid var(--border-subtle)' }}>METRIC</th>
                    <th style={{ textAlign: 'center', fontSize: 14, color: 'var(--text-primary)', fontWeight: 400, padding: '14px 0', borderBottom: '1px solid var(--border-subtle)' }}>CURRENT</th>
                    <th style={{ textAlign: 'right', fontSize: 14, color: 'var(--text-primary)', fontWeight: 400, padding: '14px 0', borderBottom: '1px solid var(--border-subtle)' }}>VS PREVIOUS</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ textAlign: 'left', fontSize: 14, color: 'var(--text-primary)', padding: '14px 0', borderBottom: '1px solid var(--border-subtle)' }}>Accuracy of Order</td>
                    <td style={{ textAlign: 'center', fontSize: 14, color: 'var(--text-primary)', fontWeight: 700, padding: '14px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                      {formatNumber(selectedStoreData.focus_accuracy_current)}%
                    </td>
                    <td style={{ textAlign: 'right', fontSize: 14, fontWeight: 700, padding: '14px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                      {(() => {
                        const current = selectedStoreData.focus_accuracy_current ?? 0
                        const previous = selectedStoreData.focus_accuracy_vs_previous ?? 0
                        if (previous === 0 && current === 0) return <span style={{ color: 'var(--text-tertiary)' }}>—</span>
                        const diff = current - previous
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
                    <td style={{ textAlign: 'left', fontSize: 14, color: 'var(--text-primary)', padding: '14px 0', borderBottom: '1px solid var(--border-subtle)' }}>Wait Time</td>
                    <td style={{ textAlign: 'center', fontSize: 14, color: 'var(--text-primary)', fontWeight: 700, padding: '14px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                      {formatNumber(selectedStoreData.focus_wait_time_current)}%
                    </td>
                    <td style={{ textAlign: 'right', fontSize: 14, fontWeight: 700, padding: '14px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                      {(() => {
                        const current = selectedStoreData.focus_wait_time_current ?? 0
                        const previous = selectedStoreData.focus_wait_time_vs_previous ?? 0
                        if (previous === 0 && current === 0) return <span style={{ color: 'var(--text-tertiary)' }}>—</span>
                        const diff = current - previous
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
            <div style={{ marginTop: 28 }}>
              <div style={{ 
                color: 'var(--text-primary)', 
                fontSize: 16, 
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
                    <th style={{ textAlign: 'left', fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 500, letterSpacing: '0.8px', textTransform: 'uppercase', padding: '14px 0', borderBottom: '1px solid var(--border-subtle)' }}>METRIC</th>
                    <th style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 500, letterSpacing: '0.8px', textTransform: 'uppercase', padding: '14px 0', borderBottom: '1px solid var(--border-subtle)' }}>MY SCORE</th>
                    <th style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 500, letterSpacing: '0.8px', textTransform: 'uppercase', padding: '14px 0', borderBottom: '1px solid var(--border-subtle)' }}>VS LAST PERIOD</th>
                    <th style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 500, letterSpacing: '0.8px', textTransform: 'uppercase', padding: '14px 0', borderBottom: '1px solid var(--border-subtle)' }}>PAPA JOHN'S</th>
                    <th style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 500, letterSpacing: '0.8px', textTransform: 'uppercase', padding: '14px 0', borderBottom: '1px solid var(--border-subtle)' }}>VS PJ</th>
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
                      <tr key={item.key} style={{ background: idx % 2 === 0 ? 'transparent' : 'var(--bg-base)' }}>
                        <td style={{ textAlign: 'left', fontSize: 14, color: 'var(--text-primary)', padding: '14px 0' }}>{item.label}</td>
                        <td style={{ textAlign: 'center', fontSize: 14, color: 'var(--text-primary)', fontWeight: 700, padding: '14px 0' }}>
                          {formatNumber(item.my)}%
                        </td>
                        <td style={{ textAlign: 'center', fontSize: 14, fontWeight: 500, padding: '14px 0' }}>
                          {vsLastDiff === null ? (
                            <span style={{ color: 'var(--text-tertiary)' }}>—</span>
                          ) : vsLastDiff > 0 ? (
                            <span style={{ color: 'var(--success-text)' }}>↑ +{vsLastDiff.toFixed(1)}</span>
                          ) : (
                            <span style={{ color: 'var(--danger-text)' }}>↓ {vsLastDiff.toFixed(1)}</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'center', fontSize: 14, color: 'var(--info-text)', fontWeight: 700, padding: '14px 0' }}>
                          {formatNumber(item.pj)}%
                        </td>
                        <td style={{ textAlign: 'center', fontSize: 14, fontWeight: 500, padding: '14px 0' }}>
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
            <div style={{ marginTop: 28 }}>
              <div style={{ 
                color: 'var(--text-primary)', 
                fontSize: 16, 
                fontWeight: 600, 
                fontFamily: "'Inter', sans-serif",
                borderBottom: '2px solid var(--border-subtle)',
                paddingBottom: 8,
                marginBottom: 16
              }}>
                RANKING
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 500, letterSpacing: '0.8px', textTransform: 'uppercase', padding: '14px 12px', borderBottom: '1px solid var(--border-subtle)' }}>STORE</th>
                    <th style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 500, letterSpacing: '0.8px', textTransform: 'uppercase', padding: '14px 12px', borderBottom: '1px solid var(--border-subtle)' }}>RESP</th>
                    <th style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 500, letterSpacing: '0.8px', textTransform: 'uppercase', padding: '14px 12px', borderBottom: '1px solid var(--border-subtle)' }}>OSAT</th>
                    <th style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 500, letterSpacing: '0.8px', textTransform: 'uppercase', padding: '14px 12px', borderBottom: '1px solid var(--border-subtle)' }}>TASTE</th>
                    <th style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 500, letterSpacing: '0.8px', textTransform: 'uppercase', padding: '14px 12px', borderBottom: '1px solid var(--border-subtle)' }}>ACCURACY</th>
                    <th style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 500, letterSpacing: '0.8px', textTransform: 'uppercase', padding: '14px 12px', borderBottom: '1px solid var(--border-subtle)' }}>WAIT TIME</th>
                    <th style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 500, letterSpacing: '0.8px', textTransform: 'uppercase', padding: '14px 12px', borderBottom: '1px solid var(--border-subtle)' }}>FRIENDLINESS</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Store row */}
                  <tr>
                    <td style={{ textAlign: 'left', fontSize: 14, color: 'var(--text-primary)', fontWeight: 700, padding: '14px 12px' }}>
                      Store {selectedStoreData.store_id}
                    </td>
                    <td style={{ textAlign: 'center', fontSize: 14, color: (selectedStoreData.ranking_store_responses ?? 0) >= (selectedStoreData.ranking_pj_responses ?? 0) ? 'var(--success-text)' : 'var(--danger-text)', fontWeight: 700, padding: '14px 12px' }}>
                      {selectedStoreData.ranking_store_responses ?? '—'}
                    </td>
                    <td style={{ textAlign: 'center', fontSize: 14, color: (selectedStoreData.ranking_store_osat ?? 0) >= (selectedStoreData.ranking_pj_osat ?? 0) ? 'var(--success-text)' : 'var(--danger-text)', fontWeight: 700, padding: '14px 12px' }}>
                      {formatNumber(selectedStoreData.ranking_store_osat)}%
                    </td>
                    <td style={{ textAlign: 'center', fontSize: 14, color: (selectedStoreData.ranking_store_taste_of_food ?? 0) >= (selectedStoreData.ranking_pj_taste_of_food ?? 0) ? 'var(--success-text)' : 'var(--danger-text)', fontWeight: 700, padding: '14px 12px' }}>
                      {formatNumber(selectedStoreData.ranking_store_taste_of_food)}%
                    </td>
                    <td style={{ textAlign: 'center', fontSize: 14, color: (selectedStoreData.ranking_store_accuracy_of_order ?? 0) >= (selectedStoreData.ranking_pj_accuracy_of_order ?? 0) ? 'var(--success-text)' : 'var(--danger-text)', fontWeight: 700, padding: '14px 12px' }}>
                      {formatNumber(selectedStoreData.ranking_store_accuracy_of_order)}%
                    </td>
                    <td style={{ textAlign: 'center', fontSize: 14, color: (selectedStoreData.ranking_store_wait_time ?? 0) >= (selectedStoreData.ranking_pj_wait_time ?? 0) ? 'var(--success-text)' : 'var(--danger-text)', fontWeight: 700, padding: '14px 12px' }}>
                      {formatNumber(selectedStoreData.ranking_store_wait_time)}%
                    </td>
                    <td style={{ textAlign: 'center', fontSize: 14, color: (selectedStoreData.ranking_store_friendliness ?? 0) >= (selectedStoreData.ranking_pj_friendliness ?? 0) ? 'var(--success-text)' : 'var(--danger-text)', fontWeight: 700, padding: '14px 12px' }}>
                      {formatNumber(selectedStoreData.ranking_store_friendliness)}%
                    </td>
                  </tr>
                  {/* Papa John's row */}
                  <tr style={{ background: 'var(--bg-base)' }}>
                    <td style={{ textAlign: 'left', fontSize: 14, color: 'var(--info-text)', fontWeight: 700, padding: '14px 12px' }}>
                      Papa John's
                    </td>
                    <td style={{ textAlign: 'center', fontSize: 14, color: 'var(--info-text)', fontWeight: 700, padding: '14px 12px' }}>
                      {selectedStoreData.ranking_pj_responses ?? '—'}
                    </td>
                    <td style={{ textAlign: 'center', fontSize: 14, color: 'var(--info-text)', fontWeight: 700, padding: '14px 12px' }}>
                      {formatNumber(selectedStoreData.ranking_pj_osat)}%
                    </td>
                    <td style={{ textAlign: 'center', fontSize: 14, color: 'var(--info-text)', fontWeight: 700, padding: '14px 12px' }}>
                      {formatNumber(selectedStoreData.ranking_pj_taste_of_food)}%
                    </td>
                    <td style={{ textAlign: 'center', fontSize: 14, color: 'var(--info-text)', fontWeight: 700, padding: '14px 12px' }}>
                      {formatNumber(selectedStoreData.ranking_pj_accuracy_of_order)}%
                    </td>
                    <td style={{ textAlign: 'center', fontSize: 14, color: 'var(--info-text)', fontWeight: 700, padding: '14px 12px' }}>
                      {formatNumber(selectedStoreData.ranking_pj_wait_time)}%
                    </td>
                    <td style={{ textAlign: 'center', fontSize: 14, color: 'var(--info-text)', fontWeight: 700, padding: '14px 12px' }}>
                      {formatNumber(selectedStoreData.ranking_pj_friendliness)}%
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
