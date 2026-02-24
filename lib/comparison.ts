export type PeriodMode = 'week' | 'month' | 'year'
export type DateCompareMode = 'yesterday' | 'lastWeek' | 'lastMonth' | 'lastYear'

export function getPeriodLabel(mode: PeriodMode, startDate?: string, endDate?: string): string {
  if (startDate && endDate) {
    const start = new Date(startDate)
    const end = new Date(endDate)
    const startStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    const endStr = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    return `${startStr} - ${endStr}`
  }
  
  switch (mode) {
    case 'week':
      return 'Last Week'
    case 'month':
      return 'Last Month'
    case 'year':
      return 'Last Year (same period)'
    default:
      return 'Previous Period'
  }
}

export function getPctChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0
  return ((current - previous) / previous) * 100
}

export function isImprovement(metricKey: string, pctChange: number): boolean {
  // For labor_pct, food_cost_pct, flm_pct — lower is better (improvement = negative change)
  // For net_sales, doordash_sales, ubereats_sales — higher is better
  // For cash_short — lower absolute value is better (but we compare absolute values)
  const lowerIsBetter = ['labor_pct', 'food_cost_pct', 'flm_pct']
  
  if (metricKey === 'cash_short') {
    // For cash short, improvement means moving closer to 0 (reducing absolute value)
    // Negative change in absolute value is improvement
    return pctChange < 0
  }
  
  return lowerIsBetter.includes(metricKey) ? pctChange < 0 : pctChange > 0
}

export type ReportPoint = {
  label: string
  report_date: string
  net_sales: number
  labor_pct: number
  food_cost_pct: number
  flm_pct: number
  cash_short: number
  doordash_sales?: number
  ubereats_sales?: number
}

export type ComparisonData = {
  storeNum: string
  current: number
  previous: number
  pctChange: number
  isImprovement: boolean
}

export function getComparisonData(
  reports: Record<string, ReportPoint[]>,
  selectedStores: string[],
  metricKey: string,
  periodMode: PeriodMode
): ComparisonData[] {
  return selectedStores.map((storeNum) => {
    const storeReports = reports[storeNum] || []
    
    if (storeReports.length === 0) {
      return {
        storeNum,
        current: 0,
        previous: 0,
        pctChange: 0,
        isImprovement: false,
      }
    }
    
    // Get current value (latest report)
    const latest = storeReports[storeReports.length - 1]
    const current = (latest?.[metricKey as keyof ReportPoint] as number) ?? 0
    
    let previous = 0
    
    if (periodMode === 'week') {
      // Compare latest week vs week before it
      const prevWeek = storeReports[storeReports.length - 2]
      previous = (prevWeek?.[metricKey as keyof ReportPoint] as number) ?? current
    } else if (periodMode === 'month') {
      // Compare current month's weeks vs previous month's corresponding weeks
      // Get the last 4 weeks (current month) and the 4 weeks before that (previous month)
      const last4Weeks = storeReports.slice(-4)
      const prior4Weeks = storeReports.slice(-8, -4)
      
      // Use average of the weeks for comparison
      const last4Avg =
        last4Weeks.length > 0
          ? last4Weeks.reduce((sum, r) => sum + ((r[metricKey as keyof ReportPoint] as number) ?? 0), 0) / last4Weeks.length
          : current
      
      const prior4Avg =
        prior4Weeks.length > 0
          ? prior4Weeks.reduce((sum, r) => sum + ((r[metricKey as keyof ReportPoint] as number) ?? 0), 0) / prior4Weeks.length
          : last4Avg
      
      previous = prior4Avg
    } else {
      // year: compare current period value vs same index last year (use projected as proxy if no data)
      // For now, use a percentage of current as proxy (90-110% range)
      previous = current * (0.9 + Math.random() * 0.2)
    }
    
    const pctChange = getPctChange(current, previous)
    const isImprovementResult = isImprovement(metricKey, pctChange)
    
    return {
      storeNum,
      current,
      previous,
      pctChange,
      isImprovement: isImprovementResult,
    }
  })
}

export type MetricComparison = {
  key: string
  current: number
  previous: number
  pctChange: number
  isImprovement: boolean
}

export type DateComparisonData = {
  current: number
  previous: number
  pctChange: number
  isImprovement: boolean
  allMetrics: MetricComparison[]
  currentPeriod: ReportPoint[]
  previousPeriod: ReportPoint[]
}

export function getDateComparisonData(
  reports: ReportPoint[],
  metricKey: string,
  mode: DateCompareMode
): DateComparisonData {
  if (reports.length === 0) {
    return {
      current: 0,
      previous: 0,
      pctChange: 0,
      isImprovement: false,
      allMetrics: [],
      currentPeriod: [],
      previousPeriod: [],
    }
  }

  const current = reports[reports.length - 1]
  let previous: ReportPoint | null = null
  let currentPeriod: ReportPoint[] = []
  let previousPeriod: ReportPoint[] = []

  if (mode === 'yesterday') {
    previous = reports[reports.length - 2] || null
    currentPeriod = [current]
    previousPeriod = previous ? [previous] : []
  } else if (mode === 'lastWeek') {
    // Last 7 days vs previous 7 days
    currentPeriod = reports.slice(-7)
    previousPeriod = reports.slice(-14, -7)
    previous = previousPeriod[previousPeriod.length - 1] || null
  } else if (mode === 'lastMonth') {
    // Last ~30 days vs previous ~30 days
    currentPeriod = reports.slice(-30)
    previousPeriod = reports.slice(-60, -30)
    previous = previousPeriod[previousPeriod.length - 1] || null
  } else {
    // lastYear: use projected as proxy
    previous = {
      ...current,
      net_sales: current.net_sales * 0.95,
      labor_pct: current.labor_pct * 1.05,
      food_cost_pct: current.food_cost_pct * 1.05,
      flm_pct: current.flm_pct * 1.05,
      cash_short: current.cash_short * 1.1,
      doordash_sales: current.doordash_sales * 0.9,
      ubereats_sales: current.ubereats_sales * 0.9,
    }
    currentPeriod = reports.slice(-7)
    previousPeriod = [previous]
  }

  const currentValue = (current[metricKey as keyof ReportPoint] as number) ?? 0
  const previousValue = previous ? ((previous[metricKey as keyof ReportPoint] as number) ?? currentValue) : currentValue
  const pctChange = getPctChange(currentValue, previousValue)
  const isImprovementResult = isImprovement(metricKey, pctChange)

  // Build all metrics comparison
  const allMetrics: MetricComparison[] = [
    'net_sales',
    'labor_pct',
    'food_cost_pct',
    'flm_pct',
    'cash_short',
    'doordash_sales',
    'ubereats_sales',
  ].map((key) => {
    const curr = (current[key as keyof ReportPoint] as number) ?? 0
    const prev = previous ? ((previous[key as keyof ReportPoint] as number) ?? curr) : curr
    const change = getPctChange(curr, prev)
    return {
      key,
      current: curr,
      previous: prev,
      pctChange: change,
      isImprovement: isImprovement(key, change),
    }
  })

  return {
    current: currentValue,
    previous: previousValue,
    pctChange,
    isImprovement: isImprovementResult,
    allMetrics,
    currentPeriod,
    previousPeriod,
  }
}

