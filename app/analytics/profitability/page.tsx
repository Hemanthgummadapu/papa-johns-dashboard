'use client'

import { ProfitabilityContent } from './ProfitabilityContent'
import NavBar from '@/components/NavBar'

export default function ProfitabilityAnalyticsPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)]">
      <NavBar />
      <ProfitabilityContent />
    </div>
  )
}
