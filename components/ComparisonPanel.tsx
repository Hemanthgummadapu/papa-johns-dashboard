'use client'

import { useState, useMemo, useEffect } from 'react'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import { getComparisonData, getPctChange, isImprovement, type PeriodMode, type ReportPoint } from '@/lib/comparison'

type StoreUI = {
  id: string
  number: string
  name: string
  location: string
}

type Metric = {
  key: string
  label: string
  fmt: (v: number) => string
  color: string
  unit: '$' | '%'
}

type ComparisonPanelProps = {
  selectedStores: string[]
  activeMetric: string | null
  reports: Record<string, ReportPoint[]>
  stores: StoreUI[]
  metrics: Metric[]
  storeColors: string[]
  targets: Partial<Record<string, number>>
  onMetricSelect?: (metricKey: string) => void
  cubeData?: Array<{
    storeNumber: string
    netSales: number | null
    lyNetSales: number | null
    laborPct: number | null
    foodCostUsd: number | null
    flmPct: number | null
    dddSales: number | null
    aggregatorSales: number | null
  }> | null
  cubeDate?: string
  cubePeriod?: 'daily' | 'weekly' | 'monthly' | 'yearly'
}

// Helper functions for date calculations
function getDefaultWeek(): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 4 - (d.getDay() || 7))
  const jan1 = new Date(d.getFullYear(), 0, 1)
  const w = Math.ceil((((d.getTime() - jan1.getTime()) / 86400000) + jan1.getDay() + 1) / 7)
  return `${d.getFullYear()}-W${String(w).padStart(2, '0')}`
}

function getDefaultMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function getPrevWeeks(current: string, n: number): string[] {
  // current = '2026-W08'
  const [year, weekStr] = current.split('-W')
  const results: string[] = []
  let y = parseInt(year, 10)
  let w = parseInt(weekStr, 10)
  for (let i = 0; i < n; i++) {
    results.push(`${y}-W${String(w).padStart(2, '0')}`)
    w--
    if (w < 1) {
      w = 52
      y--
    }
  }
  return results.reverse()
}

function getPrevMonths(current: string, n: number): string[] {
  const [year, month] = current.split('-').map(Number)
  const results: string[] = []
  let y = year
  let m = month
  for (let i = 0; i < n; i++) {
    results.push(`${y}-${String(m).padStart(2, '0')}`)
    m--
    if (m < 1) {
      m = 12
      y--
    }
  }
  return results.reverse()
}

function roundPct(v: number): number {
  return Math.round(v * 10) / 10
}

type CubeStore = {
  storeNumber: string
  netSales: number | null
  lyNetSales: number | null
  laborPct: number | null
  foodCostUsd: number | null
  flmPct: number | null
  dddSales: number | null
  aggregatorSales: number | null
}

function getMetricValue(store: CubeStore, metricKey: string | null): number {
  if (!metricKey) return 0
  
  switch (metricKey) {
    case 'net_sales':
      return store.netSales ?? 0
    case 'labor_pct':
      return roundPct(store.laborPct ?? 0)
    case 'food_cost_pct':
      const netSales = store.netSales ?? 0
      return netSales && store.foodCostUsd != null
        ? roundPct((store.foodCostUsd / netSales) * 100)
        : 0
    case 'flm_pct':
      return roundPct(store.flmPct ?? 0)
    case 'doordash_sales':
      return store.dddSales ?? 0
    case 'ubereats_sales':
      return store.aggregatorSales ?? 0
    default:
      return 0
  }
}

function extractStoreValues(stores: CubeStore[], selectedStores: string[], metricKey: string | null): Record<string, number> {
  const obj: Record<string, number> = {}
  stores.forEach((s) => {
    if (selectedStores.includes(String(s.storeNumber))) {
      obj[s.storeNumber] = getMetricValue(s, metricKey)
    }
  })
  return obj
}

export default function ComparisonPanel({
  selectedStores,
  activeMetric,
  reports,
  stores,
  metrics,
  storeColors,
  targets,
  onMetricSelect,
  cubeData,
  cubeDate,
  cubePeriod = 'daily',
}: ComparisonPanelProps) {
  const [periodMode, setPeriodMode] = useState<PeriodMode>('week')
  const [viewMode, setViewMode] = useState<'summary' | 'graph'>('summary')
  const [cubeReports, setCubeReports] = useState<Record<string, ReportPoint[]>>({})
  const [cubeLoading, setCubeLoading] = useState(false)
  const [hasCubeData, setHasCubeData] = useState(false)
  const [yoyChartData, setYoyChartData] = useState<Array<Record<string, number | string>>>([])
  const [yoyError, setYoyError] = useState<string | null>(null)

  // Fetch cube data for year-over-year comparisons
  useEffect(() => {
    if (periodMode === 'year') {
      if (!cubeDate || !activeMetric) {
        setHasCubeData(false)
        setCubeReports({})
        setYoyChartData([])
        setYoyError(null)
        return
      }

      setCubeLoading(true)
      setYoyError(null)

      // Calculate last year date
      const lastYearDate = cubeDate.replace(/^(\d{4})/, (y) => String(parseInt(y, 10) - 1))

      // For monthly period, fetch last 12 months TY vs last 12 months LY
      if (cubePeriod === 'monthly') {
        const tyMonths = getPrevMonths(cubeDate, 12)
        const lyMonths = tyMonths.map((m) => m.replace(/^(\d{4})/, (y) => String(parseInt(y, 10) - 1)))

        Promise.all([
          Promise.all(
            tyMonths.map((m) =>
              fetch(`/api/cube?date=${encodeURIComponent(m)}&period=monthly`, { cache: 'no-store' })
                .then((r) => r.json())
                .catch(() => ({ success: false, stores: [] }))
            )
          ),
          Promise.all(
            lyMonths.map((m) =>
              fetch(`/api/cube?date=${encodeURIComponent(m)}&period=monthly`, { cache: 'no-store' })
                .then((r) => r.json())
                .catch(() => ({ success: false, stores: [] }))
            )
          ),
        ])
          .then(([tyResults, lyResults]) => {
            // Check if we have any valid data
            const hasData = tyResults.some((r) => r.success && r.stores?.length > 0) ||
                          lyResults.some((r) => r.success && r.stores?.length > 0)

            if (!hasData) {
              setYoyError('No data available for this period')
              setHasCubeData(false)
              setYoyChartData([])
              return
            }

            // Build chart data with TY and LY lines
            const chartData = tyMonths.map((month, i) => {
              const tyStores = tyResults[i]?.stores || []
              const lyStores = lyResults[i]?.stores || []
              
              const point: Record<string, number | string> = { date: month }
              
              // Add TY values
              selectedStores.forEach((storeNum) => {
                const tyStore = tyStores.find((s: CubeStore) => String(s.storeNumber) === storeNum)
                point[`${storeNum}_ty`] = tyStore ? getMetricValue(tyStore, activeMetric) : 0
              })
              
              // Add LY values
              selectedStores.forEach((storeNum) => {
                const lyStore = lyStores.find((s: CubeStore) => String(s.storeNumber) === storeNum)
                point[`${storeNum}_ly`] = lyStore ? getMetricValue(lyStore, activeMetric) : 0
              })
              
              return point
            })

            setYoyChartData(chartData)
            setHasCubeData(chartData.length > 0)
            
            // Also build ReportPoint[] format for comparisonData
            const newReports: Record<string, ReportPoint[]> = {}
            selectedStores.forEach((storeNum) => {
              newReports[storeNum] = tyMonths.map((month, i) => {
                const tyStore = tyResults[i]?.stores?.find((s: CubeStore) => String(s.storeNumber) === storeNum)
                const lyStore = lyResults[i]?.stores?.find((s: CubeStore) => String(s.storeNumber) === storeNum)
                
                if (!tyStore) {
                  return {
                    label: month,
                    report_date: month,
                    net_sales: 0,
                    labor_pct: 0,
                    food_cost_pct: 0,
                    flm_pct: 0,
                    cash_short: 0,
                    doordash_sales: 0,
                    ubereats_sales: 0,
                  }
                }

                const netSales = tyStore.netSales ?? 0
                const foodCostPct =
                  netSales && tyStore.foodCostUsd != null
                    ? roundPct((tyStore.foodCostUsd / netSales) * 100)
                    : 0

                return {
                  label: month,
                  report_date: month,
                  net_sales: netSales,
                  labor_pct: roundPct(tyStore.laborPct ?? 0),
                  food_cost_pct: foodCostPct,
                  flm_pct: roundPct(tyStore.flmPct ?? 0),
                  cash_short: 0,
                  doordash_sales: tyStore.dddSales ?? 0,
                  ubereats_sales: tyStore.aggregatorSales ?? 0,
                }
              })
            })
            setCubeReports(newReports)
          })
          .catch((err) => {
            console.error('Error fetching YoY monthly data:', err)
            setYoyError('Failed to load year-over-year data')
            setHasCubeData(false)
            setYoyChartData([])
          })
          .finally(() => setCubeLoading(false))
      } else {
        // For daily/weekly/yearly, fetch single period comparison
        Promise.all([
          fetch(`/api/cube?date=${encodeURIComponent(cubeDate)}&period=${cubePeriod}`, { cache: 'no-store' })
            .then((r) => r.json())
            .catch(() => ({ success: false, stores: [] })),
          fetch(`/api/cube?date=${encodeURIComponent(lastYearDate)}&period=${cubePeriod}`, { cache: 'no-store' })
            .then((r) => r.json())
            .catch(() => ({ success: false, stores: [] })),
        ])
          .then(([currentData, lastYearData]) => {
            // Check if we have any valid data
            const hasData =
              (currentData.success && currentData.stores?.length > 0) ||
              (lastYearData.success && lastYearData.stores?.length > 0)

            if (!hasData) {
              setYoyError('No data available for this period')
              setHasCubeData(false)
              setYoyChartData([])
              return
            }

            // Build 2-point comparison: This Year vs Last Year
            const chartData = [
              {
                date: `LY ${lastYearDate}`,
                ...extractStoreValues(lastYearData.stores || [], selectedStores, activeMetric),
              },
              {
                date: `TY ${cubeDate}`,
                ...extractStoreValues(currentData.stores || [], selectedStores, activeMetric),
              },
            ]

            setYoyChartData(chartData)
            setHasCubeData(chartData.length > 0)

            // Also build ReportPoint[] format for comparisonData
            const newReports: Record<string, ReportPoint[]> = {}
            selectedStores.forEach((storeNum) => {
              const tyStore = (currentData.stores || []).find((s: CubeStore) => String(s.storeNumber) === storeNum)
              const lyStore = (lastYearData.stores || []).find((s: CubeStore) => String(s.storeNumber) === storeNum)

              if (!tyStore && !lyStore) {
                newReports[storeNum] = []
                return
              }

              const points: ReportPoint[] = []
              
              if (lyStore) {
                const lyNetSales = lyStore.netSales ?? 0
                const lyFoodCostPct =
                  lyNetSales && lyStore.foodCostUsd != null
                    ? roundPct((lyStore.foodCostUsd / lyNetSales) * 100)
                    : 0
                points.push({
                  label: `LY ${lastYearDate}`,
                  report_date: lastYearDate,
                  net_sales: lyNetSales,
                  labor_pct: roundPct(lyStore.laborPct ?? 0),
                  food_cost_pct: lyFoodCostPct,
                  flm_pct: roundPct(lyStore.flmPct ?? 0),
                  cash_short: 0,
                  doordash_sales: lyStore.dddSales ?? 0,
                  ubereats_sales: lyStore.aggregatorSales ?? 0,
                })
              }

              if (tyStore) {
                const tyNetSales = tyStore.netSales ?? 0
                const tyFoodCostPct =
                  tyNetSales && tyStore.foodCostUsd != null
                    ? roundPct((tyStore.foodCostUsd / tyNetSales) * 100)
                    : 0
                points.push({
                  label: `TY ${cubeDate}`,
                  report_date: cubeDate,
                  net_sales: tyNetSales,
                  labor_pct: roundPct(tyStore.laborPct ?? 0),
                  food_cost_pct: tyFoodCostPct,
                  flm_pct: roundPct(tyStore.flmPct ?? 0),
                  cash_short: 0,
                  doordash_sales: tyStore.dddSales ?? 0,
                  ubereats_sales: tyStore.aggregatorSales ?? 0,
                })
              }

              newReports[storeNum] = points
            })
            setCubeReports(newReports)
          })
          .catch((err) => {
            console.error('Error fetching YoY data:', err)
            setYoyError('Failed to load year-over-year data')
            setHasCubeData(false)
            setYoyChartData([])
          })
          .finally(() => setCubeLoading(false))
      }
      return
    }

    if (periodMode === 'week') {
      if (!activeMetric) {
        setHasCubeData(false)
        setCubeReports({})
        setYoyChartData([])
        setYoyError(null)
        return
      }

      setCubeLoading(true)
      setYoyError(null)
      const currentWeek = getDefaultWeek()
      // Fetch last 8 weeks: recent 4 (W05-W08) and previous 4 (W01-W04)
      const allWeeks = getPrevWeeks(currentWeek, 8)
      const recentWeeks = allWeeks.slice(-4) // Last 4 weeks (W05-W08)
      const previousWeeks = allWeeks.slice(0, 4) // Previous 4 weeks (W01-W04)
      
      Promise.all(
        allWeeks.map((w) =>
          fetch(`/api/cube?date=${encodeURIComponent(w)}&period=weekly`, { cache: 'no-store' })
            .then((r) => r.json())
            .catch(() => ({ success: false, stores: [] }))
        )
      )
        .then((results) => {
          // Check if we have any valid data
          const hasData = results.some((r) => r.success && r.stores?.length > 0)

          if (!hasData) {
            setYoyError('No data available for this period')
            setHasCubeData(false)
            setYoyChartData([])
            setCubeReports({})
            return
          }

          // Build chart data with two 4-week windows
          // X axis: Week 1, Week 2, Week 3, Week 4
          const chartData = recentWeeks.map((week, i) => {
            const recentStores = results[allWeeks.indexOf(week)]?.stores || []
            const previousStores = results[allWeeks.indexOf(previousWeeks[i])]?.stores || []
            
            const point: Record<string, number | string> = { date: `Week ${i + 1}` }
            
            selectedStores.forEach((storeNum) => {
              const recentStore = recentStores.find((s: CubeStore) => String(s.storeNumber) === storeNum)
              point[`${storeNum}_current`] = recentStore ? getMetricValue(recentStore, activeMetric) : 0
              const previousStore = previousStores.find((s: CubeStore) => String(s.storeNumber) === storeNum)
              point[`${storeNum}_previous`] = previousStore ? getMetricValue(previousStore, activeMetric) : 0
            })
            
            return point
          })

          setYoyChartData(chartData)
          setHasCubeData(chartData.length > 0)

          // Also build ReportPoint[] format for comparisonData
          const newReports: Record<string, ReportPoint[]> = {}
          selectedStores.forEach((storeNum) => {
            const points: ReportPoint[] = []
            
            // Previous period (first 4 weeks)
            previousWeeks.forEach((week, i) => {
              const weekData = results[allWeeks.indexOf(week)]?.stores || []
              const storeData = weekData.find((s: CubeStore) => String(s.storeNumber) === storeNum)
              
              if (storeData) {
                const netSales = storeData.netSales ?? 0
                const foodCostPct =
                  netSales && storeData.foodCostUsd != null
                    ? roundPct((storeData.foodCostUsd / netSales) * 100)
                    : 0

                points.push({
                  label: `Week ${i + 1} (Previous)`,
                  report_date: week,
                  net_sales: netSales,
                  labor_pct: roundPct(storeData.laborPct ?? 0),
                  food_cost_pct: foodCostPct,
                  flm_pct: roundPct(storeData.flmPct ?? 0),
                  cash_short: 0,
                  doordash_sales: storeData.dddSales ?? 0,
                  ubereats_sales: storeData.aggregatorSales ?? 0,
                })
              }
            })

            // Recent period (last 4 weeks)
            recentWeeks.forEach((week, i) => {
              const weekData = results[allWeeks.indexOf(week)]?.stores || []
              const storeData = weekData.find((s: CubeStore) => String(s.storeNumber) === storeNum)
              
              if (storeData) {
                const netSales = storeData.netSales ?? 0
                const foodCostPct =
                  netSales && storeData.foodCostUsd != null
                    ? roundPct((storeData.foodCostUsd / netSales) * 100)
                    : 0

                points.push({
                  label: `Week ${i + 1} (Recent)`,
                  report_date: week,
                  net_sales: netSales,
                  labor_pct: roundPct(storeData.laborPct ?? 0),
                  food_cost_pct: foodCostPct,
                  flm_pct: roundPct(storeData.flmPct ?? 0),
                  cash_short: 0,
                  doordash_sales: storeData.dddSales ?? 0,
                  ubereats_sales: storeData.aggregatorSales ?? 0,
                })
              }
            })

            newReports[storeNum] = points
          })
          setCubeReports(newReports)
        })
        .catch((err) => {
          console.error('Error fetching week comparison data:', err)
          setYoyError('Failed to load week comparison data')
          setHasCubeData(false)
          setYoyChartData([])
          setCubeReports({})
        })
        .finally(() => setCubeLoading(false))
    } else if (periodMode === 'month') {
      if (!activeMetric) {
        setHasCubeData(false)
        setCubeReports({})
        setYoyChartData([])
        setYoyError(null)
        return
      }

      setCubeLoading(true)
      setYoyError(null)
      const currentMonth = getDefaultMonth()
      const allMonths = getPrevMonths(currentMonth, 6)
      const previousMonths = allMonths.slice(0, 3) // older 3 months
      const recentMonths = allMonths.slice(3, 6)   // recent 3 months

      Promise.all(
        allMonths.map((m) =>
          fetch(`/api/cube?date=${encodeURIComponent(m)}&period=monthly`, { cache: 'no-store' })
            .then((r) => r.json())
            .catch(() => ({ success: false, stores: [] }))
        )
      )
        .then((results) => {
          const hasData = results.some((r) => r.success && r.stores?.length > 0)

          if (!hasData) {
            setYoyError('No data available for this period')
            setHasCubeData(false)
            setYoyChartData([])
            setCubeReports({})
            return
          }

          // Build dual-line chart data: Month 1–3 on X axis
          const chartData = recentMonths.map((month, i) => {
            const currentStores = results[allMonths.indexOf(month)]?.stores || []
            const previousStores = results[allMonths.indexOf(previousMonths[i])]?.stores || []

            const point: Record<string, number | string> = { date: `Month ${i + 1}` }

            selectedStores.forEach((storeNum) => {
              const currentStore = currentStores.find((s: CubeStore) => String(s.storeNumber) === storeNum)
              point[`${storeNum}_current`] = currentStore ? getMetricValue(currentStore, activeMetric) : 0
              const previousStore = previousStores.find((s: CubeStore) => String(s.storeNumber) === storeNum)
              point[`${storeNum}_previous`] = previousStore ? getMetricValue(previousStore, activeMetric) : 0
            })

            return point
          })

          setYoyChartData(chartData)
          setHasCubeData(chartData.length > 0)

          // Build ReportPoint[] for comparisonData (summary cards)
          const newReports: Record<string, ReportPoint[]> = {}
          selectedStores.forEach((storeNum) => {
            const points: ReportPoint[] = []

            previousMonths.forEach((month, i) => {
              const storeData = results[allMonths.indexOf(month)]?.stores?.find(
                (s: CubeStore) => String(s.storeNumber) === storeNum
              )
              if (storeData) {
                const netSales = storeData.netSales ?? 0
                const foodCostPct =
                  netSales && storeData.foodCostUsd != null
                    ? roundPct((storeData.foodCostUsd / netSales) * 100)
                    : 0
                points.push({
                  label: `Month ${i + 1} (Previous)`,
                  report_date: month,
                  net_sales: netSales,
                  labor_pct: roundPct(storeData.laborPct ?? 0),
                  food_cost_pct: foodCostPct,
                  flm_pct: roundPct(storeData.flmPct ?? 0),
                  cash_short: 0,
                  doordash_sales: storeData.dddSales ?? 0,
                  ubereats_sales: storeData.aggregatorSales ?? 0,
                })
              }
            })

            recentMonths.forEach((month, i) => {
              const storeData = results[allMonths.indexOf(month)]?.stores?.find(
                (s: CubeStore) => String(s.storeNumber) === storeNum
              )
              if (storeData) {
                const netSales = storeData.netSales ?? 0
                const foodCostPct =
                  netSales && storeData.foodCostUsd != null
                    ? roundPct((storeData.foodCostUsd / netSales) * 100)
                    : 0
                points.push({
                  label: `Month ${i + 1} (Recent)`,
                  report_date: month,
                  net_sales: netSales,
                  labor_pct: roundPct(storeData.laborPct ?? 0),
                  food_cost_pct: foodCostPct,
                  flm_pct: roundPct(storeData.flmPct ?? 0),
                  cash_short: 0,
                  doordash_sales: storeData.dddSales ?? 0,
                  ubereats_sales: storeData.aggregatorSales ?? 0,
                })
              }
            })

            newReports[storeNum] = points
          })
          setCubeReports(newReports)
        })
        .catch((err) => {
          console.error('Error fetching month comparison data:', err)
          setYoyError('Failed to load month comparison data')
          setHasCubeData(false)
          setYoyChartData([])
          setCubeReports({})
        })
        .finally(() => setCubeLoading(false))
    }
  }, [periodMode, selectedStores, cubeDate, cubePeriod, activeMetric])

  // Use cube data if available, otherwise fall back to CSV reports
  const effectiveReports = useMemo(() => {
    if (hasCubeData && Object.keys(cubeReports).length > 0) {
      return cubeReports
    }
    return reports
  }, [hasCubeData, cubeReports, reports])

  const comparisonData = useMemo(() => {
    if (!activeMetric) return []
    // For year mode, use fetched YoY data
    if (periodMode === 'year') {
      if (!hasCubeData || Object.keys(cubeReports).length === 0) {
        return selectedStores.map((storeNum) => ({
          storeNum,
          current: 0,
          previous: 0,
          pctChange: 0,
          isImprovement: false,
        }))
      }

      return selectedStores.map((storeNum) => {
        const storeReports = cubeReports[storeNum] || []
        if (storeReports.length === 0) {
          return {
            storeNum,
            current: 0,
            previous: 0,
            pctChange: 0,
            isImprovement: false,
          }
        }

        // For monthly, compare latest TY vs latest LY
        // For single period, compare TY vs LY
        const tyReport = storeReports.find((r) => r.label.startsWith('TY')) || storeReports[storeReports.length - 1]
        const lyReport = storeReports.find((r) => r.label.startsWith('LY')) || storeReports[0]

        const current = (tyReport?.[activeMetric as keyof ReportPoint] as number) ?? 0
        const previous = (lyReport?.[activeMetric as keyof ReportPoint] as number) ?? 0

        const pctChange = getPctChange(current, previous)
        return {
          storeNum,
          current,
          previous,
          pctChange,
          isImprovement: isImprovement(activeMetric, pctChange),
        }
      })
    }
    return getComparisonData(effectiveReports, selectedStores, activeMetric, periodMode)
  }, [effectiveReports, selectedStores, activeMetric, periodMode, hasCubeData, cubeReports])

  // Build chart data for line chart (last 5 data points)
  const lineChartData = useMemo(() => {
    // For week mode — dual lines: _current (solid) vs _previous (dashed)
    if (periodMode === 'week' && yoyChartData.length > 0) {
      return yoyChartData.map((point) => {
        const newPoint: Record<string, number | string> = { week: point.date as string }
        selectedStores.forEach((storeNum) => {
          newPoint[`${storeNum}_current`] = point[`${storeNum}_current`] ?? 0
          newPoint[`${storeNum}_previous`] = point[`${storeNum}_previous`] ?? 0
        })
        return newPoint
      })
    }

    // For month mode — dual lines: _current (solid) vs _previous (dashed)
    if (periodMode === 'month' && yoyChartData.length > 0) {
      return yoyChartData.map((point) => {
        const newPoint: Record<string, number | string> = { week: point.date as string }
        selectedStores.forEach((storeNum) => {
          newPoint[`${storeNum}_current`] = point[`${storeNum}_current`] ?? 0
          newPoint[`${storeNum}_previous`] = point[`${storeNum}_previous`] ?? 0
        })
        return newPoint
      })
    }

    // For year mode with monthly period, use YoY chart data with TY and LY lines
    if (periodMode === 'year' && cubePeriod === 'monthly' && yoyChartData.length > 0) {
      return yoyChartData.map((point) => {
        const newPoint: Record<string, number | string> = { week: point.date as string }
        selectedStores.forEach((storeNum) => {
          newPoint[`${storeNum}_ty`] = point[`${storeNum}_ty`] ?? 0
          newPoint[`${storeNum}_ly`] = point[`${storeNum}_ly`] ?? 0
        })
        return newPoint
      })
    }

    // For year mode single period, use YoY chart data
    if (periodMode === 'year' && yoyChartData.length > 0) {
      return yoyChartData.map((point) => {
        const newPoint: Record<string, number | string> = { week: point.date as string }
        selectedStores.forEach((storeNum) => {
          newPoint[storeNum] = point[storeNum] ?? 0
        })
        return newPoint
      })
    }

    if (!activeMetric) {
      // For mini sparklines, build data for all metrics
      const dataPoints: Array<Record<string, number | string>> = []
      const maxLength = Math.max(...selectedStores.map((num) => (effectiveReports[num] || []).length), 0)
      const numPoints = Math.min(5, maxLength)
      
      for (let i = numPoints - 1; i >= 0; i--) {
        const point: Record<string, number | string> = {}
        let label = ''
        
        selectedStores.forEach((storeNum) => {
          const storeReports = effectiveReports[storeNum] || []
          const idx = storeReports.length - 1 - i
          if (idx >= 0 && idx < storeReports.length) {
            const report = storeReports[idx]
            if (!label) label = report.label // Use first store's label
            point[storeNum] = (report.net_sales as number) ?? 0 // Default to net_sales for mini charts
          } else {
            point[storeNum] = 0
          }
        })
        
        point.week = label || `W${numPoints - i}`
        dataPoints.push(point)
      }
      return dataPoints
    }
    
    const dataPoints: Array<Record<string, number | string>> = []
    const maxLength = Math.max(...selectedStores.map((num) => (effectiveReports[num] || []).length), 0)
    const numPoints = Math.min(5, maxLength)
    
    for (let i = numPoints - 1; i >= 0; i--) {
      const point: Record<string, number | string> = {}
      let label = ''
      
      selectedStores.forEach((storeNum) => {
        const storeReports = effectiveReports[storeNum] || []
        const idx = storeReports.length - 1 - i
        if (idx >= 0 && idx < storeReports.length) {
          const report = storeReports[idx]
          if (!label) label = report.label // Use first store's label
          point[storeNum] = (report[activeMetric as keyof ReportPoint] as number) ?? 0
        } else {
          point[storeNum] = 0
        }
      })
      
      point.week = label || `W${numPoints - i}`
      dataPoints.push(point)
    }
    
    return dataPoints
  }, [effectiveReports, selectedStores, activeMetric, periodMode, cubePeriod, yoyChartData])

  // Build bar chart data (current vs previous period)
  const barChartData = useMemo(() => {
    return comparisonData.map((data) => {
      const store = stores.find((s) => s.number === data.storeNum)
      return {
        store: store?.number || data.storeNum,
        current: data.current,
        previous: data.previous,
      }
    })
  }, [comparisonData, stores])

  const activeMetricObj = metrics.find((m) => m.key === activeMetric) || metrics[0]
  const target = activeMetric ? targets[activeMetric] : undefined

  const isDualLineMode =
    periodMode === 'week' ||
    periodMode === 'month' ||
    (periodMode === 'year' && cubePeriod === 'monthly')

  const legendLabel = (val: string) => {
    if (val.endsWith('_ty')) return `Store ${val.replace('_ty', '')} — This Year`
    if (val.endsWith('_ly')) return `Store ${val.replace('_ly', '')} — Last Year`
    if (val.endsWith('_current')) {
      const suffix = periodMode === 'week' ? 'Current 4 Wks' : 'Current 3 Mo'
      return `Store ${val.replace('_current', '')} — ${suffix}`
    }
    if (val.endsWith('_previous')) {
      const suffix = periodMode === 'week' ? 'Previous 4 Wks' : 'Previous 3 Mo'
      return `Store ${val.replace('_previous', '')} — ${suffix}`
    }
    return `Store ${val}`
  }

  const DualLines = () => (
    <>
      {selectedStores.flatMap((storeNum) => {
        const storeIdx = stores.findIndex((s) => s.number === storeNum)
        const color = storeColors[storeIdx % storeColors.length]
        const currentKey = periodMode === 'year' ? `${storeNum}_ty` : `${storeNum}_current`
        const previousKey = periodMode === 'year' ? `${storeNum}_ly` : `${storeNum}_previous`
        return [
          <Line
            key={currentKey}
            type="monotoneX"
            dataKey={currentKey}
            stroke={color}
            strokeWidth={2.5}
            dot={{ r: 3, fill: color }}
            activeDot={{ r: 5 }}
          />,
          <Line
            key={previousKey}
            type="monotoneX"
            dataKey={previousKey}
            stroke={color}
            strokeWidth={2.5}
            strokeDasharray="5 5"
            dot={{ r: 3, fill: color }}
            activeDot={{ r: 5 }}
          />,
        ]
      })}
    </>
  )

  const SingleLines = () => (
    <>
      {selectedStores.map((storeNum) => {
        const storeIdx = stores.findIndex((s) => s.number === storeNum)
        return (
          <Line
            key={storeNum}
            type="monotoneX"
            dataKey={storeNum}
            stroke={storeColors[storeIdx % storeColors.length]}
            strokeWidth={2.5}
            dot={{ r: 3, fill: storeColors[storeIdx % storeColors.length] }}
            activeDot={{ r: 5 }}
          />
        )
      })}
    </>
  )

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload) return null
    return (
      <div style={{ background: 'var(--bg-overlay)', border: '1px solid var(--border-default)', borderRadius: 8, padding: '12px 16px' }}>
        <div style={{ fontSize: 12, color: 'var(--text-primary)', fontFamily: "'Inter', sans-serif", marginBottom: 8 }}>{label}</div>
        {payload.map((p: any, i: number) => {
          const baseStore = (p.dataKey as string)?.replace(/_ty$|_ly$|_current$|_previous$/, '')
          const comp = comparisonData.find((c) => c.storeNum === baseStore)
          const seriesLabel = legendLabel(p.dataKey)
          return (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.color }} />
              <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: "'Inter', sans-serif" }}>
                {seriesLabel}:
              </span>
              <span style={{ fontSize: 12, fontWeight: 600, color: p.color, fontFamily: "'JetBrains Mono', monospace" }}>
                {activeMetricObj.fmt(p.value)}
              </span>
              {comp && (p.dataKey?.endsWith('_ty') || p.dataKey?.endsWith('_current') || !isDualLineMode) && (
                <span style={{ fontSize: 11, color: comp.isImprovement ? 'var(--success-text)' : 'var(--danger-text)', fontFamily: "'JetBrains Mono', monospace" }}>
                  ({comp.pctChange >= 0 ? '+' : ''}{comp.pctChange.toFixed(1)}%)
                </span>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  if (!activeMetric) {
    // Show mini sparklines grid when no metric selected
    return (
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 20 }}>
        <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 15, color: 'var(--text-primary)', marginBottom: 20 }}>
          Compare All Metrics
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
          {metrics.map((metric) => {
            // Build mini data for this specific metric
            const miniData: Array<Record<string, number | string>> = []
            const maxLength = Math.max(...selectedStores.map((num) => (effectiveReports[num] || []).length), 0)
            const dataPoints = Math.min(5, maxLength)
            
            for (let i = dataPoints - 1; i >= 0; i--) {
              const week: Record<string, number | string> = { week: `W${dataPoints - i}` }
              selectedStores.forEach((storeNum) => {
                const storeReports = effectiveReports[storeNum] || []
                const idx = storeReports.length - 1 - i
                if (idx >= 0 && idx < storeReports.length) {
                  const point = storeReports[idx]
                  week[storeNum] = (point[metric.key as keyof ReportPoint] as number) ?? 0
                } else {
                  week[storeNum] = 0
                }
              })
              miniData.push(week)
            }

            return (
              <div
                key={metric.key}
                style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 12,
                  padding: 16,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onClick={() => {
                  if (onMetricSelect) {
                    onMetricSelect(metric.key)
                  }
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = metric.color
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-subtle)'
                }}
              >
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: "'Inter', sans-serif", fontWeight: 500, letterSpacing: '0.08em', marginBottom: 8 }}>
                  {metric.label}
                </div>
                <ResponsiveContainer width="100%" height={120}>
                  <LineChart data={miniData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                    <XAxis dataKey="week" hide />
                    <YAxis hide />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload) return null
                        return (
                          <div style={{ background: 'var(--bg-overlay)', border: '1px solid var(--border-default)', borderRadius: 8, padding: '12px 16px' }}>
                            <div style={{ fontSize: 12, color: 'var(--text-primary)', fontFamily: "'Inter', sans-serif", marginBottom: 8 }}>
                              {metric.label}
                            </div>
                            {payload.map((p: any, i: number) => (
                              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                                <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.color }} />
                                <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: "'Inter', sans-serif" }}>Store {p.dataKey}:</span>
                                <span style={{ fontSize: 12, fontWeight: 600, color: p.color, fontFamily: "'JetBrains Mono', monospace" }}>
                                  {metric.fmt(p.value)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )
                      }}
                    />
                    {selectedStores.map((storeNum, i) => {
                      const storeIdx = stores.findIndex((s) => s.number === storeNum)
                      return (
                        <Line
                          key={storeNum}
                          type="monotone"
                          dataKey={storeNum}
                          stroke={storeColors[storeIdx % storeColors.length]}
                          strokeWidth={2}
                          dot={false}
                          activeDot={{ r: 3 }}
                        />
                      )
                    })}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 20 }}>
      {/* Header with View Toggle */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 15, color: 'var(--text-primary)' }}>
            {activeMetricObj.label} Comparison
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 4, fontFamily: "'Inter', sans-serif", fontWeight: 400 }}>
            {selectedStores.length} store{selectedStores.length !== 1 ? 's' : ''} · {periodMode === 'week' ? 'vs Previous Week' : periodMode === 'month' ? 'vs Previous Month' : 'vs Same Period Last Year'}
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* View Mode Toggle */}
          <div style={{ display: 'flex', gap: 4, background: 'var(--bg-overlay)', borderRadius: 8, padding: 4, border: '1px solid var(--border-subtle)' }}>
            {([
              ['summary', 'Summary'],
              ['graph', 'Graph View'],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setViewMode(key as 'summary' | 'graph')}
                style={{
                  padding: '6px 16px',
                  borderRadius: 8,
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 13,
                  fontWeight: 600,
                  letterSpacing: '0.04em',
                  background: viewMode === key ? 'var(--bg-elevated)' : 'transparent',
                  color: viewMode === key ? 'var(--text-primary)' : 'var(--text-tertiary)',
                  transition: 'all 0.2s',
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Period Toggle */}
          <div style={{ display: 'flex', gap: 4, background: 'var(--bg-overlay)', borderRadius: 8, padding: 4, border: '1px solid var(--border-subtle)' }}>
            {([
              ['week', 'vs Previous Week'],
              ['month', 'vs Previous Month'],
              ['year', 'vs Same Period Last Year'],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setPeriodMode(key)}
                style={{
                  padding: '6px 16px',
                  borderRadius: 8,
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 13,
                  fontWeight: 600,
                  letterSpacing: '0.04em',
                  background: periodMode === key ? 'var(--bg-elevated)' : 'transparent',
                  color: periodMode === key ? 'var(--text-primary)' : 'var(--text-tertiary)',
                  transition: 'all 0.2s',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content with smooth transition */}
      <div
        style={{
          opacity: 1,
          transition: 'opacity 0.3s ease-in-out',
        }}
      >

        {viewMode === 'summary' ? (
          <>
            {/* Line Chart */}
            <div style={{ marginBottom: 24 }}>
              {cubeLoading ? (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-secondary)', fontFamily: "'Inter', sans-serif", fontSize: 13, minHeight: 240 }}>
                  Loading comparison data...
                </div>
              ) : yoyError ? (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--danger-text)', fontFamily: "'Inter', sans-serif", fontSize: 13, minHeight: 240 }}>
                  {yoyError}
                </div>
              ) : lineChartData.length < 3 && !hasCubeData && periodMode !== 'year' ? (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-secondary)', fontFamily: "'Inter', sans-serif", fontSize: 13, minHeight: 240 }}>
                  Not enough data points for this view. Upload more weekly reports to see trends.
                </div>
              ) : lineChartData.length === 0 && periodMode === 'year' ? (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-secondary)', fontFamily: "'Inter', sans-serif", fontSize: 13, minHeight: 240 }}>
                  No chart data available. Please select a metric and ensure data is loaded.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={Math.max(240, 280)}>
                  <LineChart data={lineChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="1 3" stroke="var(--border-subtle)" />
                    <XAxis
                      dataKey="week"
                      stroke="var(--text-tertiary)"
                      tick={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", fill: 'var(--text-tertiary)' }}
                    />
                    <YAxis
                      stroke="var(--text-tertiary)"
                      tick={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", fill: 'var(--text-tertiary)' }}
                      tickFormatter={(v) => (activeMetricObj.unit === '$' ? `$${(v / 1000).toFixed(0)}k` : `${v}%`)}
                      domain={
                        lineChartData.length > 0
                          ? [
                              (dataMin: number) => Math.max(0, Math.floor(dataMin * 0.92)),
                              (dataMax: number) => Math.ceil(dataMax * 1.08),
                            ]
                          : [0, 100]
                      }
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend
                      wrapperStyle={{ fontSize: 12, fontFamily: "'Inter', sans-serif", color: 'var(--text-secondary)' }}
                      formatter={legendLabel}
                    />
                    {target !== undefined && (
                      <ReferenceLine y={target} stroke="var(--warning)" strokeDasharray="4 4" label={{ value: 'Target', position: 'right' }} />
                    )}
                    {isDualLineMode ? <DualLines /> : <SingleLines />}
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Change Summary Cards */}
            <div style={{ display: 'flex', gap: 12, overflowX: 'auto', marginBottom: 24, paddingBottom: 8 }}>
              {comparisonData.map((data, i) => {
                const store = stores.find((s) => s.number === data.storeNum)
                const storeIdx = stores.findIndex((s) => s.number === data.storeNum)
                const arrow = data.isImprovement ? '▲' : '▼'
                const color = data.isImprovement ? 'var(--success-text)' : 'var(--danger-text)'
                
                return (
                  <div
                    key={data.storeNum}
                    style={{
                      minWidth: 180,
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 12,
                      padding: 16,
                      flexShrink: 0,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <div
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: storeColors[storeIdx % storeColors.length],
                        }}
                      />
                      <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>
                        {store?.name || `Store ${data.storeNum}`}
                      </div>
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-primary)', marginBottom: 4 }}>
                      {activeMetricObj.fmt(data.current)}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>
                      <span style={{ color, fontSize: 14 }}>{arrow}</span>
                      <span style={{ color }}>
                        {data.pctChange >= 0 ? '+' : ''}
                        {data.pctChange.toFixed(1)}% vs {periodMode === 'week' ? 'last week' : periodMode === 'month' ? 'last month' : 'last year'}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Bar Chart */}
            <div>
              <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 15, color: 'var(--text-primary)', marginBottom: 16 }}>
                Current vs Previous Period
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={barChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="1 3" stroke="var(--border-subtle)" />
                  <XAxis
                    dataKey="store"
                    stroke="var(--text-tertiary)"
                    tick={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", fill: 'var(--text-tertiary)' }}
                  />
                  <YAxis
                    stroke="var(--text-tertiary)"
                    tick={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", fill: 'var(--text-tertiary)' }}
                    tickFormatter={(v) => (activeMetricObj.unit === '$' ? `$${(v / 1000).toFixed(0)}k` : `${v}%`)}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload) return null
                      return (
                        <div style={{ background: 'var(--bg-overlay)', border: '1px solid var(--border-default)', borderRadius: 8, padding: '12px 16px' }}>
                          {payload.map((p: any, i: number) => (
                            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                              <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.color }} />
                              <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: "'Inter', sans-serif" }}>{p.name}:</span>
                              <span style={{ fontSize: 12, fontWeight: 600, color: p.color, fontFamily: "'JetBrains Mono', monospace" }}>
                                {activeMetricObj.fmt(p.value)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )
                    }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 12, fontFamily: "'Inter', sans-serif", color: 'var(--text-secondary)' }}
                  />
                  <Bar dataKey="current" fill={activeMetricObj.color} name="Current Period" />
                  <Bar dataKey="previous" fill={activeMetricObj.color} fillOpacity={0.5} name="Previous Period" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        ) : (
          /* Graph View - Visual Comparison */
          <div>
            {/* Side-by-Side Comparison Charts */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 20, marginBottom: 24 }}>
              {comparisonData.map((data, i) => {
                const store = stores.find((s) => s.number === data.storeNum)
                const storeIdx = stores.findIndex((s) => s.number === data.storeNum)
                const storeColor = storeColors[storeIdx % storeColors.length]
                const arrow = data.isImprovement ? '▲' : '▼'
                const changeColor = data.isImprovement ? 'var(--success-text)' : 'var(--danger-text)'
                
                // Build data for this store's comparison chart
                const storeChartData = [
                  {
                    period: 'Previous',
                    value: data.previous,
                  },
                  {
                    period: 'Current',
                    value: data.current,
                  },
                ]

                return (
                  <div
                    key={data.storeNum}
                    style={{
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 12,
                      padding: 20,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                      <div
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: '50%',
                          background: storeColor,
                        }}
                      />
                      <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 15, color: 'var(--text-primary)' }}>
                        {store?.name || `Store ${data.storeNum}`}
                      </div>
                    </div>

                    {/* Comparison Bar Chart */}
                    <div style={{ marginBottom: 16 }}>
                      <ResponsiveContainer width="100%" height={180}>
                        <BarChart data={storeChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="1 3" stroke="var(--border-subtle)" />
                          <XAxis
                            dataKey="period"
                            stroke="var(--text-tertiary)"
                            tick={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", fill: 'var(--text-tertiary)' }}
                          />
                          <YAxis
                            stroke="var(--text-tertiary)"
                            tick={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", fill: 'var(--text-tertiary)' }}
                            tickFormatter={(v) => (activeMetricObj.unit === '$' ? `$${(v / 1000).toFixed(0)}k` : `${v}%`)}
                            domain={[
                              (dataMin: number) => Math.max(0, Math.floor(dataMin * 0.9)),
                              (dataMax: number) => Math.ceil(dataMax * 1.1),
                            ]}
                          />
                          <Tooltip
                            content={({ active, payload }) => {
                              if (!active || !payload || !payload[0]) return null
                              return (
                                <div style={{ background: 'var(--bg-overlay)', border: '1px solid var(--border-default)', borderRadius: 8, padding: '12px 16px' }}>
                                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: "'Inter', sans-serif", marginBottom: 4 }}>
                                    {payload[0].payload.period}
                                  </div>
                                  <div style={{ fontSize: 13, fontWeight: 600, color: storeColor, fontFamily: "'JetBrains Mono', monospace" }}>
                                    {activeMetricObj.fmt(payload[0].value as number)}
                                  </div>
                                </div>
                              )
                            }}
                          />
                          <Bar dataKey="value" fill={storeColor} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Values and Change */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 16, borderTop: '1px solid var(--border-subtle)' }}>
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: "'Inter', sans-serif", fontWeight: 500, marginBottom: 4 }}>
                          Previous
                        </div>
                        <div style={{ fontSize: 16, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-secondary)' }}>
                          {activeMetricObj.fmt(data.previous)}
                        </div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: "'Inter', sans-serif", fontWeight: 500, marginBottom: 4 }}>
                          Change
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 16, fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>
                          <span style={{ color: changeColor, fontSize: 18 }}>{arrow}</span>
                          <span style={{ color: changeColor }}>
                            {data.pctChange >= 0 ? '+' : ''}
                            {data.pctChange.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: "'Inter', sans-serif", fontWeight: 500, marginBottom: 4 }}>
                          Current
                        </div>
                        <div style={{ fontSize: 16, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-primary)' }}>
                          {activeMetricObj.fmt(data.current)}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Trend Line Chart - All Stores Over Time */}
            <div>
              <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 15, color: 'var(--text-primary)', marginBottom: 16 }}>
                Trend Over Time
              </div>
              {cubeLoading ? (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-secondary)', fontFamily: "'Inter', sans-serif", fontSize: 13, minHeight: 240 }}>
                  Loading comparison data...
                </div>
              ) : yoyError ? (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--danger-text)', fontFamily: "'Inter', sans-serif", fontSize: 13, minHeight: 240 }}>
                  {yoyError}
                </div>
              ) : lineChartData.length < 3 && !hasCubeData && periodMode !== 'year' ? (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-secondary)', fontFamily: "'Inter', sans-serif", fontSize: 13, minHeight: 240 }}>
                  Not enough data points for this view. Upload more weekly reports to see trends.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={Math.max(240, 300)}>
                  <LineChart data={lineChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="1 3" stroke="var(--border-subtle)" />
                    <XAxis
                      dataKey="week"
                      stroke="var(--text-tertiary)"
                      tick={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", fill: 'var(--text-tertiary)' }}
                    />
                    <YAxis
                      stroke="var(--text-tertiary)"
                      tick={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", fill: 'var(--text-tertiary)' }}
                      tickFormatter={(v) => (activeMetricObj.unit === '$' ? `$${(v / 1000).toFixed(0)}k` : `${v}%`)}
                      domain={[
                        (dataMin: number) => Math.max(0, Math.floor(dataMin * 0.92)),
                        (dataMax: number) => Math.ceil(dataMax * 1.08),
                      ]}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend
                      wrapperStyle={{ fontSize: 12, fontFamily: "'Inter', sans-serif", color: 'var(--text-secondary)' }}
                      formatter={legendLabel}
                    />
                    {target !== undefined && (
                      <ReferenceLine y={target} stroke="var(--warning)" strokeDasharray="4 4" label={{ value: 'Target', position: 'right' }} />
                    )}
                    {isDualLineMode ? <DualLines /> : <SingleLines />}
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
  }
