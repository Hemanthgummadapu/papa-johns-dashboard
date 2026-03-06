'use client'

import Link from 'next/link'
import { ProfitabilityContent } from './ProfitabilityContent'

export default function ProfitabilityAnalyticsPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)]">
      <header className="sticky top-0 z-10 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] px-6">
        <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[var(--brand)] text-xs font-semibold text-white">
              PJ
            </div>
            <div>
              <div className="font-semibold text-[var(--text-primary)]">Papa Johns Ops</div>
              <div className="text-[11px] text-[var(--text-tertiary)]">Analytics · Profitability</div>
            </div>
          </div>
          <nav className="flex gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-overlay)] p-1">
            <Link href="/dashboard" className="rounded-md px-4 py-2 text-sm font-semibold text-[var(--text-tertiary)] transition hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]">Dashboard</Link>
            <Link href="/trends" className="rounded-md px-4 py-2 text-sm font-semibold text-[var(--text-tertiary)] transition hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]">Trends</Link>
            <span className="rounded-md bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white">Analytics</span>
            <Link href="/audit" className="rounded-md px-4 py-2 text-sm font-semibold text-[var(--text-tertiary)] transition hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]">Audit</Link>
            <Link href="/ai" className="rounded-md px-4 py-2 text-sm font-semibold text-[var(--text-tertiary)] transition hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]">✨ AI</Link>
            <Link href="/dashboard" className="rounded-md px-4 py-2 text-sm font-semibold text-[var(--text-tertiary)] transition hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]">Live</Link>
            <Link href="/dashboard" className="rounded-md px-4 py-2 text-sm font-semibold text-[var(--text-tertiary)] transition hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]">Guest Experience</Link>
          </nav>
        </div>
      </header>
      <ProfitabilityContent />
                    </div>
                  )
                }
