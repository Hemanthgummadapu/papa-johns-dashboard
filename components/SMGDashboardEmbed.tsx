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

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/smg-data', { cache: 'no-store' })
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
    fetchData()
  }, [])

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await fetch('/api/smg-scrape', { method: 'POST' })
    } finally {
      setRefreshing(false)
      window.location.reload()
    }
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
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12, marginBottom: 16 }}>
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
          {refreshing ? '⏳ Scraping...' : '🔄 Refresh Data'}
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
              maxWidth: 1200,
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              border: '1px solid var(--border-subtle)',
              position: 'relative',
              margin: 'auto',
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

          {/* Three Columns */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 24 }}>
            {/* Column 1 — Focus Metrics */}
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', fontFamily: "'Inter', sans-serif", fontWeight: 600, letterSpacing: '0.1em', marginBottom: 16 }}>
                WHERE SHOULD I FOCUS?
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* Accuracy Row */}
                <div style={{ background: 'var(--bg-base)', borderRadius: 8, padding: 16 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: "'Inter', sans-serif", fontWeight: 500, letterSpacing: '0.08em', marginBottom: 8 }}>
                    ACCURACY OF ORDER
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-primary)', marginBottom: 4 }}>
                        {formatNumber(selectedStoreData.focus_accuracy_current)}%
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-tertiary)', fontFamily: "'Inter', sans-serif" }}>
                        Previous: {formatNumber(selectedStoreData.focus_accuracy_vs_previous)}%
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      {(() => {
                        const diff = getFocusDifference(selectedStoreData.focus_accuracy_current, selectedStoreData.focus_accuracy_vs_previous)
                        if (diff === null) return <div style={{ fontSize: 14, color: 'var(--text-tertiary)', fontFamily: "'Inter', sans-serif" }}>—</div>
                        const isGood = diff > 0
                        const color = diff > 0 ? 'var(--success-text)' : 'var(--danger-text)'
                        return (
                          <div style={{ fontSize: 16, fontWeight: 600, fontFamily: "'Inter', sans-serif", color }}>
                            {isGood ? '↑' : '↓'} {diff > 0 ? '+' : ''}{diff.toFixed(1)}%
                          </div>
                        )
                      })()}
                    </div>
                  </div>
                </div>

                {/* Wait Time Row */}
                <div style={{ background: 'var(--bg-base)', borderRadius: 8, padding: 16 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: "'Inter', sans-serif", fontWeight: 500, letterSpacing: '0.08em', marginBottom: 8 }}>
                    WAIT TIME
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-primary)', marginBottom: 4 }}>
                        {formatNumber(selectedStoreData.focus_wait_time_current)}%
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-tertiary)', fontFamily: "'Inter', sans-serif" }}>
                        Previous: {formatNumber(selectedStoreData.focus_wait_time_vs_previous)}%
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      {(() => {
                        const diff = getFocusDifference(selectedStoreData.focus_wait_time_current, selectedStoreData.focus_wait_time_vs_previous)
                        if (diff === null) return <div style={{ fontSize: 14, color: 'var(--text-tertiary)', fontFamily: "'Inter', sans-serif" }}>—</div>
                        const isGood = diff > 0
                        const color = diff > 0 ? 'var(--success-text)' : 'var(--danger-text)'
                        return (
                          <div style={{ fontSize: 16, fontWeight: 600, fontFamily: "'Inter', sans-serif", color }}>
                            {isGood ? '↑' : '↓'} {diff > 0 ? '+' : ''}{diff.toFixed(1)}%
                          </div>
                        )
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Column 2 — How Are We Doing */}
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', fontFamily: "'Inter', sans-serif", fontWeight: 600, letterSpacing: '0.1em', marginBottom: 16 }}>
                HOW ARE WE DOING?
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  { key: 'osat', label: 'Overall Satisfaction', my: selectedStoreData.osat_my_score, vsLast: selectedStoreData.osat_vs_last_period, pj: selectedStoreData.osat_pj_score, vsPj: selectedStoreData.osat_vs_pj },
                  { key: 'accuracy', label: 'Accuracy of Order', my: selectedStoreData.accuracy_my_score, vsLast: selectedStoreData.accuracy_vs_last_period, pj: selectedStoreData.accuracy_pj_score, vsPj: selectedStoreData.accuracy_vs_pj },
                  { key: 'csc', label: 'CSC', my: selectedStoreData.csc_my_score, vsLast: selectedStoreData.csc_vs_last_period, pj: selectedStoreData.csc_pj_score, vsPj: selectedStoreData.csc_vs_pj },
                  { key: 'comp_orders', label: 'Comp Orders', my: selectedStoreData.comp_orders_my_score, vsLast: selectedStoreData.comp_orders_vs_last_period, pj: selectedStoreData.comp_orders_pj_score, vsPj: selectedStoreData.comp_orders_vs_pj },
                  { key: 'comp_sales', label: 'Comp Sales', my: selectedStoreData.comp_sales_my_score, vsLast: selectedStoreData.comp_sales_vs_last_period, pj: selectedStoreData.comp_sales_pj_score, vsPj: selectedStoreData.comp_sales_vs_pj },
                ].map((item) => {
                  // vs_last_period appears to be stored as: previous - current
                  // We need: current - previous, so we flip the sign
                  const vsLastDiff = item.vsLast !== null ? -item.vsLast : null
                  const vsLastDelta = formatDelta(vsLastDiff)
                  // Calculate vs PJ as: my_score - pj_score
                  const vsPjDiff = (item.my ?? 0) - (item.pj ?? 0)
                  const vsPjDelta = formatDelta(vsPjDiff)
                  return (
                    <div key={item.key} style={{ background: 'var(--bg-base)', borderRadius: 8, padding: 16 }}>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: "'Inter', sans-serif", fontWeight: 500, letterSpacing: '0.08em', marginBottom: 12 }}>
                        {item.label.toUpperCase()}
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div>
                          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: "'Inter', sans-serif", marginBottom: 4 }}>My Score</div>
                          <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-primary)', marginBottom: 8 }}>
                            {formatNumber(item.my)}%
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <div style={{ fontSize: 12, color: vsLastDelta.color, fontFamily: "'Inter', sans-serif", fontWeight: 500 }}>
                              {vsLastDelta.text} vs Last
                            </div>
                            <div style={{ fontSize: 12, color: vsPjDelta.color, fontFamily: "'Inter', sans-serif", fontWeight: 500 }}>
                              {vsPjDelta.text} vs PJ
                            </div>
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: "'Inter', sans-serif", marginBottom: 4 }}>Papa John's</div>
                          <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: 'var(--info-text)' }}>
                            {formatNumber(item.pj)}%
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Column 3 — Ranking */}
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', fontFamily: "'Inter', sans-serif", fontWeight: 600, letterSpacing: '0.1em', marginBottom: 16 }}>
                RANKING
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  { key: 'responses', label: 'Responses', store: selectedStoreData.ranking_store_responses?.toString() || '—', pj: selectedStoreData.ranking_pj_responses?.toString() || '—', isNumber: true },
                  { key: 'osat', label: 'OSAT', store: selectedStoreData.ranking_store_osat, pj: selectedStoreData.ranking_pj_osat },
                  { key: 'taste', label: 'Taste of Food', store: selectedStoreData.ranking_store_taste_of_food, pj: selectedStoreData.ranking_pj_taste_of_food },
                  { key: 'accuracy', label: 'Accuracy of Order', store: selectedStoreData.ranking_store_accuracy_of_order, pj: selectedStoreData.ranking_pj_accuracy_of_order },
                  { key: 'wait_time', label: 'Wait Time', store: selectedStoreData.ranking_store_wait_time, pj: selectedStoreData.ranking_pj_wait_time },
                  { key: 'friendliness', label: 'Friendliness', store: selectedStoreData.ranking_store_friendliness, pj: selectedStoreData.ranking_pj_friendliness },
                ].map((item) => {
                  const storeValue = item.isNumber ? item.store : formatPercent(item.store as number | null)
                  const pjValue = item.isNumber ? item.pj : formatPercent(item.pj as number | null)
                  const storeColor = item.isNumber ? 'var(--text-primary)' : getRankingColor(item.store as number | null, item.pj as number | null)
                  return (
                    <div key={item.key} style={{ background: 'var(--bg-base)', borderRadius: 8, padding: 16 }}>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: "'Inter', sans-serif", fontWeight: 500, letterSpacing: '0.08em', marginBottom: 12 }}>
                        {item.label.toUpperCase()}
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div>
                          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: "'Inter', sans-serif", marginBottom: 4 }}>Store {selectedStoreData.store_id}</div>
                          <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: storeColor }}>
                            {storeValue}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: "'Inter', sans-serif", marginBottom: 4 }}>Papa John's</div>
                          <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: 'var(--info-text)' }}>
                            {pjValue}
                          </div>
                        </div>
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
    </div>
  )
}
