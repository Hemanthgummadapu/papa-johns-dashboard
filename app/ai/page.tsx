'use client'

import { useState } from 'react'
import Link from 'next/link'

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
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 whitespace-nowrap text-sm text-gray-300"
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
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null)

  return (
    <div style={{ background: 'var(--bg-base, #0a0b0f)', minHeight: '100vh', color: 'var(--text-primary, #f1f3f9)' }}>
      {/* Shared app header — same as Audit */}
      <div style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-subtle)', padding: '0 32px' }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 32, height: 32, borderRadius: 6, background: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, color: '#fff' }}>PJ</div>
            <div>
              <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 16, color: 'var(--text-primary)' }}>Papa Johns Ops</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>AI — Operations Intelligence</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 4, background: 'var(--bg-overlay)', borderRadius: 8, padding: 4, border: '1px solid var(--border-subtle)' }}>
            <Link href="/dashboard" style={{ padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, background: 'transparent', color: 'var(--text-tertiary)', textDecoration: 'none' }}>Dashboard</Link>
            <Link href="/trends" style={{ padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, background: 'transparent', color: 'var(--text-tertiary)', textDecoration: 'none' }}>Trends</Link>
            <Link href="/analytics/profitability" style={{ padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, background: 'transparent', color: 'var(--text-tertiary)', textDecoration: 'none' }}>Analytics</Link>
            <Link href="/audit" style={{ padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, background: 'transparent', color: 'var(--text-tertiary)', textDecoration: 'none' }}>Audit</Link>
            <span style={{ padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, background: 'var(--brand)', color: '#fff' }}>✨ AI</span>
            <Link href="/dashboard" style={{ padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, background: 'transparent', color: 'var(--text-tertiary)', textDecoration: 'none' }}>Live</Link>
            <Link href="/dashboard" style={{ padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, background: 'transparent', color: 'var(--text-tertiary)', textDecoration: 'none' }}>Guest Experience</Link>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }} />
        </div>
      </div>

      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full blur-3xl" style={{ backgroundColor: 'rgba(249,115,22,0.05)' }} />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full blur-3xl" style={{ backgroundColor: 'rgba(59,130,246,0.05)' }} />
      </div>

      {/* Coming Soon content — inside app layout */}
      <div className="relative" style={{ maxWidth: 1400, margin: '0 auto', padding: 24 }}>
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/30 text-orange-400 text-xs font-medium mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
            COMING SOON — BETA ACCESS
          </div>
          <h1 className="text-4xl font-bold tracking-tight mb-3">✨ Operations Intelligence</h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            AI-powered analysis across every dimension of your business. Fraud detection, financial
            leakage, customer patterns, competitor intelligence — all in one place.
          </p>
        </div>

        <div className="mb-12 rounded-xl border border-white/5 bg-white/[0.02] overflow-hidden py-4">
          <MarqueeRow items={CAPABILITIES[0]} direction="left" />
          <MarqueeRow items={CAPABILITIES[1]} direction="right" />
        </div>

        <div className="mb-12">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-6 text-center">
            What you&apos;ll be able to analyze
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {CATEGORIES.map((category) => (
              <div
                key={category.id}
                onMouseEnter={() => setHoveredCategory(category.id)}
                onMouseLeave={() => setHoveredCategory(null)}
                className={`relative rounded-xl border ${category.border} bg-gradient-to-br ${category.color} p-5 transition-all duration-300 ${
                  hoveredCategory === category.id ? 'scale-[1.02]' : ''
                }`}
              >
                {category.badge && (
                  <span className="absolute top-3 right-3 text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/20 border border-yellow-500/30 text-yellow-400 font-medium">
                    ProfitKeeper
                  </span>
                )}
                <div className="absolute inset-0 rounded-xl backdrop-blur-[1px] bg-black/20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity duration-200 z-10">
                  <div className="text-center">
                    <div className="text-3xl mb-1">🔒</div>
                    <div className="text-xs text-gray-400">Available after launch</div>
                  </div>
                </div>

                <div className="flex items-center gap-2 mb-4">
                  <span className="text-xl">{category.icon}</span>
                  <h3 className="font-semibold text-white">{category.label}</h3>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {category.buttons.map((btn, i) => (
                    <div
                      key={i}
                      className="p-2.5 rounded-lg bg-black/30 border border-white/5"
                    >
                      <div className="text-lg mb-1">{btn.icon}</div>
                      <div className="text-xs font-medium text-white leading-tight">
                        {btn.label}
                      </div>
                      <div className="text-[10px] text-gray-500 mt-0.5">{btn.sub}</div>
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
            { value: '~$0', label: 'Cost Per Query', icon: '💰' },
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

        <div className="text-center p-8 rounded-2xl border border-white/10 bg-gradient-to-b from-white/5 to-transparent">
          <h3 className="text-xl font-semibold mb-2">
            Ready to unlock Operations Intelligence?
          </h3>
          <p className="text-gray-400 text-sm mb-6">
            All 25+ analysis types, connected to your live Supabase data,
            <br />
            powered by Claude AI. Launching with the next phase.
          </p>
          <button
            type="button"
            onClick={() => setNotified(true)}
            className={`px-8 py-3 rounded-lg font-medium transition-all ${
              notified
                ? 'bg-green-500/20 border border-green-500/30 text-green-400'
                : 'bg-orange-500 hover:bg-orange-400 text-white'
            }`}
          >
            {notified ? "✅ You'll be notified at launch" : '🔔 Notify me when available'}
          </button>
        </div>
      </div>

      <style jsx global>{`
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
