import StatusBadge from './StatusBadge'
import { DailyReportWithStore } from '@/lib/db'

interface StoreCardProps {
  report: DailyReportWithStore
  projectedSales?: number
}

const TARGETS = {
  laborPct: 28.68,
  foodCostPct: 26.42,
  flmPct: 55.11,
  cashShort: 50,
}

export default function StoreCard({ report, projectedSales = 3000 }: StoreCardProps) {
  const { stores, net_sales, labor_pct, food_cost_pct, flm_pct, cash_short } = report

  const isNetSalesGood = net_sales ? net_sales >= projectedSales : false
  const isLaborGood = labor_pct ? labor_pct < TARGETS.laborPct : false
  const isFoodCostGood = food_cost_pct ? food_cost_pct < TARGETS.foodCostPct : false
  const isFlmGood = flm_pct ? flm_pct < TARGETS.flmPct : false
  const isCashShortGood = cash_short ? Math.abs(cash_short) < TARGETS.cashShort : false

  return (
    <div className="bg-dark-card border border-dark-border rounded-lg p-6 hover:border-blue-500/50 transition-colors">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-white">{stores.name}</h3>
        <p className="text-sm text-gray-400">{stores.location}</p>
      </div>

      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-gray-400 text-sm">Net Sales</span>
          <div className="flex items-center gap-2">
            <span className="text-white font-medium">
              ${net_sales?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || 'N/A'}
            </span>
            <StatusBadge isGood={isNetSalesGood} />
          </div>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-gray-400 text-sm">Labor %</span>
          <div className="flex items-center gap-2">
            <span className="text-white font-medium">
              {labor_pct?.toFixed(2) || 'N/A'}%
            </span>
            <StatusBadge isGood={isLaborGood} />
          </div>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-gray-400 text-sm">Food Cost %</span>
          <div className="flex items-center gap-2">
            <span className="text-white font-medium">
              {food_cost_pct?.toFixed(2) || 'N/A'}%
            </span>
            <StatusBadge isGood={isFoodCostGood} />
          </div>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-gray-400 text-sm">FLM %</span>
          <div className="flex items-center gap-2">
            <span className="text-white font-medium">
              {flm_pct?.toFixed(2) || 'N/A'}%
            </span>
            <StatusBadge isGood={isFlmGood} />
          </div>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-gray-400 text-sm">Cash Short</span>
          <div className="flex items-center gap-2">
            <span className="text-white font-medium">
              ${cash_short?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || 'N/A'}
            </span>
            <StatusBadge isGood={isCashShortGood} />
          </div>
        </div>
      </div>
    </div>
  )
}

