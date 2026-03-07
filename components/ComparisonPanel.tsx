'use client'

import React, { useState, useMemo, useEffect } from 'react'
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
  Cell,
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
  /** When true, do not fetch internally; only use cubeData when provided (e.g. trends Compare tab). */
  externalDataOnly?: boolean
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

/** Return prior period date in same API format as input (daily YYYY-MM-DD, weekly YYYY-Wnn, monthly YYYY-MM, yearly YYYY). */
function getPriorPeriodDate(
  dateStr: string,
  period: 'daily' | 'weekly' | 'monthly' | 'yearly',
  offset: number
): string {
  if (period === 'daily') {
    const d = new Date(dateStr + 'T12:00:00Z')
    d.setUTCDate(d.getUTCDate() - offset)
    return d.toISOString().slice(0, 10)
  }
  if (period === 'weekly') {
    const [yStr, wStr] = dateStr.split('-W')
    let y = parseInt(yStr || '0', 10)
    let w = parseInt(wStr || '1', 10)
    w -= offset
    while (w < 1) {
      w += 52
      y -= 1
    }
    return `${y}-W${String(w).padStart(2, '0')}`
  }
  if (period === 'monthly') {
    const [yStr, mStr] = dateStr.split('-')
    let y = parseInt(yStr || '0', 10)
    let m = parseInt(mStr || '1', 10)
    m -= offset
    while (m < 1) {
      m += 12
      y -= 1
    }
    return `${y}-${String(m).padStart(2, '0')}`
  }
  if (period === 'yearly') {
    const y = parseInt(dateStr, 10) - offset
    return String(y)
  }
  return dateStr
}

/** Same period last year in same API format. */
function getSamePeriodLastYear(
  dateStr: string,
  period: 'daily' | 'weekly' | 'monthly' | 'yearly'
): string {
  if (period === 'daily') {
    const d = new Date(dateStr + 'T12:00:00Z')
    d.setUTCFullYear(d.getUTCFullYear() - 1)
    return d.toISOString().slice(0, 10)
  }
  if (period === 'weekly' || period === 'monthly') {
    const [yStr, rest] = dateStr.split('-')
    const y = parseInt(yStr || '0', 10) - 1
    return `${y}-${rest || ''}`
  }
  if (period === 'yearly') {
    return String(parseInt(dateStr, 10) - 1)
  }
  return dateStr
}

function getComparisonTabLabels(period: 'daily' | 'weekly' | 'monthly' | 'yearly'): [string, string, string] {
  switch (period) {
    case 'daily':
      return ['vs Previous Day', 'vs Previous Week', 'vs Same Day Last Year']
    case 'weekly':
      return ['vs Previous Week', 'vs Previous Month', 'vs Same Week Last Year']
    case 'monthly':
      return ['vs Previous Month', 'vs Previous Quarter', 'vs Same Month Last Year']
    case 'yearly':
      return ['vs Previous Year', 'vs 2 Years Ago', 'vs 3 Years Ago']
    default:
      return ['vs Previous Week', 'vs Previous Month', 'vs Same Period Last Year']
  }
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
  appSales?: number | null
  webSales?: number | null
  onlineSales?: number | null
  phoneSales?: number | null
  carryoutOrders?: number | null
  deliveryOrders?: number | null
  onlineOrders?: number | null
  totalOrders?: number | null
  avgTicket?: number
  carryoutPct?: number
  deliveryPct?: number
  onlinePct?: number
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
  externalDataOnly = false,
}: ComparisonPanelProps) {
  const [periodMode, setPeriodMode] = useState<PeriodMode>('week')
  const [activeComparison, setActiveComparison] = useState<0 | 1 | 2>(0)
  const [priorCubeData, setPriorCubeData] = useState<CubeStore[] | null>(null)
  const [priorLoading, setPriorLoading] = useState(false)
  const [viewMode, setViewMode] = useState<'summary' | 'graph'>('summary')
  const [cubeReports, setCubeReports] = useState<Record<string, ReportPoint[]>>({})
  const [cubeLoading, setCubeLoading] = useState(false)
  const [hasCubeData, setHasCubeData] = useState(false)
  const [yoyChartData, setYoyChartData] = useState<Array<Record<string, number | string>>>([])
  const [yoyError, setYoyError] = useState<string | null>(null)

  // Fetch cube data for year-over-year comparisons (skip when external cubeData is provided)
  useEffect(() => {
    // When parent provides already-fetched cube data, use it directly and skip internal fetch
    if (cubeData && cubeData.length > 0 && cubeDate) {
      const newReports: Record<string, ReportPoint[]> = {}
      const label = cubeDate
      selectedStores.forEach((storeNum) => {
        const store = cubeData.find((s: CubeStore) => String(s.storeNumber) === storeNum)
        if (store) {
          const netSales = store.netSales ?? 0
          const foodCostPct =
            netSales && store.foodCostUsd != null
              ? roundPct((store.foodCostUsd / netSales) * 100)
              : 0
          newReports[storeNum] = [
            {
              label,
              report_date: cubeDate,
              net_sales: netSales,
              labor_pct: roundPct(store.laborPct ?? 0),
              food_cost_pct: foodCostPct,
              flm_pct: roundPct(store.flmPct ?? 0),
              cash_short: 0,
              doordash_sales: store.dddSales ?? 0,
              ubereats_sales: store.aggregatorSales ?? 0,
            },
          ]
        } else {
          newReports[storeNum] = []
        }
      })
      setCubeReports(newReports)
      setHasCubeData(true)
      setCubeLoading(false)
      setYoyChartData([])
      setYoyError(null)
      return
    }

    // When externalDataOnly and no data passed, do not fetch; use reports fallback
    if (externalDataOnly) {
      setCubeReports({})
      setHasCubeData(false)
      setCubeLoading(false)
      setYoyChartData([])
      setYoyError(null)
      return
    }

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
  }, [periodMode, selectedStores, cubeDate, cubePeriod, activeMetric, cubeData, externalDataOnly])

  // When using external data (trends Compare), fetch prior period for comparison
  const useExternalComparison = Boolean(externalDataOnly && cubeData && cubeData.length > 0 && cubeDate)
  useEffect(() => {
    if (!useExternalComparison) {
      setPriorCubeData(null)
      return
    }
    let priorDate: string
    if (activeComparison === 0) {
      priorDate = getPriorPeriodDate(cubeDate!, cubePeriod, 1)
    } else if (activeComparison === 1) {
      const offset =
        cubePeriod === 'yearly' ? 2
        : cubePeriod === 'monthly' ? 3
        : cubePeriod === 'weekly' ? 4
        : 7
      priorDate = getPriorPeriodDate(cubeDate!, cubePeriod, offset)
    } else {
      if (cubePeriod === 'yearly') {
        priorDate = getPriorPeriodDate(cubeDate!, cubePeriod, 3)
      } else {
        priorDate = getSamePeriodLastYear(cubeDate!, cubePeriod)
      }
    }
    setPriorLoading(true)
    fetch(`/api/cube?date=${encodeURIComponent(priorDate)}&period=${encodeURIComponent(cubePeriod)}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((json) => {
        if (json?.success && Array.isArray(json.stores)) {
          setPriorCubeData(json.stores as CubeStore[])
        } else {
          setPriorCubeData(null)
        }
      })
      .catch(() => setPriorCubeData(null))
      .finally(() => setPriorLoading(false))
  }, [useExternalComparison, activeComparison, cubeDate, cubePeriod])

  // Use cube data if available, otherwise fall back to CSV reports
  const effectiveReports = useMemo(() => {
    if (hasCubeData && Object.keys(cubeReports).length > 0) {
      return cubeReports
    }
    return reports
  }, [hasCubeData, cubeReports, reports])

  const comparisonData = useMemo(() => {
    if (!activeMetric) return []
    if (useExternalComparison && cubeData && cubeData.length > 0) {
      const lowerIsBetter = ['labor_pct', 'food_cost_pct', 'flm_pct'].includes(activeMetric)
      return selectedStores.map((storeNum) => {
        const currentStore = cubeData.find((s: CubeStore) => String(s.storeNumber) === storeNum)
        const priorStore = priorCubeData?.find((s: CubeStore) => String(s.storeNumber) === storeNum)
        const currentVal = currentStore ? getMetricValue(currentStore, activeMetric) : 0
        const priorVal = priorStore ? getMetricValue(priorStore, activeMetric) : 0
        const pctChange =
          priorVal > 0 ? ((currentVal - priorVal) / priorVal) * 100 : null
        const isImprovement =
          pctChange == null ? false
          : lowerIsBetter ? pctChange < 0
          : pctChange > 0
        return {
          storeNum,
          current: currentVal,
          previous: priorVal,
          pctChange: pctChange ?? 0,
          pctChangeNull: pctChange == null,
          isImprovement,
        }
      })
    }
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
  }, [effectiveReports, selectedStores, activeMetric, periodMode, hasCubeData, cubeReports, useExternalComparison, cubeData, priorCubeData])

  // Build chart data for line chart (last 5 data points)
  const lineChartData = useMemo(() => {
    if (useExternalComparison && cubeData && cubeData.length > 0 && activeMetric) {
      const currentPoint: Record<string, number | string> = { week: 'Current' }
      const priorPoint: Record<string, number | string> = { week: 'Prior' }
      selectedStores.forEach((storeNum) => {
        const curStore = cubeData.find((s: CubeStore) => String(s.storeNumber) === storeNum)
        const prevStore = priorCubeData?.find((s: CubeStore) => String(s.storeNumber) === storeNum)
        const curVal = curStore ? getMetricValue(curStore, activeMetric) : 0
        const prevVal = prevStore ? getMetricValue(prevStore, activeMetric) : 0
        currentPoint[`${storeNum}_current`] = curVal
        currentPoint[`${storeNum}_previous`] = 0
        priorPoint[`${storeNum}_current`] = 0
        priorPoint[`${storeNum}_previous`] = prevVal
      })
      return [currentPoint, priorPoint]
    }
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
  }, [effectiveReports, selectedStores, activeMetric, periodMode, cubePeriod, yoyChartData, useExternalComparison, cubeData, priorCubeData])

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

  // Graph View: one row per store with storeId_current and storeId_prior for side-by-side bars
  const storeBarData = useMemo(() => {
    if (!activeMetric) return []
    if (useExternalComparison && cubeData) {
      return selectedStores.map((storeId) => {
        const currentStore = cubeData.find((s: CubeStore) => String(s.storeNumber) === storeId)
        const priorStore = priorCubeData?.find((s: CubeStore) => String(s.storeNumber) === storeId)
        const currentVal = currentStore ? getMetricValue(currentStore, activeMetric) : 0
        const priorVal = priorStore ? getMetricValue(priorStore, activeMetric) : 0
        const row: Record<string, string | number> = { store: `Store ${storeId}` }
        selectedStores.forEach((sid) => {
          row[`${sid}_current`] = sid === storeId ? currentVal : 0
          row[`${sid}_prior`] = sid === storeId ? priorVal : 0
        })
        return row
      })
    }
    return comparisonData.map((data) => {
      const row: Record<string, string | number> = { store: `Store ${data.storeNum}` }
      comparisonData.forEach((d) => {
        row[`${d.storeNum}_current`] = d.storeNum === data.storeNum ? data.current : 0
        row[`${d.storeNum}_prior`] = d.storeNum === data.storeNum ? data.previous : 0
      })
      return row
    })
  }, [selectedStores, activeMetric, cubeData, priorCubeData, useExternalComparison, comparisonData])

  // Grouped bar chart: one entry per store { name, current, prior } for Current/Prior bars per store
  const groupedChartData = useMemo(() => {
    if (!activeMetric) return []
    if (useExternalComparison && cubeData) {
      return selectedStores.map((storeId) => {
        const currentStore = cubeData.find((s: CubeStore) => String(s.storeNumber) === storeId)
        const priorStore = priorCubeData?.find((s: CubeStore) => String(s.storeNumber) === storeId)
        return {
          name: storeId,
          current: currentStore ? getMetricValue(currentStore, activeMetric) : 0,
          prior: priorStore ? getMetricValue(priorStore, activeMetric) : 0,
        }
      })
    }
    return comparisonData.map((d) => ({
      name: d.storeNum,
      current: d.current,
      prior: d.previous,
    }))
  }, [selectedStores, activeMetric, cubeData, priorCubeData, useExternalComparison, comparisonData])

  const storeColorByKey = useMemo(() => {
    const m: Record<string, string> = {}
    selectedStores.forEach((storeId) => {
      const idx = stores.findIndex((s) => s.number === storeId)
      m[storeId] = storeColors[idx % storeColors.length] ?? 'var(--text-tertiary)'
    })
    return m
  }, [selectedStores, stores, storeColors])

  const isPercentMetric = activeMetricObj?.unit === '%'

  const comparisonTabLabels = useMemo(() => getComparisonTabLabels(cubePeriod), [cubePeriod])

  const isDualLineMode =
    useExternalComparison ||
    periodMode === 'week' ||
    periodMode === 'month' ||
    (periodMode === 'year' && cubePeriod === 'monthly')

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

  const legendLabel = (val: string) => {
    if (useExternalComparison) {
      if (val.endsWith('_current')) return `Store ${val.replace('_current', '')} — Current`
      if (val.endsWith('_previous')) return `Store ${val.replace('_previous', '')} — Prior`
    }
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

  const CustomBarLabel = (props: { x?: number; y?: number; width?: number; value?: number; isPercent?: boolean }) => {
    const { x = 0, y = 0, width = 0, value, isPercent } = props
    if (value == null) return null
    const text = isPercent ? `${Number(value).toFixed(1)}%` : `$${(Number(value) / 1000).toFixed(0)}k`
    return (
      <text x={x + width / 2} y={y - 4} fill="rgba(255,255,255,0.5)" textAnchor="middle" fontSize={9} fontFamily="'JetBrains Mono', monospace">
        {text}
      </text>
    )
  }

  const GroupedBarTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; payload: { name: string; current: number; prior: number } }>; label?: string }) => {
    if (!active || !payload?.length || !label) return null
    const row = payload[0]?.payload as { name: string; current: number; prior: number }
    if (!row) return null
    return (
      <div style={{ background: '#1a1d27', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '12px 16px', fontFamily: "'Inter', sans-serif" }}>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.9)', marginBottom: 8 }}>Store {label}</div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>Current: {isPercentMetric ? `${row.current.toFixed(1)}%` : `$${Number(row.current).toLocaleString()}`}</div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>Prior: {isPercentMetric ? `${row.prior.toFixed(1)}%` : `$${Number(row.prior).toLocaleString()}`}</div>
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
            {selectedStores.length} store{selectedStores.length !== 1 ? 's' : ''} · {useExternalComparison ? comparisonTabLabels[activeComparison] : periodMode === 'week' ? 'vs Previous Week' : periodMode === 'month' ? 'vs Previous Month' : 'vs Same Period Last Year'}
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
            {useExternalComparison
              ? comparisonTabLabels.map((label, idx) => (
                  <button
                    key={label}
                    onClick={() => setActiveComparison(idx as 0 | 1 | 2)}
                    style={{
                      padding: '6px 16px',
                      borderRadius: 8,
                      border: 'none',
                      cursor: 'pointer',
                      fontFamily: "'Inter', sans-serif",
                      fontSize: 13,
                      fontWeight: 600,
                      letterSpacing: '0.04em',
                      background: activeComparison === idx ? 'var(--bg-elevated)' : 'transparent',
                      color: activeComparison === idx ? 'var(--text-primary)' : 'var(--text-tertiary)',
                      transition: 'all 0.2s',
                    }}
                  >
                    {label}
                  </button>
                ))
              : ([
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
            {/* Chart: when loaded data (useExternalComparison) use bar chart; else line chart */}
            <div style={{ marginBottom: 24 }}>
              {(cubeLoading || (useExternalComparison && priorLoading)) ? (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-secondary)', fontFamily: "'Inter', sans-serif", fontSize: 13, minHeight: 240 }}>
                  Loading comparison data...
                </div>
              ) : yoyError ? (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--danger-text)', fontFamily: "'Inter', sans-serif", fontSize: 13, minHeight: 240 }}>
                  {yoyError}
                </div>
              ) : useExternalComparison && (!groupedChartData.length || !cubeData?.length) ? (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-secondary)', fontFamily: "'Inter', sans-serif", fontSize: 13, minHeight: 240 }}>
                  Load data to compare.
                </div>
              ) : useExternalComparison && groupedChartData.length > 0 ? (
                <>
                  <div style={{ display: 'flex', gap: 16, marginBottom: 12, fontSize: 11, fontFamily: "'Inter', sans-serif", color: 'var(--text-tertiary)' }}>
                    <span style={{ display: 'flex', alignItems: 'center' }}>
                      <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: 'var(--brand)', marginRight: 5 }} />
                      Current Period
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center' }}>
                      <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: 'rgba(255,255,255,0.2)', marginRight: 5 }} />
                      Prior Period
                    </span>
                  </div>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={groupedChartData} margin={{ top: 24, right: 16, bottom: 8, left: 8 }} barCategoryGap="30%" barGap={3}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={true} vertical={false} />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.35)', fontFamily: "'JetBrains Mono', monospace" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.3)', fontFamily: "'JetBrains Mono', monospace" }}
                        tickFormatter={(v) => (isPercentMetric ? `${v}%` : `$${(v / 1000).toFixed(0)}k`)}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip content={<GroupedBarTooltip />} />
                      <Bar dataKey="current" name="Current" radius={[3, 3, 0, 0]} label={((props: Record<string, unknown>) => <CustomBarLabel {...(props as { x?: number; y?: number; width?: number; value?: number }) } isPercent={isPercentMetric} />) as any}>
                        {groupedChartData.map((entry, i) => (
                          <Cell key={i} fill={storeColorByKey[entry.name] ?? 'var(--brand)'} />
                        ))}
                      </Bar>
                      <Bar dataKey="prior" name="Prior" radius={[3, 3, 0, 0]} label={((props: Record<string, unknown>) => <CustomBarLabel {...(props as { x?: number; y?: number; width?: number; value?: number }) } isPercent={isPercentMetric} />) as any}>
                        {groupedChartData.map((entry, i) => (
                          <Cell key={i} fill={storeColorByKey[entry.name] ?? 'var(--brand)'} fillOpacity={0.4} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </>
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

            {/* Change Summary Cards — 3x2 grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
              {comparisonData.map((data) => {
                const store = stores.find((s) => s.number === data.storeNum)
                const storeIdx = stores.findIndex((s) => s.number === data.storeNum)
                const noComparison = (data as { pctChangeNull?: boolean }).pctChangeNull
                const lowerIsBetter = activeMetric ? ['labor_pct', 'food_cost_pct', 'flm_pct'].includes(activeMetric) : false
                const arrow = noComparison ? '' : data.isImprovement ? (lowerIsBetter ? '▼' : '▲') : (lowerIsBetter ? '▲' : '▼')
                const pillColor = noComparison ? 'var(--text-tertiary)' : data.isImprovement ? 'var(--success-text)' : 'var(--danger-text)'
                const vsLabel = useExternalComparison ? comparisonTabLabels[activeComparison].replace('vs ', '') : periodMode === 'week' ? 'last week' : periodMode === 'month' ? 'last month' : 'last year'
                return (
                  <div
                    key={data.storeNum}
                    style={{
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 10,
                      padding: 16,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
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
                    <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-primary)', marginBottom: 8 }}>
                      {activeMetricObj.fmt(data.current)}
                    </div>
                    {noComparison ? (
                      <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>—</span>
                    ) : (
                      <>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '4px 10px',
                            borderRadius: 999,
                            fontSize: 11,
                            fontWeight: 600,
                            fontFamily: "'JetBrains Mono', monospace",
                            background: pillColor,
                            color: '#fff',
                            marginBottom: 4,
                          }}
                        >
                          {arrow} {data.pctChange >= 0 ? '+' : ''}{data.pctChange.toFixed(1)}%
                        </span>
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
                          vs {vsLabel}
                        </div>
                      </>
                    )}
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
          /* Graph View — Grouped bar chart by store */
          <div>
            <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 15, color: 'var(--text-primary)', marginBottom: 16 }}>
              Current vs Prior by Store
            </div>
            {(cubeLoading || (useExternalComparison && priorLoading)) ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-secondary)', fontFamily: "'Inter', sans-serif", fontSize: 13, minHeight: 260 }}>
                Loading comparison data...
              </div>
            ) : useExternalComparison && (!groupedChartData.length || !cubeData?.length) ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-secondary)', fontFamily: "'Inter', sans-serif", fontSize: 13, minHeight: 260 }}>
                Load data to compare.
              </div>
            ) : groupedChartData.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-secondary)', fontFamily: "'Inter', sans-serif", fontSize: 13, minHeight: 260 }}>
                No data available.
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', gap: 16, marginBottom: 12, fontSize: 11, fontFamily: "'Inter', sans-serif", color: 'var(--text-tertiary)' }}>
                  <span style={{ display: 'flex', alignItems: 'center' }}>
                    <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: 'var(--brand)', marginRight: 5 }} />
                    Current Period
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center' }}>
                    <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: 'rgba(255,255,255,0.2)', marginRight: 5 }} />
                    Prior Period
                  </span>
                </div>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={groupedChartData} margin={{ top: 24, right: 16, bottom: 8, left: 8 }} barCategoryGap="30%" barGap={3}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={true} vertical={false} />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.35)', fontFamily: "'JetBrains Mono', monospace" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.3)', fontFamily: "'JetBrains Mono', monospace" }}
                      tickFormatter={(v) => (isPercentMetric ? `${v}%` : `$${(v / 1000).toFixed(0)}k`)}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip content={<GroupedBarTooltip />} />
                    <Bar dataKey="current" name="Current" radius={[3, 3, 0, 0]} label={((props: Record<string, unknown>) => <CustomBarLabel {...(props as { x?: number; y?: number; width?: number; value?: number }) } isPercent={isPercentMetric} />) as any}>
                      {groupedChartData.map((entry, i) => (
                        <Cell key={i} fill={storeColorByKey[entry.name] ?? 'var(--brand)'} />
                      ))}
                    </Bar>
                    <Bar dataKey="prior" name="Prior" radius={[3, 3, 0, 0]} label={((props: Record<string, unknown>) => <CustomBarLabel {...(props as { x?: number; y?: number; width?: number; value?: number }) } isPercent={isPercentMetric} />) as any}>
                      {groupedChartData.map((entry, i) => (
                        <Cell key={i} fill={storeColorByKey[entry.name] ?? 'var(--brand)'} fillOpacity={0.4} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
  }
