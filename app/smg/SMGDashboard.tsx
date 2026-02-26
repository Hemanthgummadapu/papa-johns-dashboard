'use client'

import { useState } from 'react'
import type { SMGScore } from './page'

interface SMGDashboardProps {
  data: SMGScore[]
  lastScraped: string | null
}

export default function SMGDashboard({ data, lastScraped }: SMGDashboardProps) {
  const [selectedStore, setSelectedStore] = useState<string | null>(null)

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
    if (storeOSAT === null || pjOSAT === null) return '#C7C7CC'
    if (storeOSAT >= pjOSAT) return '#34C759'
    return '#FF3B30'
  }

  // Get comparison badge for vs PJ
  const getComparisonBadge = (storeScore: number | null, pjScore: number | null) => {
    if (storeScore === null || pjScore === null) {
      return { text: '—', bgColor: 'transparent', textColor: '#6E6E73' }
    }
    const diff = storeScore - pjScore
    if (diff > 0) {
      return { text: `↑ +${diff.toFixed(1)}`, bgColor: '#E8FFF0', textColor: '#34C759' }
    } else if (diff < 0) {
      return { text: `↓ ${diff.toFixed(1)}`, bgColor: '#FFF0F0', textColor: '#FF3B30' }
    }
    return { text: '—', bgColor: 'transparent', textColor: '#6E6E73' }
  }

  // Format delta for "Vs Last Period" and "Vs PJ"
  const formatDelta = (value: number | null) => {
    if (value === null) return { text: '—', bgColor: 'transparent', textColor: '#6E6E73' }
    if (value > 0) {
      return { text: `↑ +${value.toFixed(1)}`, bgColor: '#E8FFF0', textColor: '#34C759' }
    } else if (value < 0) {
      return { text: `↓ ${value.toFixed(1)}`, bgColor: '#FFF0F0', textColor: '#FF3B30' }
    }
    return { text: '—', bgColor: 'transparent', textColor: '#6E6E73' }
  }

  // Get focus difference badge
  const getFocusDifference = (current: number | null, previous: number | null) => {
    if (current === null || previous === null) return null
    return current - previous
  }

  // Get ranking score color
  const getRankingColor = (storeValue: number | null, pjValue: number | null) => {
    if (storeValue === null || pjValue === null) return '#6E6E73'
    if (storeValue >= pjValue) return '#34C759'
    return '#FF3B30'
  }

  const selectedStoreData = selectedStore ? data.find(d => d.store_id === selectedStore) : null

  // GRID VIEW
  if (selectedStore === null) {
    return (
      <div style={{ background: 'white', padding: '24px', fontFamily: "-apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif" }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#1D1D1F', margin: 0 }}>
            Guest Experience
          </h1>
          <div style={{ fontSize: '13px', color: '#6E6E73', marginTop: 4 }}>
            SMG data · Last scraped: {lastScraped ? new Date(lastScraped).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Never'}
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '16px',
            marginTop: '24px',
          }}
        >
          {data.map((store) => {
            const borderColor = getBorderColor(store.ranking_store_osat, store.ranking_pj_osat)
            const osatBadge = getComparisonBadge(store.ranking_store_osat, store.ranking_pj_osat)
            const accuracyBadge = getComparisonBadge(store.ranking_store_accuracy_of_order, store.ranking_pj_accuracy_of_order)
            const waitTimeBadge = getComparisonBadge(store.ranking_store_wait_time, store.ranking_pj_wait_time)

            return (
              <div
                key={store.store_id}
                onClick={() => setSelectedStore(store.store_id)}
                style={{
                  background: 'white',
                  borderRadius: '12px',
                  padding: '20px',
                  boxShadow: '0 1px 8px rgba(0,0,0,0.08)',
                  borderLeft: `4px solid ${borderColor}`,
                  cursor: 'pointer',
                  transition: 'box-shadow 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.12)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = '0 1px 8px rgba(0,0,0,0.08)'
                }}
              >
                {/* Card Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: '#1D1D1F' }}>
                    Store {store.store_id}
                  </div>
                  {store.ranking_store_responses !== null && (
                    <div
                      style={{
                        background: '#F5F5F7',
                        padding: '2px 8px',
                        borderRadius: '10px',
                        fontSize: '12px',
                        color: '#6E6E73',
                      }}
                    >
                      {store.ranking_store_responses} responses
                    </div>
                  )}
                </div>

                {/* Card Body - 3 Metric Rows */}
                <div>
                  {/* OSAT */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #F5F5F7' }}>
                    <div style={{ fontSize: '12px', color: '#6E6E73' }}>OSAT</div>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: '#1D1D1F' }}>
                      {formatNumber(store.ranking_store_osat)}
                    </div>
                    <div
                      style={{
                        background: osatBadge.bgColor,
                        color: osatBadge.textColor,
                        fontSize: '12px',
                        padding: '2px 6px',
                        borderRadius: '6px',
                        fontWeight: 600,
                      }}
                    >
                      {osatBadge.text}
                    </div>
                  </div>

                  {/* Accuracy */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #F5F5F7' }}>
                    <div style={{ fontSize: '12px', color: '#6E6E73' }}>Accuracy</div>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: '#1D1D1F' }}>
                      {formatNumber(store.ranking_store_accuracy_of_order)}
                    </div>
                    <div
                      style={{
                        background: accuracyBadge.bgColor,
                        color: accuracyBadge.textColor,
                        fontSize: '12px',
                        padding: '2px 6px',
                        borderRadius: '6px',
                        fontWeight: 600,
                      }}
                    >
                      {accuracyBadge.text}
                    </div>
                  </div>

                  {/* Wait Time */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0' }}>
                    <div style={{ fontSize: '12px', color: '#6E6E73' }}>Wait Time</div>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: '#1D1D1F' }}>
                      {formatNumber(store.ranking_store_wait_time)}
                    </div>
                    <div
                      style={{
                        background: waitTimeBadge.bgColor,
                        color: waitTimeBadge.textColor,
                        fontSize: '12px',
                        padding: '2px 6px',
                        borderRadius: '6px',
                        fontWeight: 600,
                      }}
                    >
                      {waitTimeBadge.text}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // MODAL VIEW
  if (!selectedStoreData) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif",
      }}
      onClick={() => setSelectedStore(null)}
    >
      <div
        style={{
          background: 'white',
          borderRadius: '20px',
          width: '90%',
          maxWidth: '880px',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: '32px',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: '26px', fontWeight: 700, color: '#1D1D1F', marginBottom: 4 }}>
            Store {selectedStoreData.store_id}
          </div>
          <div style={{ fontSize: '13px', color: '#6E6E73' }}>
            Last scraped: {selectedStoreData.scraped_at ? new Date(selectedStoreData.scraped_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Never'}
          </div>
        </div>

        <button
          onClick={() => setSelectedStore(null)}
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            border: 'none',
            background: '#F5F5F7',
            color: '#6E6E73',
            cursor: 'pointer',
            fontSize: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#E5E5EA'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#F5F5F7'
          }}
        >
          ×
        </button>

        {/* Section 1: Where Should I Focus? */}
        <section style={{ marginTop: 24, marginBottom: 32 }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#1D1D1F', marginBottom: 16 }}>
            Where Should I Focus?
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            {/* Accuracy Card */}
            <div style={{ background: '#F5F5F7', borderRadius: '12px', padding: '20px' }}>
              <div style={{ fontSize: '11px', color: '#6E6E73', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8 }}>
                ACCURACY OF ORDER
              </div>
              <div style={{ fontSize: '48px', fontWeight: 700, color: '#1D1D1F', margin: '8px 0' }}>
                {formatNumber(selectedStoreData.focus_accuracy_current)}
              </div>
              {selectedStoreData.focus_accuracy_vs_previous !== null && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                  <div style={{ fontSize: '13px', color: '#6E6E73' }}>
                    Previous: {formatNumber(selectedStoreData.focus_accuracy_vs_previous)}
                  </div>
                  {(() => {
                    const diff = getFocusDifference(selectedStoreData.focus_accuracy_current, selectedStoreData.focus_accuracy_vs_previous)
                    if (diff === null) return null
                    const isGood = diff > 0
                    return (
                      <div
                        style={{
                          background: isGood ? '#E8FFF0' : '#FFF0F0',
                          color: isGood ? '#34C759' : '#FF3B30',
                          fontSize: '12px',
                          padding: '2px 6px',
                          borderRadius: '6px',
                          fontWeight: 600,
                        }}
                      >
                        {isGood ? '↑' : '↓'} {diff > 0 ? '+' : ''}{diff.toFixed(1)}
                      </div>
                    )
                  })()}
                </div>
              )}
            </div>

            {/* Wait Time Card */}
            <div style={{ background: '#F5F5F7', borderRadius: '12px', padding: '20px' }}>
              <div style={{ fontSize: '11px', color: '#6E6E73', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8 }}>
                WAIT TIME
              </div>
              <div style={{ fontSize: '48px', fontWeight: 700, color: '#1D1D1F', margin: '8px 0' }}>
                {formatNumber(selectedStoreData.focus_wait_time_current)}
              </div>
              {selectedStoreData.focus_wait_time_vs_previous !== null && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                  <div style={{ fontSize: '13px', color: '#6E6E73' }}>
                    Previous: {formatNumber(selectedStoreData.focus_wait_time_vs_previous)}
                  </div>
                  {(() => {
                    const diff = getFocusDifference(selectedStoreData.focus_wait_time_current, selectedStoreData.focus_wait_time_vs_previous)
                    if (diff === null) return null
                    const isGood = diff > 0
                    return (
                      <div
                        style={{
                          background: isGood ? '#E8FFF0' : '#FFF0F0',
                          color: isGood ? '#34C759' : '#FF3B30',
                          fontSize: '12px',
                          padding: '2px 6px',
                          borderRadius: '6px',
                          fontWeight: 600,
                        }}
                      >
                        {isGood ? '↑' : '↓'} {diff > 0 ? '+' : ''}{diff.toFixed(1)}
                      </div>
                    )
                  })()}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Section 2: How Are We Doing? */}
        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#1D1D1F', marginBottom: 16 }}>
            How Are We Doing?
          </h2>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '12px 0', fontSize: '11px', color: '#6E6E73', textTransform: 'uppercase', fontWeight: 600 }}>
                  METRIC
                </th>
                <th style={{ textAlign: 'right', padding: '12px 0', fontSize: '11px', color: '#6E6E73', textTransform: 'uppercase', fontWeight: 600 }}>
                  MY SCORE
                </th>
                <th style={{ textAlign: 'right', padding: '12px 0', fontSize: '11px', color: '#6E6E73', textTransform: 'uppercase', fontWeight: 600 }}>
                  VS LAST PERIOD
                </th>
                <th style={{ textAlign: 'right', padding: '12px 0', fontSize: '11px', color: '#6E6E73', textTransform: 'uppercase', fontWeight: 600 }}>
                  PAPA JOHN'S
                </th>
                <th style={{ textAlign: 'right', padding: '12px 0', fontSize: '11px', color: '#6E6E73', textTransform: 'uppercase', fontWeight: 600 }}>
                  VS PJ
                </th>
              </tr>
            </thead>
            <tbody>
              {[
                {
                  label: 'Overall Satisfaction',
                  myScore: selectedStoreData.osat_my_score,
                  vsLastPeriod: selectedStoreData.osat_vs_last_period,
                  pjScore: selectedStoreData.osat_pj_score,
                  vsPj: selectedStoreData.osat_vs_pj,
                },
                {
                  label: 'Accuracy of Order',
                  myScore: selectedStoreData.accuracy_my_score,
                  vsLastPeriod: selectedStoreData.accuracy_vs_last_period,
                  pjScore: selectedStoreData.accuracy_pj_score,
                  vsPj: selectedStoreData.accuracy_vs_pj,
                },
                {
                  label: 'CSC',
                  myScore: selectedStoreData.csc_my_score,
                  vsLastPeriod: selectedStoreData.csc_vs_last_period,
                  pjScore: selectedStoreData.csc_pj_score,
                  vsPj: selectedStoreData.csc_vs_pj,
                },
                {
                  label: 'Comp Orders',
                  myScore: selectedStoreData.comp_orders_my_score,
                  vsLastPeriod: selectedStoreData.comp_orders_vs_last_period,
                  pjScore: selectedStoreData.comp_orders_pj_score,
                  vsPj: selectedStoreData.comp_orders_vs_pj,
                },
                {
                  label: 'Comp Sales',
                  myScore: selectedStoreData.comp_sales_my_score,
                  vsLastPeriod: selectedStoreData.comp_sales_vs_last_period,
                  pjScore: selectedStoreData.comp_sales_pj_score,
                  vsPj: selectedStoreData.comp_sales_vs_pj,
                },
              ].map((row, idx) => {
                const vsLastPeriod = formatDelta(row.vsLastPeriod)
                const vsPj = formatDelta(row.vsPj)
                return (
                  <tr key={idx} style={{ borderBottom: '1px solid #F5F5F7' }}>
                    <td style={{ padding: '12px 0', fontSize: '14px', color: '#1D1D1F' }}>
                      {row.label}
                    </td>
                    <td style={{ padding: '12px 0', fontSize: '14px', color: '#1D1D1F', fontWeight: 700, textAlign: 'right' }}>
                      {formatNumber(row.myScore)}
                    </td>
                    <td style={{ padding: '12px 0', textAlign: 'right' }}>
                      <span
                        style={{
                          background: vsLastPeriod.bgColor,
                          color: vsLastPeriod.textColor,
                          fontSize: '12px',
                          padding: '2px 6px',
                          borderRadius: '6px',
                          fontWeight: 600,
                        }}
                      >
                        {vsLastPeriod.text}
                      </span>
                    </td>
                    <td style={{ padding: '12px 0', fontSize: '14px', color: '#007AFF', fontWeight: 700, textAlign: 'right' }}>
                      {formatNumber(row.pjScore)}
                    </td>
                    <td style={{ padding: '12px 0', textAlign: 'right' }}>
                      <span
                        style={{
                          background: vsPj.bgColor,
                          color: vsPj.textColor,
                          fontSize: '12px',
                          padding: '2px 6px',
                          borderRadius: '6px',
                          fontWeight: 600,
                        }}
                      >
                        {vsPj.text}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </section>

        {/* Section 3: Ranking */}
        <section>
          <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#1D1D1F', marginBottom: 16 }}>
            Ranking
          </h2>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '14px 12px', fontSize: '11px', color: '#6E6E73', textTransform: 'uppercase', fontWeight: 600 }}>
                  STORE
                </th>
                <th style={{ textAlign: 'right', padding: '14px 12px', fontSize: '11px', color: '#6E6E73', textTransform: 'uppercase', fontWeight: 600 }}>
                  RESP
                </th>
                <th style={{ textAlign: 'right', padding: '14px 12px', fontSize: '11px', color: '#6E6E73', textTransform: 'uppercase', fontWeight: 600 }}>
                  OSAT
                </th>
                <th style={{ textAlign: 'right', padding: '14px 12px', fontSize: '11px', color: '#6E6E73', textTransform: 'uppercase', fontWeight: 600 }}>
                  TASTE
                </th>
                <th style={{ textAlign: 'right', padding: '14px 12px', fontSize: '11px', color: '#6E6E73', textTransform: 'uppercase', fontWeight: 600 }}>
                  ACCURACY
                </th>
                <th style={{ textAlign: 'right', padding: '14px 12px', fontSize: '11px', color: '#6E6E73', textTransform: 'uppercase', fontWeight: 600 }}>
                  WAIT TIME
                </th>
                <th style={{ textAlign: 'right', padding: '14px 12px', fontSize: '11px', color: '#6E6E73', textTransform: 'uppercase', fontWeight: 600 }}>
                  FRIENDLINESS
                </th>
              </tr>
            </thead>
            <tbody>
              {/* Store Row */}
              <tr style={{ fontWeight: 700, borderBottom: '1px solid #F5F5F7' }}>
                <td style={{ padding: '14px 12px', fontSize: '14px', color: '#1D1D1F' }}>
                  Store {selectedStoreData.store_id}
                </td>
                <td style={{ padding: '14px 12px', fontSize: '14px', color: '#1D1D1F', textAlign: 'right' }}>
                  {selectedStoreData.ranking_store_responses ?? '—'}
                </td>
                <td style={{ padding: '14px 12px', fontSize: '14px', textAlign: 'right', color: getRankingColor(selectedStoreData.ranking_store_osat, selectedStoreData.ranking_pj_osat), fontWeight: 700 }}>
                  {formatPercent(selectedStoreData.ranking_store_osat)}
                </td>
                <td style={{ padding: '14px 12px', fontSize: '14px', textAlign: 'right', color: getRankingColor(selectedStoreData.ranking_store_taste_of_food, selectedStoreData.ranking_pj_taste_of_food), fontWeight: 700 }}>
                  {formatPercent(selectedStoreData.ranking_store_taste_of_food)}
                </td>
                <td style={{ padding: '14px 12px', fontSize: '14px', textAlign: 'right', color: getRankingColor(selectedStoreData.ranking_store_accuracy_of_order, selectedStoreData.ranking_pj_accuracy_of_order), fontWeight: 700 }}>
                  {formatPercent(selectedStoreData.ranking_store_accuracy_of_order)}
                </td>
                <td style={{ padding: '14px 12px', fontSize: '14px', textAlign: 'right', color: getRankingColor(selectedStoreData.ranking_store_wait_time, selectedStoreData.ranking_pj_wait_time), fontWeight: 700 }}>
                  {formatPercent(selectedStoreData.ranking_store_wait_time)}
                </td>
                <td style={{ padding: '14px 12px', fontSize: '14px', textAlign: 'right', color: getRankingColor(selectedStoreData.ranking_store_friendliness, selectedStoreData.ranking_pj_friendliness), fontWeight: 700 }}>
                  {formatPercent(selectedStoreData.ranking_store_friendliness)}
                </td>
              </tr>
              {/* Papa John's Row */}
              <tr style={{ background: '#EBF5FF', borderBottom: '1px solid #F5F5F7' }}>
                <td style={{ padding: '14px 12px', fontSize: '14px', color: '#007AFF', fontWeight: 600 }}>
                  Papa John's
                </td>
                <td style={{ padding: '14px 12px', fontSize: '14px', color: '#007AFF', textAlign: 'right' }}>
                  {selectedStoreData.ranking_pj_responses ?? '—'}
                </td>
                <td style={{ padding: '14px 12px', fontSize: '14px', color: '#007AFF', textAlign: 'right' }}>
                  {formatPercent(selectedStoreData.ranking_pj_osat)}
                </td>
                <td style={{ padding: '14px 12px', fontSize: '14px', color: '#007AFF', textAlign: 'right' }}>
                  {formatPercent(selectedStoreData.ranking_pj_taste_of_food)}
                </td>
                <td style={{ padding: '14px 12px', fontSize: '14px', color: '#007AFF', textAlign: 'right' }}>
                  {formatPercent(selectedStoreData.ranking_pj_accuracy_of_order)}
                </td>
                <td style={{ padding: '14px 12px', fontSize: '14px', color: '#007AFF', textAlign: 'right' }}>
                  {formatPercent(selectedStoreData.ranking_pj_wait_time)}
                </td>
                <td style={{ padding: '14px 12px', fontSize: '14px', color: '#007AFF', textAlign: 'right' }}>
                  {formatPercent(selectedStoreData.ranking_pj_friendliness)}
                </td>
              </tr>
            </tbody>
          </table>
        </section>
      </div>
    </div>
  )
}
