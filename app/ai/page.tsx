'use client'

import { useState } from 'react'
import NavBar from '@/components/NavBar'

const CAPABILITIES = [
  [
    { icon: '🚨', text: 'Top fraud risks this period' },
    { icon: '💵', text: 'Cash order void patterns' },
    { icon: '👤', text: 'Manager behavioral analysis' },
    { icon: '📈', text: 'Stores trending worse' },
    { icon: '🔄', text: 'Schedule fraud detection' },
    { icon: '⏰', text: 'Overtime abuse patterns' },
    { icon: '💰', text: 'Cash over/short analysis' },
    { icon: '🌙', text: 'Shift-level bad review correlation' },
    { icon: '🚗', text: 'DoorDash & UberEats behavior' },
    { icon: '🏆', text: 'Competitor pricing intelligence' },
    { icon: '📊', text: 'Revenue vs all-brand benchmark' },
    { icon: '💸', text: 'Food & labor cost variance' },
    { icon: '📉', text: 'Gross margin leakage detection' },
    { icon: '🏷️', text: 'Discount % vs brand average' },
  ],
  [
    { icon: '⭐', text: 'Guest experience by shift' },
    { icon: '📉', text: 'Profit margin leakage' },
    { icon: '🌊', text: 'Slow season projections' },
    { icon: '👥', text: 'Customer behavior patterns' },
    { icon: '🎯', text: 'Offer performance analysis' },
    { icon: '📊', text: 'Year over year trends' },
    { icon: '🔍', text: 'Repeat refund customer detection' },
    { icon: '💸', text: 'Loss identification by category' },
    { icon: '🏪', text: 'Full store health scoring' },
    { icon: '🤖', text: 'Natural language store queries' },
  ],
]

const CATEGORIES = [
  {
    id: 'fraud',
    label: 'Fraud & Risk',
    icon: '🚨',
    color: 'from-red-500/20 to-transparent',
    border: 'border-red-500/30',
    accent: '#ef4444',
    buttons: [
      { icon: '🚨', label: 'Top Red Flags', sub: 'Current period analysis' },
      { icon: '💵', label: 'Cash Void Patterns', sub: 'No-trail transaction risk' },
      { icon: '👤', label: 'Manager Risk Score', sub: 'Behavioral pattern detection' },
      { icon: '🔄', label: 'Schedule Fraud', sub: 'Ghost employees & time theft' },
      { icon: '⏰', label: 'Overtime Abuse', sub: 'Unauthorized OT detection' },
      { icon: '💰', label: 'Cash Over/Short', sub: 'Register discrepancy trends' },
    ],
  },
  {
    id: 'operations',
    label: 'Operations Intelligence',
    icon: '⚙️',
    color: 'from-orange-500/20 to-transparent',
    border: 'border-orange-500/30',
    accent: '#f97316',
    buttons: [
      { icon: '🌙', label: 'Shift Performance', sub: 'Bad reviews by time/shift' },
      { icon: '📈', label: 'Stores Getting Worse', sub: 'Period over period decline' },
      { icon: '🏥', label: 'Full Health Report', sub: 'All stores, all metrics' },
      { icon: '📊', label: 'YoY Trend Analysis', sub: 'Year over year comparison' },
    ],
  },
  {
    id: 'customer',
    label: 'Customer Behavior',
    icon: '👥',
    color: 'from-blue-500/20 to-transparent',
    border: 'border-blue-500/30',
    accent: '#3b82f6',
    buttons: [
      { icon: '🔍', label: 'Repeat Abusers', sub: 'Same customer, multiple claims' },
      { icon: '⭐', label: 'SMG Score Analysis', sub: 'Guest satisfaction deep dive' },
      { icon: '📉', label: 'Complaint Patterns', sub: 'What customers hate most' },
      { icon: '🚗', label: 'Delivery Behavior', sub: 'DoorDash & UberEats analysis' },
    ],
  },
  {
    id: 'financial',
    label: 'Financial Intelligence',
    icon: '💰',
    color: 'from-green-500/20 to-transparent',
    border: 'border-green-500/30',
    accent: '#22c55e',
    buttons: [
      { icon: '💸', label: 'Profit Leakage', sub: 'Where money is being lost' },
      { icon: '📉', label: 'Loss Analysis', sub: 'By category, store, period' },
      { icon: '🌊', label: 'Slow Season Forecast', sub: 'Revenue projections' },
      { icon: '💰', label: 'Sales Target Gap', sub: 'Who is hitting numbers' },
    ],
  },
  {
    id: 'profitkeeper',
    label: 'Financial Intelligence',
    icon: '📊',
    color: 'from-yellow-500/20 to-transparent',
    border: 'border-yellow-500/30',
    accent: '#eab308',
    badge: 'Powered by ProfitKeeper',
    buttons: [
      { icon: '💰', label: 'Revenue vs All Brand', sub: '$62K vs $94K benchmark' },
      { icon: '🥗', label: 'Food Cost Analysis', sub: 'Actual vs target variance' },
      { icon: '👷', label: 'Labor & Overtime', sub: 'OT hours, PPH, GM hours' },
      { icon: '📉', label: 'Gross Margin Health', sub: '$22K vs $37K all brand' },
      { icon: '💸', label: 'Controllable Costs', sub: 'Advertising, fees, banking' },
      { icon: '🏷️', label: 'Discount % Analysis', sub: '30.27% vs 27% brand avg' },
      { icon: '🚗', label: 'Aggregator Fees', sub: 'DoorDash/UberEats cost %' },
      { icon: '📋', label: 'Franchise Fee Breakdown', sub: 'Royalty, tech, development' },
    ],
  },
  {
    id: 'market',
    label: 'Market & Competition',
    icon: '🏆',
    color: 'from-purple-500/20 to-transparent',
    border: 'border-purple-500/30',
    accent: '#a855f7',
    buttons: [
      { icon: '🏆', label: 'Competitor Pricing', sub: 'Stay in the competition' },
      { icon: '🎯', label: 'Offers Working', sub: 'High-performing promotions' },
      { icon: '❌', label: 'Offers Failing', sub: 'Promotions to discontinue' },
      { icon: '📊', label: 'Market Position', sub: 'Where you stand locally' },
    ],
  },
]

function MarqueeRow({
  items,
  direction,
}: {
  items: (typeof CAPABILITIES)[0]
  direction: 'left' | 'right'
}) {
  const doubled = [...items, ...items, ...items]
  return (
    <div className="overflow-hidden py-2">
      <div
        className={direction === 'left' ? 'animate-marquee-left' : 'animate-marquee-right'}
        style={{ width: 'max-content', display: 'flex', gap: '1rem' }}
      >
        {doubled.map((item, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 14px',
              borderRadius: 20,
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              fontSize: 12,
              color: 'var(--text-tertiary)',
              whiteSpace: 'nowrap',
              cursor: 'default',
              transition: 'border-color 0.2s, color 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--brand)'
              e.currentTarget.style.color = 'var(--text-primary)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-subtle)'
              e.currentTarget.style.color = 'var(--text-tertiary)'
            }}
          >
            <span>{item.icon}</span>
            <span>{item.text}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function AIPage() {
  const [notified, setNotified] = useState(false)

  return (
    <div style={{ background: 'var(--bg-base, #0a0b0f)', minHeight: '100vh', color: 'var(--text-primary, #f1f3f9)' }}>
      <NavBar />

      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full blur-3xl" style={{ backgroundColor: 'rgba(249,115,22,0.05)' }} />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full blur-3xl" style={{ backgroundColor: 'rgba(59,130,246,0.05)' }} />
      </div>

      {/* Coming Soon content — inside app layout */}
      <div className="relative" style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 28px' }}>
        <div className="text-center mb-12">
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 16px',
              borderRadius: 20,
              background: 'linear-gradient(135deg, rgba(232,68,26,0.15), rgba(232,68,26,0.05))',
              border: '1px solid rgba(232,68,26,0.3)',
              color: 'var(--brand)',
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.1em',
              marginBottom: 24,
            }}
          >
            <span className="ai-badge-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--brand)', flexShrink: 0 }} />
            COMING SOON — BETA ACCESS
          </div>
          <h1
            style={{
              fontSize: 'clamp(28px, 4vw, 42px)',
              fontWeight: 800,
              marginBottom: 12,
              color: 'var(--text-primary)',
            }}
          >
            <span style={{ color: 'var(--brand)' }}>✦</span> Operations Intelligence
          </h1>
          <p
            style={{
              fontSize: 14,
              color: 'var(--text-tertiary)',
              maxWidth: 520,
              margin: '0 auto',
              lineHeight: 1.7,
              textAlign: 'center',
            }}
          >
            AI-powered analysis across every dimension of your business. Fraud detection, financial
            leakage, customer patterns, competitor intelligence — all in one place.
          </p>
        </div>

        <div
          style={{
            marginBottom: 48,
            borderRadius: 12,
            border: '1px solid var(--border-subtle)',
            background: 'var(--bg-surface)',
            overflow: 'hidden',
            padding: '16px 0',
            maskImage: 'linear-gradient(to right, transparent, black 10%, black 90%, transparent)',
            WebkitMaskImage: 'linear-gradient(to right, transparent, black 10%, black 90%, transparent)',
          }}
        >
          <MarqueeRow items={CAPABILITIES[0]} direction="left" />
          <MarqueeRow items={CAPABILITIES[1]} direction="right" />
        </div>

        <div className="mb-12">
          <h2
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.12em',
              color: 'var(--text-tertiary)',
              textTransform: 'uppercase',
              textAlign: 'center',
              marginBottom: 24,
            }}
          >
            What you&apos;ll be able to analyze
          </h2>

          <div style={{
            background: 'linear-gradient(135deg, rgba(232,68,26,0.08), rgba(232,68,26,0.03))',
            border: '1px solid rgba(232,68,26,0.2)',
            borderRadius: 12, padding: '16px 20px', marginBottom: 24,
            display: 'flex', alignItems: 'center', gap: 16
          }}>
            <div style={{ fontSize: 28 }}>🔔</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700,
                color: 'var(--text-primary)', marginBottom: 3 }}>
                Smart Alerts — Automated Notifications
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)',
                lineHeight: 1.5 }}>
                Get SMS and email alerts when labor exceeds target,
                food cost spikes, EBITDA goes negative, or sales drop
                below forecast. Set thresholds per store.
              </div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{
                fontSize: 10, fontWeight: 700, padding: '3px 10px',
                borderRadius: 5, background: 'rgba(232,68,26,0.1)',
                color: 'var(--brand)', border: '1px solid rgba(232,68,26,0.2)',
                letterSpacing: '0.06em', marginBottom: 8
              }}>COMING SOON</div>
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                SMS · Email · Slack
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {CATEGORIES.map((category) => (
              <div
                key={category.id}
                style={{
                  position: 'relative',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 12,
                  padding: 20,
                  transition: 'transform 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'scale(1.02)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'none'
                }}
              >
                {category.badge && (
                  <span
                    style={{
                      position: 'absolute',
                      top: 12,
                      right: 12,
                      fontSize: 10,
                      padding: '2px 8px',
                      borderRadius: 20,
                      background: 'rgba(234,179,8,0.2)',
                      border: '1px solid rgba(234,179,8,0.3)',
                      color: 'var(--text-tertiary)',
                      fontWeight: 600,
                    }}
                  >
                    ProfitKeeper
                  </span>
                )}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 16,
                    paddingBottom: 12,
                    borderBottom: '1px solid var(--border-subtle)',
                    fontSize: 13,
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                  }}
                >
                  <span style={{ fontSize: 16 }}>{category.icon}</span>
                  {category.label}
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: 10,
                  }}
                >
                  {category.buttons.map((btn, i) => (
                    <div
                      key={i}
                      style={{
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid rgba(255,255,255,0.05)',
                        borderRadius: 8,
                        padding: '10px 12px',
                      }}
                    >
                      <div style={{ fontSize: 16, marginBottom: 6 }}>{btn.icon}</div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                        {btn.label}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                        {btn.sub}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          {[
            { value: '25+', label: 'Analysis Types', icon: '🔍' },
            { value: '6', label: 'Data Sources', icon: '📊' },
            { value: '<2s', label: 'Response Time', icon: '⚡' },
            { value: 'Private', label: 'Your Data Only', icon: '🔒' },
          ].map((stat, i) => (
            <div
              key={i}
              className="text-center p-4 rounded-xl bg-white/[0.03] border border-white/5"
            >
              <div className="text-2xl mb-1">{stat.icon}</div>
              <div className="text-2xl font-bold text-orange-400">{stat.value}</div>
              <div className="text-xs text-gray-500">{stat.label}</div>
            </div>
          ))}
        </div>

        <div style={{ textAlign: 'center', marginTop: 40, paddingTop: 32, borderTop: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 12 }}>
            Be the first to know when AI features launch
          </div>
          <button
            type="button"
            onClick={() => setNotified(true)}
            style={{
              padding: '8px 24px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              background: 'var(--brand)',
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            ✦ Request Early Access
          </button>
        </div>
      </div>

      <style jsx global>{`
        @keyframes ai-badge-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.2); }
        }
        .ai-badge-dot {
          animation: ai-badge-pulse 1.5s ease-in-out infinite;
        }
        @keyframes marquee-left {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-33.33%);
          }
        }
        @keyframes marquee-right {
          0% {
            transform: translateX(-33.33%);
          }
          100% {
            transform: translateX(0);
          }
        }
        .animate-marquee-left {
          animation: marquee-left 30s linear infinite;
        }
        .animate-marquee-right {
          animation: marquee-right 30s linear infinite;
        }
      `}</style>
    </div>
  )
}
