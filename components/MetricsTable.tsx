'use client'

import { useState } from 'react'
import { DailyReportWithStore } from '@/lib/db'
import StatusBadge from './StatusBadge'

interface MetricsTableProps {
  reports: DailyReportWithStore[]
}

type SortKey = 'net_sales' | 'labor_pct' | 'food_cost_pct' | 'flm_pct' | 'cash_short'
type SortDirection = 'asc' | 'desc'

const TARGETS = {
  laborPct: 28.68,
  foodCostPct: 26.42,
  flmPct: 55.11,
  cashShort: 50,
}

export default function MetricsTable({ reports }: MetricsTableProps) {
  const [sortKey, setSortKey] = useState<SortKey | null>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDirection('desc')
    }
  }

  const sortedReports = [...reports].sort((a, b) => {
    if (!sortKey) return 0

    const aVal = a[sortKey] ?? 0
    const bVal = b[sortKey] ?? 0

    if (sortDirection === 'asc') {
      return aVal > bVal ? 1 : -1
    } else {
      return aVal < bVal ? 1 : -1
    }
  })

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortKey !== column) {
      return <span className="text-gray-500 text-xs">↕</span>
    }
    return <span className="text-blue-400">{sortDirection === 'asc' ? '↑' : '↓'}</span>
  }

  return (
    <div className="bg-dark-card border border-dark-border rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-dark-border">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Store
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer hover:text-white"
                onClick={() => handleSort('net_sales')}
              >
                <div className="flex items-center gap-2">
                  Net Sales
                  <SortIcon column="net_sales" />
                </div>
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer hover:text-white"
                onClick={() => handleSort('labor_pct')}
              >
                <div className="flex items-center gap-2">
                  Labor %
                  <SortIcon column="labor_pct" />
                </div>
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer hover:text-white"
                onClick={() => handleSort('food_cost_pct')}
              >
                <div className="flex items-center gap-2">
                  Food Cost %
                  <SortIcon column="food_cost_pct" />
                </div>
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer hover:text-white"
                onClick={() => handleSort('flm_pct')}
              >
                <div className="flex items-center gap-2">
                  FLM %
                  <SortIcon column="flm_pct" />
                </div>
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer hover:text-white"
                onClick={() => handleSort('cash_short')}
              >
                <div className="flex items-center gap-2">
                  Cash Short
                  <SortIcon column="cash_short" />
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-dark-border">
            {sortedReports.map((report) => {
              const isLaborGood = report.labor_pct ? report.labor_pct < TARGETS.laborPct : false
              const isFoodCostGood = report.food_cost_pct ? report.food_cost_pct < TARGETS.foodCostPct : false
              const isFlmGood = report.flm_pct ? report.flm_pct < TARGETS.flmPct : false
              const isCashShortGood = report.cash_short ? Math.abs(report.cash_short) < TARGETS.cashShort : false

              return (
                <tr key={report.id} className="hover:bg-dark-border/50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-white">{report.stores.name}</div>
                      <div className="text-sm text-gray-400">{report.stores.location}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                    ${report.net_sales?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-white">
                        {report.labor_pct?.toFixed(2) || 'N/A'}%
                      </span>
                      <StatusBadge isGood={isLaborGood} />
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-white">
                        {report.food_cost_pct?.toFixed(2) || 'N/A'}%
                      </span>
                      <StatusBadge isGood={isFoodCostGood} />
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-white">
                        {report.flm_pct?.toFixed(2) || 'N/A'}%
                      </span>
                      <StatusBadge isGood={isFlmGood} />
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-white">
                        ${report.cash_short?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || 'N/A'}
                      </span>
                      <StatusBadge isGood={isCashShortGood} />
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

