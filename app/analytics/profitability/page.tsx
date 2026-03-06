'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  IDEAL_FOOD_COST_P3_2026,
  IDEAL_SIZE_OPTIONS,
  IDEAL_CUSTOM_TOPPING_NAMES,
  IDEAL_SPECIALTY_NAMES,
  type IdealSizeKey,
} from '@/lib/idealFoodCost'

type AggregatorResult = {
  menuPrice: number
  promoDiscount: number
  customerPays: number
  commissionDollar: number
  digitalFeeDollar: number
  netRevenue: number
  foodCostDollar: number
  marginDollar: number
  marginPct: number
  carryoutMarginDollar: number
  vsCarryoutMarginDiff: number
}

type CompetitorRow = {
  id: string
  brand: string
  channel: string
  specialOffer: string
  price: string
  customerPays: string
  minCart: string
  ourPosition: string
}

type CubeStoreRowLite = {
  storeNumber: string
  netSales: number | null
  grossSales: number
  foodCostUsd: number | null
  totalOrders: number | null
  avgTicket: number
  avgDiscount: number
  aggregatorSales?: number | null
  lyAggregatorSales?: number | null
  aggregatorOrders?: number | null
}

type StoreGridData = {
  menuPrice: number
  foodCostPct: number
  aggregatorSales: number
  lyAggregatorSales: number
  aggregatorOrders: number
}

type StoreAutoMetrics = {
  menuPrice: number
  foodCostPct: number
  platformDiscount: number
}

function toNumber(value: string | number): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  const n = parseFloat(value.replace(/[^\d.-]/g, ''))
  return Number.isFinite(n) ? n : 0
}

function formatCurrency(value: number): string {
  if (!Number.isFinite(value)) return '$0'
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  })
}

function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return '0%'
  return `${value.toFixed(1)}%`
}

const STORE_GRID_IDS = ['2081', '2021', '2259', '2292', '2481', '3011'] as const
const STORE_NAMES: Record<string, string> = {
  '2081': 'Westhills',
  '2021': 'Tapo',
  '2259': 'Northridge',
  '2292': 'Canoga',
  '2481': 'Madera',
  '3011': 'Chattsworth',
}
const STORE_TIER: Record<string, 'T1' | 'T2' | 'T3'> = {
  '2021': 'T1',
  '2481': 'T1',
  '2081': 'T2',
  '2292': 'T2',
  '2259': 'T2',
  '3011': 'T3',
}

function calcAggregatorResult(params: {
  menuPrice: number
  commissionPct: number
  digitalFeePct: number
  promoDiscount: number
  foodCostPct: number
}): AggregatorResult {
  const menuPrice = Math.max(0, params.menuPrice)
  const promoDiscount = Math.min(Math.max(0, params.promoDiscount), menuPrice)
  const commissionPct = Math.max(0, params.commissionPct)
  const digitalFeePct = Math.max(0, params.digitalFeePct)
  const foodCostPct = Math.max(0, params.foodCostPct)

  const customerPays = menuPrice - promoDiscount
  const commissionDollar = menuPrice * (commissionPct / 100)
  const digitalFeeDollar = menuPrice * (digitalFeePct / 100)
  const netRevenue = menuPrice - commissionDollar - digitalFeeDollar
  const foodCostDollar = menuPrice * (foodCostPct / 100)
  const marginDollar = netRevenue - foodCostDollar
  const marginPct = menuPrice > 0 ? (marginDollar / menuPrice) * 100 : 0

  const carryoutMarginDollar = menuPrice - foodCostDollar
  const vsCarryoutMarginDiff = carryoutMarginDollar - marginDollar

  return {
    menuPrice,
    promoDiscount,
    customerPays,
    commissionDollar,
    digitalFeeDollar,
    netRevenue,
    foodCostDollar,
    marginDollar,
    marginPct,
    carryoutMarginDollar,
    vsCarryoutMarginDiff,
  }
}

/** Position badge by customer total (before tip): Under $18 Aggressive, $18–$24 Competitive, Over $24 Premium */
function getPositionBadgeByCustomerTotal(customerTotal: number | null): {
  label: 'Aggressive' | 'Competitive' | 'Premium'
  colorClass: string
} | null {
  if (customerTotal == null || !Number.isFinite(customerTotal)) return null
  if (customerTotal < 18)
    return { label: 'Aggressive', colorClass: 'bg-rose-500/20 text-rose-300 border-rose-500/40' }
  if (customerTotal <= 24)
    return { label: 'Competitive', colorClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40' }
  return { label: 'Premium', colorClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' }
}

type PromoType = 'BOGO' | '% Off' | '$ Off' | 'Free Item'

type PromoSimResult = {
  menuPrice: number
  minCart: number
  effectiveOrderValue: number
  promoDiscountApplied: number
  customerPays: number
  commissionDollar: number
  digitalFeeDollar: number
  netRevenue: number
  foodCostDollar: number
  marginDollar: number
  marginPct: number
  marginNoPromo: number
  vsNoPromo: number
  carryoutMargin: number
  vsCarryoutGap: number
}

function calcPromoSimulator(params: {
  menuPrice: number
  minCart: number
  promoType: PromoType
  discountValue: number
  maxDiscountCap: number
  ddCommissionPct: number
  digitalFeePct: number
  foodCostPct: number
}): PromoSimResult {
  const menuPrice = Math.max(0, params.menuPrice)
  const minCart = Math.max(0, params.minCart)
  const effectiveOrderValue = Math.max(menuPrice, minCart)
  const cap = Math.max(0, params.maxDiscountCap)
  const commissionPct = Math.max(0, params.ddCommissionPct)
  const digitalFeePct = Math.max(0, params.digitalFeePct)
  const foodCostPct = Math.max(0, params.foodCostPct)

  let rawDiscount = 0
  if (params.promoType === 'BOGO') {
    rawDiscount = effectiveOrderValue * 0.5
  } else if (params.promoType === '% Off') {
    rawDiscount =
      effectiveOrderValue * (Math.max(0, Math.min(100, params.discountValue)) / 100)
  } else {
    rawDiscount = Math.max(0, params.discountValue)
  }
  const capped = cap > 0 ? Math.min(rawDiscount, cap) : rawDiscount
  const promoDiscountApplied = Math.min(effectiveOrderValue, Math.max(0, capped))

  const customerPays = effectiveOrderValue - promoDiscountApplied
  const commissionDollar = effectiveOrderValue * (commissionPct / 100)
  const digitalFeeDollar = effectiveOrderValue * (digitalFeePct / 100)
  // Store absorbs the promo discount (not DoorDash). Net = order value minus commission, fee, and discount.
  const netRevenue =
    effectiveOrderValue - commissionDollar - digitalFeeDollar - promoDiscountApplied
  const foodCostDollar = effectiveOrderValue * (foodCostPct / 100)
  const marginDollar = netRevenue - foodCostDollar
  const marginPct = effectiveOrderValue > 0 ? (marginDollar / effectiveOrderValue) * 100 : 0

  const noPromoNetRevenue = effectiveOrderValue - commissionDollar - digitalFeeDollar
  const marginNoPromo = noPromoNetRevenue - foodCostDollar
  // Always treated as a cost (negative): promo vs no-promo
  const vsNoPromo = marginDollar - marginNoPromo

  const carryoutMargin = effectiveOrderValue - foodCostDollar
  const vsCarryoutGap = carryoutMargin - marginDollar

  return {
    menuPrice,
    minCart,
    effectiveOrderValue,
    promoDiscountApplied,
    customerPays,
    commissionDollar,
    digitalFeeDollar,
    netRevenue,
    foodCostDollar,
    marginDollar,
    marginPct,
    marginNoPromo,
    vsNoPromo,
    carryoutMargin,
    vsCarryoutGap,
  }
}

function getMarginVerdict(marginPct: number): { label: 'Profitable' | 'Break Even' | 'Losing'; tone: 'good' | 'neutral' | 'bad' } {
  if (marginPct > 0.5) return { label: 'Profitable', tone: 'good' }
  if (marginPct < -0.5) return { label: 'Losing', tone: 'bad' }
  return { label: 'Break Even', tone: 'neutral' }
}

function MarginVerdictBadge({ marginPct }: { marginPct: number }) {
  const verdict = getMarginVerdict(marginPct)
  const toneClass =
    verdict.tone === 'good'
      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
      : verdict.tone === 'bad'
        ? 'border-rose-500/40 bg-rose-500/10 text-rose-300'
        : 'border-amber-500/40 bg-amber-500/10 text-amber-300'

  return (
    <div
      className={`mt-3 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-semibold ${toneClass}`}
      style={verdict.tone === 'good' ? { boxShadow: '0 0 8px rgba(34,197,94,0.3)' } : undefined}
    >
      <span>{verdict.label}</span>
      <span className="font-mono opacity-80">{formatPercent(marginPct)}</span>
    </div>
  )
}

export default function ProfitabilityAnalyticsPage() {
  // ── Tool 1 — Aggregator Profitability Calculator ──────────────────────────────
  const [menuPrice, setMenuPrice] = useState(29)
  const [ddCommission, setDdCommission] = useState(27)
  const [ueCommission, setUeCommission] = useState(27)
  const [digitalFeePct, setDigitalFeePct] = useState(1.5)
  const [promoDiscount, setPromoDiscount] = useState(0)
  const [foodCostPct, setFoodCostPct] = useState(28)
  const [carryoutSpecialPrice, setCarryoutSpecialPrice] = useState(10.99)

  const [selectedStore, setSelectedStore] = useState<'all' | '2081' | '2021' | '2259' | '2292' | '2481' | '3011'>('all')
  const [autoMetricsByStore, setAutoMetricsByStore] = useState<Record<string, StoreAutoMetrics>>({})
  const [cubeStoreGridData, setCubeStoreGridData] = useState<Record<string, StoreGridData>>({})
  const [autoMetricsLoading, setAutoMetricsLoading] = useState(false)
  const [autoMetricsError, setAutoMetricsError] = useState<string | null>(null)

  // Persist commission assumptions in localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const dd = window.localStorage.getItem('pj_analytics_dd_commission')
      const ue = window.localStorage.getItem('pj_analytics_ue_commission')
      if (dd != null && !Number.isNaN(Number(dd))) {
        setDdCommission(Number(dd))
      }
      if (ue != null && !Number.isNaN(Number(ue))) {
        setUeCommission(Number(ue))
      }
    } catch {
      // ignore localStorage failures
    }
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem('pj_analytics_dd_commission', String(ddCommission))
      window.localStorage.setItem('pj_analytics_ue_commission', String(ueCommission))
    } catch {
      // ignore
    }
  }, [ddCommission, ueCommission])

  // Load latest cube data to drive live auto-populated fields
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setAutoMetricsLoading(true)
      setAutoMetricsError(null)
      try {
        const res = await fetch('/api/cube?period=daily', { cache: 'no-store' })
        const json = await res.json()
        if (!res.ok || !json?.success || !Array.isArray(json.stores)) {
          throw new Error(json?.message || 'Failed to load cube data')
        }
        const rows: CubeStoreRowLite[] = json.stores
        if (cancelled) return

        const metrics: Record<string, StoreAutoMetrics> = {}
        const gridData: Record<string, StoreGridData> = {}

        // Per-store metrics
        for (const row of rows) {
          const net = row.netSales ?? 0
          const foodUsd = row.foodCostUsd ?? 0
          const foodPct = net > 0 && foodUsd > 0 ? (foodUsd / net) * 100 : 0
          metrics[row.storeNumber] = {
            menuPrice: row.avgTicket ?? 0,
            foodCostPct: foodPct,
            platformDiscount: row.avgDiscount ?? 0,
          }
          const aggSales = Number(row.aggregatorSales) || 0
          const lyAggSales = Number(row.lyAggregatorSales) || 0
          const aggOrders = Number(row.aggregatorOrders) || 0
          gridData[row.storeNumber] = {
            menuPrice: row.avgTicket ?? 0,
            foodCostPct: foodPct,
            aggregatorSales: aggSales,
            lyAggregatorSales: lyAggSales,
            aggregatorOrders: aggOrders,
          }
        }

        // Group (all stores) metrics — weighted by orders where available
        if (rows.length > 0) {
          let totalNet = 0
          let totalFoodUsd = 0
          let totalOrders = 0
          let totalGross = 0
          for (const r of rows) {
            const net = r.netSales ?? 0
            const ord = r.totalOrders ?? 0
            const foodUsd = r.foodCostUsd ?? 0
            const gross = r.grossSales ?? 0
            totalNet += net
            totalFoodUsd += foodUsd
            totalOrders += ord
            totalGross += gross
          }
          const groupMenuPrice =
            totalOrders > 0 ? totalNet / totalOrders : rows.reduce((s, r) => s + (r.avgTicket ?? 0), 0) / rows.length
          const groupFoodPct = totalNet > 0 && totalFoodUsd > 0 ? (totalFoodUsd / totalNet) * 100 : 0
          const groupDiscount =
            totalOrders > 0 ? (totalGross - totalNet) / totalOrders : rows.reduce((s, r) => s + (r.avgDiscount ?? 0), 0) / rows.length

          metrics['all'] = {
            menuPrice: groupMenuPrice,
            foodCostPct: groupFoodPct,
            platformDiscount: groupDiscount,
          }
        }

        setAutoMetricsByStore(metrics)
        setCubeStoreGridData(gridData)
      } catch (e: any) {
        if (!cancelled) {
          setAutoMetricsError(e?.message || 'Failed to load cube data')
        }
      } finally {
        if (!cancelled) {
          setAutoMetricsLoading(false)
        }
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  // When store selection or metrics change, auto-populate the calculator inputs
  useEffect(() => {
    const key = selectedStore === 'all' ? 'all' : selectedStore
    const m = autoMetricsByStore[key]
    if (!m) return
    setMenuPrice(Number.isFinite(m.menuPrice) ? Math.round(m.menuPrice * 100) / 100 : menuPrice)
    setFoodCostPct(Number.isFinite(m.foodCostPct) ? Math.round(m.foodCostPct * 10) / 10 : foodCostPct)
    setPromoDiscount(Number.isFinite(m.platformDiscount) ? Math.round(m.platformDiscount * 100) / 100 : promoDiscount)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStore, autoMetricsByStore])

  const ddResult = useMemo(
    () =>
      calcAggregatorResult({
        menuPrice,
        commissionPct: ddCommission,
        digitalFeePct,
        promoDiscount,
        foodCostPct,
      }),
    [menuPrice, ddCommission, digitalFeePct, promoDiscount, foodCostPct]
  )

  const ueResult = useMemo(
    () =>
      calcAggregatorResult({
        menuPrice,
        commissionPct: ueCommission,
        digitalFeePct,
        promoDiscount,
        foodCostPct,
      }),
    [menuPrice, ueCommission, digitalFeePct, promoDiscount, foodCostPct]
  )

  // ── Tool 3 — Ideal Food Cost Calculator ─────────────────────────────────────
  const [idealPizzaType, setIdealPizzaType] = useState<string>('Custom Pizza')
  const [idealSize, setIdealSize] = useState<IdealSizeKey>('12"')
  const [idealToppings, setIdealToppings] = useState<Set<string>>(new Set())
  const [idealMenuPrice, setIdealMenuPrice] = useState<string>('')
  const [idealStore, setIdealStore] = useState<string>('')
  const [idealCubeFoodPct, setIdealCubeFoodPct] = useState<number | null>(null)
  const [idealCubeLoading, setIdealCubeLoading] = useState(false)
  useEffect(() => {
    if (!idealStore) {
      setIdealCubeFoodPct(null)
      return
    }
    let cancelled = false
    setIdealCubeLoading(true)
    const now = new Date()
    const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    fetch(`/api/cube?date=${encodeURIComponent(date)}&period=monthly`, { cache: 'no-store', credentials: 'include' })
      .then((r) => r.json())
      .then((json) => {
        if (cancelled || !json?.success || !Array.isArray(json.stores)) return
        const store = (json.stores as Array<{ storeNumber: string; actualFoodPct?: number | null; netSales?: number | null; foodCostUsd?: number | null }>).find(
          (s) => String(s.storeNumber) === idealStore
        )
        if (store?.actualFoodPct != null && !Number.isNaN(store.actualFoodPct)) {
          setIdealCubeFoodPct(store.actualFoodPct)
        } else if (store && (store.netSales ?? 0) > 0 && (store.foodCostUsd ?? 0) >= 0) {
          setIdealCubeFoodPct(((store.foodCostUsd ?? 0) / (store.netSales ?? 1)) * 100)
        } else {
          setIdealCubeFoodPct(null)
        }
      })
      .catch(() => { if (!cancelled) setIdealCubeFoodPct(null) })
      .finally(() => { if (!cancelled) setIdealCubeLoading(false) })
    return () => { cancelled = true }
  }, [idealStore])

  const idealCostResult = useMemo(() => {
    const data = IDEAL_FOOD_COST_P3_2026
    const baseCost = (data.baseCosts as Record<string, number>)[idealSize] ?? 0
    const toppingLines: { name: string; cost: number }[] = []

    if (idealPizzaType === 'Custom Pizza') {
      let toppingCost = 0
      const costs = data.toppingCosts as Record<string, Record<string, number>>
      for (const name of Array.from(idealToppings)) {
        const costBySize = costs[name]
        if (costBySize) {
          const cost = costBySize[idealSize] ?? 0
          toppingCost += cost
          toppingLines.push({ name, cost })
        }
      }
      const totalCost = baseCost + toppingCost
      const menuPrice = toNumber(idealMenuPrice) || 0
      const idealPct = menuPrice > 0 ? (totalCost / menuPrice) * 100 : 0
      return { baseCost, toppingCost, totalCost, idealPct, toppingLines }
    }

    const specialtyTotals = data.specialtyPizzas as Record<string, Record<string, number>>
    const totalCost = specialtyTotals[idealPizzaType]?.[idealSize] ?? 0
    const menuPrice = toNumber(idealMenuPrice) || 0
    const idealPct = menuPrice > 0 ? (totalCost / menuPrice) * 100 : 0
    return { baseCost, toppingCost: totalCost - baseCost, totalCost, idealPct, toppingLines }
  }, [idealSize, idealPizzaType, idealToppings, idealMenuPrice])

  const toggleIdealTopping = useCallback((name: string) => {
    setIdealToppings((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }, [])

  // ── Tool 2 — Promo Simulator (linked to Tool 1: menu price, DD commission %, food cost %, digital fee) ──
  const [promoType, setPromoType] = useState<PromoType>('BOGO')
  const [promoDiscountValue, setPromoDiscountValue] = useState(50)
  const [promoMinCart, setPromoMinCart] = useState(0)
  const [promoMaxCap, setPromoMaxCap] = useState(0)
  const [promoEstOrders, setPromoEstOrders] = useState(500)

  const promoResult = useMemo(
    () =>
      calcPromoSimulator({
        menuPrice,
        minCart: promoMinCart,
        promoType,
        discountValue: promoDiscountValue,
        maxDiscountCap: promoMaxCap,
        ddCommissionPct: ddCommission,
        digitalFeePct,
        foodCostPct,
      }),
    [
      menuPrice,
      promoMinCart,
      promoType,
      promoDiscountValue,
      promoMaxCap,
      ddCommission,
      digitalFeePct,
      foodCostPct,
    ]
  )

  const promoMonthlyTotalRevenue = useMemo(
    () => promoResult.customerPays * promoEstOrders,
    [promoResult.customerPays, promoEstOrders]
  )
  const promoMonthlyTotalMargin = useMemo(
    () => promoResult.marginDollar * promoEstOrders,
    [promoResult.marginDollar, promoEstOrders]
  )
  const promoMonthlyVsNoPromo = useMemo(
    () => promoResult.vsNoPromo * promoEstOrders,
    [promoResult.vsNoPromo, promoEstOrders]
  )
  const promoBreakEvenOrders = useMemo(() => {
    if (promoResult.marginDollar <= 0) return null
    if (promoResult.vsNoPromo < 0) {
      const vsNoPromoMonthly = promoResult.vsNoPromo * promoEstOrders
      return Math.ceil(Math.abs(vsNoPromoMonthly) / promoResult.marginDollar)
    }
    return 0
  }, [promoResult.marginDollar, promoResult.vsNoPromo, promoEstOrders])

  const promoMarginVerdict = useMemo(() => {
    const pct = promoResult.marginPct
    if (pct > 40) return { label: 'Strong', colorClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' }
    if (pct >= 25) return { label: 'Acceptable', colorClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40' }
    return { label: 'Danger', colorClass: 'bg-rose-500/20 text-rose-300 border-rose-500/40' }
  }, [promoResult.marginPct])

  const promoMonthlyVerdict = useMemo(() => {
    const pct = promoResult.marginPct
    const monthly = promoMonthlyTotalMargin
    if (pct > 35 && monthly > 5000) return { label: 'Worth It', colorClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' }
    if ((pct >= 25 && pct <= 35) || (monthly >= 2000 && monthly <= 5000)) return { label: 'Monitor', colorClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40' }
    return { label: 'Avoid', colorClass: 'bg-rose-500/20 text-rose-300 border-rose-500/40' }
  }, [promoResult.marginPct, promoMonthlyTotalMargin])

  const currentPromoPresetName = useMemo(() => {
    // Grouped scenarios (Tool 2)
    if (
      promoType === 'BOGO' &&
      promoDiscountValue === 50 &&
      promoMinCart === 40 &&
      promoMaxCap === 0 &&
      ddCommission === 0 &&
      digitalFeePct === 0 &&
      Math.abs(foodCostPct - 26.8) < 0.01 &&
      promoEstOrders === 400 &&
      menuPrice === 29
    )
      return 'PJ App BOGO $40 min'
    if (
      promoType === '$ Off' &&
      promoDiscountValue === 5 &&
      promoMinCart === 35 &&
      promoMaxCap === 5 &&
      ddCommission === 27 &&
      Math.abs(foodCostPct - 26.8) < 0.01 &&
      promoEstOrders === 400 &&
      menuPrice === 29
    )
      return 'DD $5 off $35+ weekday'
    if (
      promoType === '$ Off' &&
      promoDiscountValue === 12 &&
      promoMinCart === 33 &&
      promoMaxCap === 12 &&
      ddCommission === 27 &&
      Math.abs(foodCostPct - 26.8) < 0.01 &&
      promoEstOrders === 550 &&
      menuPrice === 29
    )
      return 'Cap Discount $12 / $33 min'
    if (
      promoType === '$ Off' &&
      promoDiscountValue === 5 &&
      promoMinCart === 36 &&
      promoMaxCap === 5 &&
      ddCommission === 27 &&
      Math.abs(foodCostPct - 26.8) < 0.01 &&
      promoEstOrders === 550 &&
      menuPrice === 29
    )
      return 'Rotating $5 off $36+'
    if (
      promoType === 'BOGO' &&
      promoDiscountValue === 50 &&
      promoMinCart === 55 &&
      promoMaxCap === 0 &&
      ddCommission === 27 &&
      Math.abs(foodCostPct - 26.8) < 0.01 &&
      promoEstOrders === 700 &&
      menuPrice === 44
    )
      return 'BOGO $55 min on DD'
    if (
      promoType === 'BOGO' &&
      promoDiscountValue === 50 &&
      promoMinCart === 55 &&
      promoMaxCap === 0 &&
      ddCommission === 0 &&
      digitalFeePct === 0 &&
      Math.abs(foodCostPct - 26.8) < 0.01 &&
      promoEstOrders === 700 &&
      menuPrice === 44
    )
      return 'BOGO $55 min on App'
    return 'Custom promo'
  }, [
    promoType,
    promoDiscountValue,
    promoMinCart,
    promoMaxCap,
    ddCommission,
    digitalFeePct,
    foodCostPct,
    promoEstOrders,
    menuPrice,
  ])

  return (
    <div className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)]">
      {/* Header */}
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
            <Link
              href="/dashboard"
              className="rounded-md px-4 py-2 text-sm font-semibold text-[var(--text-tertiary)] transition hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
            >
              Dashboard
            </Link>
            <Link
              href="/trends"
              className="rounded-md px-4 py-2 text-sm font-semibold text-[var(--text-tertiary)] transition hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
            >
              Trends
            </Link>
            <span className="rounded-md bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white">
              Analytics
            </span>
            <Link
              href="/audit"
              className="rounded-md px-4 py-2 text-sm font-semibold text-[var(--text-tertiary)] transition hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
            >
              Audit
            </Link>
            <Link
              href="/ai"
              className="rounded-md px-4 py-2 text-sm font-semibold text-[var(--text-tertiary)] transition hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
            >
              ✨ AI
            </Link>
            <Link
              href="/dashboard"
              className="rounded-md px-4 py-2 text-sm font-semibold text-[var(--text-tertiary)] transition hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
            >
              Live
            </Link>
            <Link
              href="/dashboard"
              className="rounded-md px-4 py-2 text-sm font-semibold text-[var(--text-tertiary)] transition hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
            >
              Guest Experience
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto flex max-w-[1400px] gap-6 px-6 py-8">
        {/* Sidebar nav — Analytics section */}
        <aside className="w-64 shrink-0">
          <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
            Analytics
          </div>
          <nav className="space-y-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-2">
            <button
              type="button"
              className="flex w-full items-center justify-between rounded-lg bg-[var(--bg-elevated)] px-3 py-2 text-left text-sm font-medium text-[var(--text-primary)]"
            >
              <span>Aggregator Profitability</span>
              <span className="rounded-full bg-[var(--brand-subtle)] px-2 py-0.5 text-[10px] font-semibold text-[var(--brand)]">
                Live
              </span>
            </button>
            <button
              type="button"
              className="flex w-full cursor-not-allowed items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-medium text-[var(--text-tertiary)]"
            >
              <span>Customer Mix (coming soon)</span>
            </button>
          </nav>
        </aside>

        <div className="flex-1 space-y-8">
          {/* Store selector */}
          <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
                  Store context
                </div>
                <div className="mt-1 text-sm text-[var(--text-secondary)]">
                  Auto-fills ticket, food cost %, and platform discount from the latest cube pull.
                </div>
              </div>
              <div className="flex items-center gap-3">
                {autoMetricsLoading && (
                  <span className="text-[11px] text-[var(--text-tertiary)]">
                    Loading live data…
                  </span>
                )}
                {autoMetricsError && !autoMetricsLoading && (
                  <span className="text-[11px] text-amber-400">
                    Live data unavailable — using manual inputs.
                  </span>
                )}
                <select
                  value={selectedStore}
                  onChange={(e) =>
                    setSelectedStore(e.target.value as typeof selectedStore)
                  }
                  className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-overlay)] px-3 py-2 text-sm text-[var(--text-primary)]"
                >
                  <option value="all">All Stores (group avg)</option>
                  <option value="2081">2081</option>
                  <option value="2021">2021</option>
                  <option value="2259">2259</option>
                  <option value="2292">2292</option>
                  <option value="2481">2481</option>
                  <option value="3011">3011</option>
                </select>
              </div>
            </div>
          </section>
          {/* Tool 1 — Aggregator Profitability Calculator */}
          <section>
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-[var(--text-primary)]">
                  Tool 1 — Aggregator Profitability Calculator
                </h2>
                <p className="text-xs text-[var(--text-secondary)]">
                  Adjust live with Brad to see DoorDash / UberEats margin vs carryout for a single order.
                </p>
              </div>
            </div>

            <div className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
              {/* Inputs */}
              <div className="space-y-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5">
                <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
                  Inputs
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <div className="mb-1 flex items-center justify-between text-xs text-[var(--text-tertiary)]">
                      <span>Menu price (ticket, $)</span>
                      <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                        Live
                      </span>
                    </div>
                    <input
                      type="number"
                      min={0}
                      step={0.5}
                      value={menuPrice}
                      onChange={(e) => setMenuPrice(toNumber(e.target.value))}
                      className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-overlay)] px-3 py-2 text-sm text-[var(--text-primary)]"
                    />
                    <input
                      type="range"
                      min={0}
                      max={60}
                      step={0.5}
                      value={menuPrice}
                      onChange={(e) => setMenuPrice(toNumber(e.target.value))}
                      className="mt-2 w-full accent-[var(--brand)]"
                    />
                  </div>
                  <div>
                    <div className="mb-1 flex items-center justify-between text-xs text-[var(--text-tertiary)]">
                      <span>Platform discount ($ per order)</span>
                      <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                        Live
                      </span>
                    </div>
                    <input
                      type="number"
                      min={0}
                      step={0.5}
                      value={promoDiscount}
                      onChange={(e) => setPromoDiscount(toNumber(e.target.value))}
                      className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-overlay)] px-3 py-2 text-sm text-[var(--text-primary)]"
                    />
                    <input
                      type="range"
                      min={0}
                      max={Math.max(0, menuPrice)}
                      step={0.5}
                      value={promoDiscount}
                      onChange={(e) => setPromoDiscount(toNumber(e.target.value))}
                      className="mt-2 w-full accent-[var(--brand)]"
                    />
                  </div>
                  <div>
                    <div className="mb-1 flex items-center justify-between text-xs text-[var(--text-tertiary)]">
                      <span>DoorDash commission %</span>
                      <span className="rounded-full bg-sky-500/10 px-2 py-0.5 text-[10px] font-semibold text-sky-300">
                        Manual
                      </span>
                    </div>
                    <input
                      type="number"
                      min={0}
                      max={60}
                      step={0.5}
                      value={ddCommission}
                      onChange={(e) => setDdCommission(toNumber(e.target.value))}
                      className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-overlay)] px-3 py-2 text-sm text-[var(--text-primary)]"
                    />
                    <input
                      type="range"
                      min={0}
                      max={40}
                      step={0.5}
                      value={ddCommission}
                      onChange={(e) => setDdCommission(toNumber(e.target.value))}
                      className="mt-2 w-full accent-[var(--brand)]"
                    />
                  </div>
                  <div>
                    <div className="mb-1 flex items-center justify-between text-xs text-[var(--text-tertiary)]">
                      <span>UberEats commission %</span>
                      <span className="rounded-full bg-sky-500/10 px-2 py-0.5 text-[10px] font-semibold text-sky-300">
                        Manual
                      </span>
                    </div>
                    <input
                      type="number"
                      min={0}
                      max={60}
                      step={0.5}
                      value={ueCommission}
                      onChange={(e) => setUeCommission(toNumber(e.target.value))}
                      className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-overlay)] px-3 py-2 text-sm text-[var(--text-primary)]"
                    />
                    <input
                      type="range"
                      min={0}
                      max={40}
                      step={0.5}
                      value={ueCommission}
                      onChange={(e) => setUeCommission(toNumber(e.target.value))}
                      className="mt-2 w-full accent-[var(--brand)]"
                    />
                  </div>
                  <div>
                    <div className="mb-1 flex items-center justify-between text-xs text-[var(--text-tertiary)]">
                      <span>PJ digital fee % (platform)</span>
                      <span className="rounded-full bg-sky-500/10 px-2 py-0.5 text-[10px] font-semibold text-sky-300">
                        Manual
                      </span>
                    </div>
                    <input
                      type="number"
                      min={0}
                      max={10}
                      step={0.1}
                      value={digitalFeePct}
                      onChange={(e) => setDigitalFeePct(toNumber(e.target.value))}
                      className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-overlay)] px-3 py-2 text-sm text-[var(--text-primary)]"
                    />
                    <input
                      type="range"
                      min={0}
                      max={5}
                      step={0.1}
                      value={digitalFeePct}
                      onChange={(e) => setDigitalFeePct(toNumber(e.target.value))}
                      className="mt-2 w-full accent-[var(--brand)]"
                    />
                  </div>
                  <div>
                    <div className="mb-1 flex items-center justify-between text-xs text-[var(--text-tertiary)]">
                      <span>Food cost %</span>
                      <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                        Live
                      </span>
                    </div>
                    <input
                      type="number"
                      min={0}
                      max={80}
                      step={0.5}
                      value={foodCostPct}
                      onChange={(e) => setFoodCostPct(toNumber(e.target.value))}
                      className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-overlay)] px-3 py-2 text-sm text-[var(--text-primary)]"
                    />
                    <input
                      type="range"
                      min={0}
                      max={60}
                      step={0.5}
                      value={foodCostPct}
                      onChange={(e) => setFoodCostPct(toNumber(e.target.value))}
                      className="mt-2 w-full accent-[var(--brand)]"
                    />
                  </div>
                </div>
                <div className="mt-2 text-[11px] text-[var(--text-tertiary)]">
                  <span className="font-semibold text-[var(--text-secondary)]">Note:</span>{' '}
                  Commission % fields are manual — enter from your DD/UE contract. Live fields pull from the most
                  recent cube snapshot.
                </div>
                <div className="mt-2 rounded-lg bg-[var(--bg-overlay)] px-3 py-2 text-xs text-[var(--text-tertiary)]">
                  <span className="font-semibold text-[var(--text-secondary)]">Assumptions:</span>{' '}
                  Single order view; platform commission and PJ digital fee are charged on full menu price (pre-discount);
                  carryout has no commission or digital fee.
                </div>
              </div>

              {/* Outputs */}
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
                    Live output
                  </div>
                  <div className="text-[11px] text-[var(--text-tertiary)]">
                    Menu: <span className="font-mono text-[var(--text-secondary)]">{formatCurrency(ddResult.menuPrice)}</span>
                    {' · '}
                    Customer pays: <span className="font-mono text-[var(--text-secondary)]">{formatCurrency(ddResult.customerPays)}</span>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {/* DoorDash card */}
                  <div className="rounded-xl border border-white/[0.06] bg-[var(--bg-surface)] p-5">
                    <div className="mb-3 flex items-center justify-between">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
                          DoorDash
                        </div>
                        <div className="text-sm font-semibold text-[var(--text-primary)]">
                          {ddCommission.toFixed(1)}% commission · {digitalFeePct.toFixed(1)}% digital fee
                        </div>
                      </div>
                    </div>
                    <dl className="space-y-[8px] text-sm">
                      <div className="flex items-center justify-between">
                        <dt className="text-[var(--text-secondary)]">Menu Price (full ticket)</dt>
                        <dd className="font-mono text-[var(--text-primary)]">
                          {formatCurrency(ddResult.menuPrice)}
                        </dd>
                      </div>
                      <div className="flex items-center justify-between">
                        <dt className="text-[var(--text-secondary)]">Platform Promo Discount</dt>
                        <dd className="font-mono text-amber-300">
                          -{formatCurrency(ddResult.promoDiscount)}
                        </dd>
                      </div>
                      <div className="flex items-center justify-between">
                        <dt className="text-[var(--text-secondary)]">Customer Pays</dt>
                        <dd className="font-mono text-[var(--text-primary)]">
                          {formatCurrency(ddResult.customerPays)}
                        </dd>
                      </div>
                      <div className="flex items-center justify-between">
                        <dt className="text-[var(--text-secondary)]">
                          Platform Commission ({ddCommission.toFixed(1)}% of menu)
                        </dt>
                        <dd className="font-mono text-rose-300">
                          -{formatCurrency(ddResult.commissionDollar)}
                        </dd>
                      </div>
                      <div className="flex items-center justify-between">
                        <dt className="text-[var(--text-secondary)]">
                          PJ Digital Fee ({digitalFeePct.toFixed(1)}% of menu)
                        </dt>
                        <dd className="font-mono text-rose-300">
                          -{formatCurrency(ddResult.digitalFeeDollar)}
                        </dd>
                      </div>
                      <div className="flex items-center justify-between">
                        <dt className="text-[var(--text-secondary)]">Net Revenue to Store</dt>
                        <dd className="font-mono text-[var(--text-primary)]">
                          {formatCurrency(ddResult.netRevenue)}
                        </dd>
                      </div>
                      <div className="flex items-center justify-between">
                        <dt className="text-[var(--text-secondary)]">Food Cost $</dt>
                        <dd className="font-mono text-amber-300">
                          -{formatCurrency(ddResult.foodCostDollar)}
                        </dd>
                      </div>
                      <div className="flex items-center justify-between">
                        <dt className="text-[var(--text-secondary)]">Store Margin $</dt>
                        <dd className="font-mono text-[var(--text-primary)]">
                          {formatCurrency(ddResult.marginDollar)}
                        </dd>
                      </div>
                      <div className="flex items-center justify-between">
                        <dt className="text-[var(--text-secondary)]">Store Margin % (of menu)</dt>
                        <dd className="font-mono text-[var(--text-primary)]">
                          {formatPercent(ddResult.marginPct)}
                        </dd>
                      </div>
                      <div className="flex items-center justify-between">
                        <dt className="flex items-center gap-2 text-[var(--text-secondary)]">
                          <span>vs Carryout (same price)</span>
                          <span className="rounded bg-[var(--bg-overlay)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-tertiary)]">
                            Commission cost
                          </span>
                        </dt>
                        <dd className="font-mono text-[var(--text-primary)]">
                          {formatCurrency(ddResult.carryoutMarginDollar - ddResult.marginDollar)}
                        </dd>
                      </div>
                      <div className="flex items-center justify-between">
                        <dt className="flex items-center gap-1.5 text-[var(--text-secondary)]">
                          <span>vs Carryout</span>
                          <input
                            type="number"
                            min={0}
                            max={99}
                            step={0.01}
                            value={carryoutSpecialPrice}
                            onChange={(e) => setCarryoutSpecialPrice(Math.max(0, toNumber(e.target.value)))}
                            className="w-14 rounded-full border border-[var(--border-default)] bg-[var(--bg-overlay)] px-2 py-0.5 text-center font-mono text-xs text-[var(--text-primary)]"
                          />
                          <span>special</span>
                        </dt>
                        <dd
                          className={`font-mono font-medium ${
                            (() => {
                              const carryoutSpecialMargin =
                                carryoutSpecialPrice - (carryoutSpecialPrice * foodCostPct) / 100
                              const vsSpecial = carryoutSpecialMargin - ddResult.marginDollar
                              return vsSpecial < 0 ? 'text-rose-400' : 'text-amber-400'
                            })()
                          }`}
                        >
                          {formatCurrency(
                            (() => {
                              const carryoutSpecialMargin =
                                carryoutSpecialPrice - (carryoutSpecialPrice * foodCostPct) / 100
                              return carryoutSpecialMargin - ddResult.marginDollar
                            })()
                          )}
                        </dd>
                      </div>
                      {(() => {
                        const carryoutSpecialMargin =
                          carryoutSpecialPrice - (carryoutSpecialPrice * foodCostPct) / 100
                        const vsSpecial = carryoutSpecialMargin - ddResult.marginDollar
                        return (
                          <p
                            className={`text-xs font-medium ${
                              vsSpecial < 0 ? 'text-rose-300' : 'text-amber-300'
                            }`}
                          >
                            {vsSpecial < 0
                              ? `Aggregator order more profitable than ${formatCurrency(carryoutSpecialPrice)} carryout — carryout special is the real margin problem`
                              : `Carryout special earns more than aggregator despite lower price — volume is masking the margin gap`}
                          </p>
                        )
                      })()}
                    </dl>
                    <div className="mt-3 line-clamp-2 border-l-4 border-amber-500 bg-[#1a1a1a] px-3 py-[12px] text-xs text-[var(--text-secondary)]" style={{ lineHeight: 1.5 }}>
                      {(() => {
                        const carryoutSpecialMargin =
                          carryoutSpecialPrice - (carryoutSpecialPrice * foodCostPct) / 100
                        return (
                          <>
                            The {formatCurrency(carryoutSpecialPrice)} carryout special trains customers to never pay full price. Every
                            carryout order at {formatCurrency(carryoutSpecialPrice)} earns{' '}
                            <span className="font-mono font-semibold">{formatCurrency(carryoutSpecialMargin)}</span> vs{' '}
                            <span className="font-mono font-semibold">{formatCurrency(ddResult.marginDollar)}</span> on DoorDash. Fix the
                            floor first — then fix the channel.
                          </>
                        )
                      })()}
                    </div>
                    {/* Waterfall-style bar visualization */}
                    <div className="mt-4 space-y-1.5">
                      {(() => {
                        const base = ddResult.menuPrice || 0
                        const steps = [
                          { key: 'menu', label: 'Menu Price', value: ddResult.menuPrice },
                          { key: 'net', label: 'Net Revenue', value: ddResult.netRevenue },
                          { key: 'margin', label: 'Store Margin', value: ddResult.marginDollar },
                        ]
                        return steps.map((step, idx) => {
                          const width =
                            base > 0 ? `${Math.max(0, Math.min(1, step.value / base)) * 100}%` : '0%'
                          const color =
                            idx === 0
                              ? 'bg-sky-500'
                              : idx === 1
                                ? 'bg-amber-500'
                                : 'bg-emerald-500'
                          return (
                            <div key={step.key} className="flex items-center gap-2">
                              <span className="w-24 text-[11px] text-[var(--text-tertiary)]">
                                {step.label}
                              </span>
                              <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--bg-overlay)]">
                                <div
                                  className={`h-full rounded-full ${color}`}
                                  style={{ width }}
                                />
                              </div>
                              <span className="w-20 text-right font-mono text-[11px] text-[var(--text-secondary)]">
                                {formatCurrency(step.value)}
                              </span>
                            </div>
                          )
                        })
                      })()}
                    </div>
                    <MarginVerdictBadge marginPct={ddResult.marginPct} />
                    <p className="mt-2 text-xs text-white">
                      {(() => {
                        const diff = ddResult.carryoutMarginDollar - ddResult.marginDollar
                        const direction = diff >= 0 ? 'less' : 'more'
                        const amount = Math.abs(diff)
                        return (
                          <>
                            Every aggregator order earns{' '}
                            <span className="font-mono font-bold text-amber-400">
                              {formatCurrency(amount)}
                            </span>{' '}
                            {direction} than the same carryout order
                          </>
                        )
                      })()}
                    </p>
                  </div>

                  {/* UberEats card */}
                  <div className="rounded-xl border border-white/[0.06] bg-[var(--bg-surface)] p-5">
                    <div className="mb-3 flex items-center justify-between">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
                          UberEats
                        </div>
                        <div className="text-sm font-semibold text-[var(--text-primary)]">
                          {ueCommission.toFixed(1)}% commission · {digitalFeePct.toFixed(1)}% digital fee
                        </div>
                      </div>
                    </div>
                    <dl className="space-y-[8px] text-sm">
                      <div className="flex items-center justify-between">
                        <dt className="text-[var(--text-secondary)]">Menu Price (full ticket)</dt>
                        <dd className="font-mono text-[var(--text-primary)]">
                          {formatCurrency(ueResult.menuPrice)}
                        </dd>
                      </div>
                      <div className="flex items-center justify-between">
                        <dt className="text-[var(--text-secondary)]">Platform Promo Discount</dt>
                        <dd className="font-mono text-amber-300">
                          -{formatCurrency(ueResult.promoDiscount)}
                        </dd>
                      </div>
                      <div className="flex items-center justify-between">
                        <dt className="text-[var(--text-secondary)]">Customer Pays</dt>
                        <dd className="font-mono text-[var(--text-primary)]">
                          {formatCurrency(ueResult.customerPays)}
                        </dd>
                      </div>
                      <div className="flex items-center justify-between">
                        <dt className="text-[var(--text-secondary)]">
                          Platform Commission ({ueCommission.toFixed(1)}% of menu)
                        </dt>
                        <dd className="font-mono text-rose-300">
                          -{formatCurrency(ueResult.commissionDollar)}
                        </dd>
                      </div>
                      <div className="flex items-center justify-between">
                        <dt className="text-[var(--text-secondary)]">
                          PJ Digital Fee ({digitalFeePct.toFixed(1)}% of menu)
                        </dt>
                        <dd className="font-mono text-rose-300">
                          -{formatCurrency(ueResult.digitalFeeDollar)}
                        </dd>
                      </div>
                      <div className="flex items-center justify-between">
                        <dt className="text-[var(--text-secondary)]">Net Revenue to Store</dt>
                        <dd className="font-mono text-[var(--text-primary)]">
                          {formatCurrency(ueResult.netRevenue)}
                        </dd>
                      </div>
                      <div className="flex items-center justify-between">
                        <dt className="text-[var(--text-secondary)]">Food Cost $</dt>
                        <dd className="font-mono text-amber-300">
                          -{formatCurrency(ueResult.foodCostDollar)}
                        </dd>
                      </div>
                      <div className="flex items-center justify-between">
                        <dt className="text-[var(--text-secondary)]">Store Margin $</dt>
                        <dd className="font-mono text-[var(--text-primary)]">
                          {formatCurrency(ueResult.marginDollar)}
                        </dd>
                      </div>
                      <div className="flex items-center justify-between">
                        <dt className="text-[var(--text-secondary)]">Store Margin % (of menu)</dt>
                        <dd className="font-mono text-[var(--text-primary)]">
                          {formatPercent(ueResult.marginPct)}
                        </dd>
                      </div>
                      <div className="flex items-center justify-between">
                        <dt className="flex items-center gap-2 text-[var(--text-secondary)]">
                          <span>vs Carryout (same price)</span>
                          <span className="rounded bg-[var(--bg-overlay)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-tertiary)]">
                            Commission cost
                          </span>
                        </dt>
                        <dd className="font-mono text-[var(--text-primary)]">
                          {formatCurrency(ueResult.carryoutMarginDollar - ueResult.marginDollar)}
                        </dd>
                      </div>
                      <div className="flex items-center justify-between">
                        <dt className="flex items-center gap-1.5 text-[var(--text-secondary)]">
                          <span>vs Carryout</span>
                          <input
                            type="number"
                            min={0}
                            max={99}
                            step={0.01}
                            value={carryoutSpecialPrice}
                            onChange={(e) => setCarryoutSpecialPrice(Math.max(0, toNumber(e.target.value)))}
                            className="w-14 rounded-full border border-[var(--border-default)] bg-[var(--bg-overlay)] px-2 py-0.5 text-center font-mono text-xs text-[var(--text-primary)]"
                          />
                          <span>special</span>
                        </dt>
                        <dd
                          className={`font-mono font-medium ${
                            (() => {
                              const carryoutSpecialMargin =
                                carryoutSpecialPrice - (carryoutSpecialPrice * foodCostPct) / 100
                              const vsSpecial = carryoutSpecialMargin - ueResult.marginDollar
                              return vsSpecial < 0 ? 'text-rose-400' : 'text-amber-400'
                            })()
                          }`}
                        >
                          {formatCurrency(
                            (() => {
                              const carryoutSpecialMargin =
                                carryoutSpecialPrice - (carryoutSpecialPrice * foodCostPct) / 100
                              return carryoutSpecialMargin - ueResult.marginDollar
                            })()
                          )}
                        </dd>
                      </div>
                      {(() => {
                        const carryoutSpecialMargin =
                          carryoutSpecialPrice - (carryoutSpecialPrice * foodCostPct) / 100
                        const vsSpecial = carryoutSpecialMargin - ueResult.marginDollar
                        return (
                          <p
                            className={`text-xs font-medium ${
                              vsSpecial < 0 ? 'text-rose-300' : 'text-amber-300'
                            }`}
                          >
                            {vsSpecial < 0
                              ? `Aggregator order more profitable than ${formatCurrency(carryoutSpecialPrice)} carryout — carryout special is the real margin problem`
                              : `Carryout special earns more than aggregator despite lower price — volume is masking the margin gap`}
                          </p>
                        )
                      })()}
                    </dl>
                    <div className="mt-3 line-clamp-2 border-l-4 border-amber-500 bg-[#1a1a1a] px-3 py-[12px] text-xs text-[var(--text-secondary)]" style={{ lineHeight: 1.5 }}>
                      {(() => {
                        const carryoutSpecialMargin =
                          carryoutSpecialPrice - (carryoutSpecialPrice * foodCostPct) / 100
                        return (
                          <>
                            The {formatCurrency(carryoutSpecialPrice)} carryout special trains customers to never pay full price. Every
                            carryout order at {formatCurrency(carryoutSpecialPrice)} earns{' '}
                            <span className="font-mono font-semibold">{formatCurrency(carryoutSpecialMargin)}</span> vs{' '}
                            <span className="font-mono font-semibold">{formatCurrency(ueResult.marginDollar)}</span> on UberEats. Fix the
                            floor first — then fix the channel.
                          </>
                        )
                      })()}
                    </div>
                    {/* Waterfall-style bar visualization */}
                    <div className="mt-4 space-y-1.5">
                      {(() => {
                        const base = ueResult.menuPrice || 0
                        const steps = [
                          { key: 'menu', label: 'Menu Price', value: ueResult.menuPrice },
                          { key: 'net', label: 'Net Revenue', value: ueResult.netRevenue },
                          { key: 'margin', label: 'Store Margin', value: ueResult.marginDollar },
                        ]
                        return steps.map((step, idx) => {
                          const width =
                            base > 0 ? `${Math.max(0, Math.min(1, step.value / base)) * 100}%` : '0%'
                          const color =
                            idx === 0
                              ? 'bg-sky-500'
                              : idx === 1
                                ? 'bg-amber-500'
                                : 'bg-emerald-500'
                          return (
                            <div key={step.key} className="flex items-center gap-2">
                              <span className="w-24 text-[11px] text-[var(--text-tertiary)]">
                                {step.label}
                              </span>
                              <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--bg-overlay)]">
                                <div
                                  className={`h-full rounded-full ${color}`}
                                  style={{ width }}
                                />
                              </div>
                              <span className="w-20 text-right font-mono text-[11px] text-[var(--text-secondary)]">
                                {formatCurrency(step.value)}
                              </span>
                            </div>
                          )
                        })
                      })()}
                    </div>
                    <MarginVerdictBadge marginPct={ueResult.marginPct} />
                    <p className="mt-2 text-xs text-white">
                      {(() => {
                        const diff = ueResult.carryoutMarginDollar - ueResult.marginDollar
                        const direction = diff >= 0 ? 'less' : 'more'
                        const amount = Math.abs(diff)
                        return (
                          <>
                            Every aggregator order earns{' '}
                            <span className="font-mono font-bold text-amber-400">
                              {formatCurrency(amount)}
                            </span>{' '}
                            {direction} than the same carryout order
                          </>
                        )
                      })()}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Section divider */}
          <div className="flex w-full items-center gap-4 py-2">
            <div className="h-px flex-1 bg-[var(--border-subtle)]" />
            <span className="shrink-0 text-xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]">
              ——————— PROMO SIMULATOR ———————
            </span>
            <div className="h-px flex-1 bg-[var(--border-subtle)]" />
          </div>

          {/* Tool 2 — Promo Simulator */}
          <section className="pt-[48px]">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-[var(--text-primary)]">
                  Tool 2 — Promo Simulator
                </h2>
                <p className="text-xs text-[var(--text-secondary)]">
                  Model promo impact per order and monthly. Menu price, DD commission %, and food cost % are linked from Tool 1.
                </p>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
              {/* Inputs */}
              <div className="space-y-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
                  Inputs
                </div>

                <div>
                  <label className="mb-1 block text-xs text-[var(--text-tertiary)]">Menu Price $ (linked from Tool 1)</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min={0}
                      step={0.5}
                      value={menuPrice}
                      onChange={(e) => setMenuPrice(toNumber(e.target.value))}
                      className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-overlay)] px-3 py-2 text-sm text-[var(--text-primary)]"
                    />
                    <input
                      type="range"
                      min={0}
                      max={60}
                      step={0.5}
                      value={menuPrice}
                      onChange={(e) => setMenuPrice(toNumber(e.target.value))}
                      className="w-24 shrink-0 accent-[var(--brand)]"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs text-[var(--text-tertiary)]">Promo Type</label>
                  <div className="flex flex-wrap gap-2">
                    {(['BOGO', '% Off', '$ Off', 'Free Item'] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setPromoType(t)}
                        className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                          promoType === t
                            ? 'bg-[var(--brand)] text-white'
                            : 'bg-[var(--bg-overlay)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs text-[var(--text-tertiary)]">
                    {promoType === '% Off' ? 'Discount %' : 'Discount $ amount'}
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min={0}
                      max={promoType === '% Off' ? 100 : 200}
                      step={promoType === '% Off' ? 1 : 0.5}
                      value={promoDiscountValue}
                      onChange={(e) => setPromoDiscountValue(toNumber(e.target.value))}
                      className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-overlay)] px-3 py-2 text-sm text-[var(--text-primary)]"
                    />
                    <input
                      type="range"
                      min={0}
                      max={promoType === '% Off' ? 100 : 50}
                      step={promoType === '% Off' ? 5 : 0.5}
                      value={promoDiscountValue}
                      onChange={(e) => setPromoDiscountValue(toNumber(e.target.value))}
                      className="w-24 shrink-0 accent-[var(--brand)]"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs text-[var(--text-tertiary)]">Min Cart $</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min={0}
                      max={80}
                      step={1}
                      value={promoMinCart}
                      onChange={(e) => setPromoMinCart(toNumber(e.target.value))}
                      className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-overlay)] px-3 py-2 text-sm text-[var(--text-primary)]"
                    />
                    <input
                      type="range"
                      min={0}
                      max={80}
                      step={5}
                      value={promoMinCart}
                      onChange={(e) => setPromoMinCart(toNumber(e.target.value))}
                      className="w-24 shrink-0 accent-[var(--brand)]"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs text-[var(--text-tertiary)]">Max Discount Cap $ (0 = no cap)</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min={0}
                      max={20}
                      step={0.5}
                      value={promoMaxCap}
                      onChange={(e) => setPromoMaxCap(toNumber(e.target.value))}
                      className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-overlay)] px-3 py-2 text-sm text-[var(--text-primary)]"
                    />
                    <input
                      type="range"
                      min={0}
                      max={20}
                      step={1}
                      value={promoMaxCap}
                      onChange={(e) => setPromoMaxCap(toNumber(e.target.value))}
                      className="w-24 shrink-0 accent-[var(--brand)]"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs text-[var(--text-tertiary)]">DD Commission % (linked from Tool 1)</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min={0}
                      max={60}
                      step={0.5}
                      value={ddCommission}
                      onChange={(e) => setDdCommission(toNumber(e.target.value))}
                      className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-overlay)] px-3 py-2 text-sm text-[var(--text-primary)]"
                    />
                    <input
                      type="range"
                      min={0}
                      max={40}
                      step={0.5}
                      value={ddCommission}
                      onChange={(e) => setDdCommission(toNumber(e.target.value))}
                      className="w-24 shrink-0 accent-[var(--brand)]"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs text-[var(--text-tertiary)]">Food Cost % (linked from Tool 1)</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min={0}
                      max={80}
                      step={0.5}
                      value={foodCostPct}
                      onChange={(e) => setFoodCostPct(toNumber(e.target.value))}
                      className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-overlay)] px-3 py-2 text-sm text-[var(--text-primary)]"
                    />
                    <input
                      type="range"
                      min={0}
                      max={60}
                      step={0.5}
                      value={foodCostPct}
                      onChange={(e) => setFoodCostPct(toNumber(e.target.value))}
                      className="w-24 shrink-0 accent-[var(--brand)]"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs text-[var(--text-tertiary)]">Est. Monthly Orders this promo applies to</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min={100}
                      max={3000}
                      step={50}
                      value={promoEstOrders}
                      onChange={(e) => setPromoEstOrders(Math.max(100, Math.min(3000, toNumber(e.target.value))))}
                      className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-overlay)] px-3 py-2 text-sm text-[var(--text-primary)]"
                    />
                    <input
                      type="range"
                      min={100}
                      max={3000}
                      step={100}
                      value={promoEstOrders}
                      onChange={(e) => setPromoEstOrders(toNumber(e.target.value))}
                      className="w-24 shrink-0 accent-[var(--brand)]"
                    />
                  </div>
                </div>

                <div className="rounded-lg bg-[var(--bg-overlay)] px-3 py-2 text-[11px] text-[var(--text-tertiary)]">
                  <span className="font-semibold text-[var(--text-secondary)]">Scenarios:</span>

                  <div className="mt-2 grid gap-3 md:grid-cols-3">
                    {/* GROUP 1 — STABILIZE (T1) */}
                    <div className="overflow-hidden rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)]">
                      <div className="flex items-center justify-between bg-amber-500/15 px-3 py-2">
                        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-300">STABILIZE</div>
                        <div className="text-[10px] font-semibold text-amber-200/80">2021 · 2481 · T1</div>
                      </div>
                      <div className="space-y-2 p-3">
                        <button
                          type="button"
                          onClick={() => {
                            setPromoType('BOGO')
                            setPromoDiscountValue(50)
                            setPromoMinCart(40)
                            setPromoMaxCap(0)
                            setDdCommission(0)
                            setDigitalFeePct(0)
                            setFoodCostPct(26.8)
                            setPromoEstOrders(400)
                            setMenuPrice(29)
                          }}
                          className="w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-2 text-left text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-[var(--text-primary)]">PJ App BOGO $40 min</span>
                            <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                              App-only — no DD commission
                            </span>
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setPromoType('$ Off')
                            setPromoDiscountValue(5)
                            setPromoMinCart(35)
                            setPromoMaxCap(5)
                            setDdCommission(27)
                            setDigitalFeePct(1.5)
                            setFoodCostPct(26.8)
                            setPromoEstOrders(400)
                            setMenuPrice(29)
                          }}
                          className="w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-2 text-left text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]"
                        >
                          <span className="font-semibold text-[var(--text-primary)]">DD $5 off $35+ weekday</span>
                        </button>
                      </div>
                    </div>

                    {/* GROUP 2 — DRIVE THE LIFT (T2) */}
                    <div className="overflow-hidden rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)]">
                      <div className="flex items-center justify-between bg-rose-500/15 px-3 py-2">
                        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-rose-300">DRIVE THE LIFT</div>
                        <div className="text-[10px] font-semibold text-rose-200/80">2081 · 2292 · 2259 · T2</div>
                      </div>
                      <div className="space-y-2 p-3">
                        <button
                          type="button"
                          onClick={() => {
                            setPromoType('$ Off')
                            setPromoDiscountValue(12)
                            setPromoMinCart(33)
                            setPromoMaxCap(12)
                            setDdCommission(27)
                            setDigitalFeePct(1.5)
                            setFoodCostPct(26.8)
                            setPromoEstOrders(550)
                            setMenuPrice(29)
                          }}
                          className="w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-2 text-left text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-[var(--text-primary)]">Cap Discount $12 / $33 min</span>
                            <span className="rounded-full border border-rose-500/40 bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold text-rose-300">
                              Restores discount discipline
                            </span>
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setPromoType('$ Off')
                            setPromoDiscountValue(5)
                            setPromoMinCart(36)
                            setPromoMaxCap(5)
                            setDdCommission(27)
                            setDigitalFeePct(1.5)
                            setFoodCostPct(26.8)
                            setPromoEstOrders(550)
                            setMenuPrice(29)
                          }}
                          className="w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-2 text-left text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]"
                        >
                          <span className="font-semibold text-[var(--text-primary)]">Rotating $5 off $36+</span>
                        </button>
                      </div>
                    </div>

                    {/* GROUP 3 — PROTECT & SCALE (T3) */}
                    <div className="overflow-hidden rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)]">
                      <div className="flex items-center justify-between bg-emerald-500/15 px-3 py-2">
                        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-300">PROTECT &amp; SCALE</div>
                        <div className="text-[10px] font-semibold text-emerald-200/80">3011 · T3</div>
                      </div>
                      <div className="space-y-2 p-3">
                        <button
                          type="button"
                          onClick={() => {
                            setPromoType('BOGO')
                            setPromoDiscountValue(50)
                            setPromoMinCart(55)
                            setPromoMaxCap(0)
                            setDdCommission(27)
                            setDigitalFeePct(1.5)
                            setFoodCostPct(26.8)
                            setPromoEstOrders(700)
                            setMenuPrice(44)
                          }}
                          className="w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-2 text-left text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-[var(--text-primary)]">BOGO $55 min on DD</span>
                            <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                              Shows true DD cost at scale
                            </span>
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setPromoType('BOGO')
                            setPromoDiscountValue(50)
                            setPromoMinCart(55)
                            setPromoMaxCap(0)
                            setDdCommission(0)
                            setDigitalFeePct(0)
                            setFoodCostPct(26.8)
                            setPromoEstOrders(700)
                            setMenuPrice(44)
                          }}
                          className="w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-2 text-left text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-[var(--text-primary)]">BOGO $55 min on App</span>
                            <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                              Same promo — App margin vs DD
                            </span>
                          </div>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Keep Dominos callout warning, but only when commission applies */}
                  {ddCommission > 0 && promoType === '% Off' && promoDiscountValue >= 40 && (
                    <p className="mt-3 rounded-md border border-rose-500/50 bg-rose-500/10 px-2 py-1.5 text-xs font-medium text-rose-300">
                      Matching Dominos pricing — this is what it costs to compete directly.
                    </p>
                  )}
                </div>
              </div>

              {/* Outputs */}
              <div className="space-y-4">
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4">
                  <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
                    Per Order View
                  </div>
                  <dl className="space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-[var(--text-secondary)]">Effective Order Value</dt>
                      <dd className="font-mono">{formatCurrency(promoResult.effectiveOrderValue)}</dd>
                    </div>
                    {promoResult.minCart > promoResult.menuPrice && (
                      <div className="text-xs text-[var(--text-tertiary)]">
                        Min cart of {formatCurrency(promoResult.minCart)} applied — order must reach this value to trigger promo
                      </div>
                    )}
                    <div className="flex justify-between">
                      <dt className="text-[var(--text-secondary)]">Promo Discount Applied $</dt>
                      <dd className="font-mono text-amber-300">-{formatCurrency(promoResult.promoDiscountApplied)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-[var(--text-secondary)]">Customer Pays $</dt>
                      <dd className="font-mono">{formatCurrency(promoResult.customerPays)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-[var(--text-secondary)]">DD Commission $ (on effective order value)</dt>
                      <dd className="font-mono text-rose-300">-{formatCurrency(promoResult.commissionDollar)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-[var(--text-secondary)]">PJ Digital Fee $ (1.5% of effective order value)</dt>
                      <dd className="font-mono text-rose-300">-{formatCurrency(promoResult.digitalFeeDollar)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-[var(--text-secondary)]">Net Revenue to Store $</dt>
                      <dd className="font-mono">{formatCurrency(promoResult.netRevenue)}</dd>
                    </div>
                    <p className="text-[11px] text-[var(--text-tertiary)]">
                      Store absorbs promo discount (not DoorDash). Net = effective order value − commission − digital fee − promo discount.
                    </p>
                    <div className="flex justify-between">
                      <dt className="text-[var(--text-secondary)]">Food Cost $</dt>
                      <dd className="font-mono text-amber-300">-{formatCurrency(promoResult.foodCostDollar)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-[var(--text-secondary)]">Store Margin $ per order</dt>
                      <dd className="font-mono font-medium">{formatCurrency(promoResult.marginDollar)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-[var(--text-secondary)]">Store Margin % (of effective order value)</dt>
                      <dd className="font-mono">{formatPercent(promoResult.marginPct)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-[var(--text-secondary)]">vs No-Promo same order: margin gap $</dt>
                      <dd className="font-mono text-rose-400">
                        -{formatCurrency(Math.abs(promoResult.vsNoPromo))}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-[var(--text-secondary)]">vs Carryout same order: margin gap $</dt>
                      <dd className="font-mono text-amber-300">{formatCurrency(promoResult.vsCarryoutGap)}</dd>
                    </div>
                  </dl>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${promoMarginVerdict.colorClass}`}>
                      Margin: {promoMarginVerdict.label}
                    </span>
                    <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${promoMonthlyVerdict.colorClass}`}>
                      {promoMonthlyVerdict.label}
                    </span>
                  </div>
                </div>

                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4">
                  <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
                    Monthly Impact View
                  </div>
                  <dl className="space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-[var(--text-secondary)]">Total Revenue (customer pays × orders)</dt>
                      <dd className="font-mono">{formatCurrency(promoMonthlyTotalRevenue)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-[var(--text-secondary)]">Total Store Margin $</dt>
                      <dd className="font-mono font-medium">{formatCurrency(promoMonthlyTotalMargin)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-[var(--text-secondary)]">vs No-Promo scenario: $ difference per month</dt>
                      <dd className="font-mono font-medium text-rose-400">
                        -{formatCurrency(Math.abs(promoMonthlyVsNoPromo))}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-[var(--text-secondary)]">Break-Even Orders needed to justify promo</dt>
                      <dd className="font-mono">
                        {promoBreakEvenOrders != null ? promoBreakEvenOrders.toLocaleString() : '—'}
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>
            </div>
          </section>

          {/* All Store Promo Impact Grid */}
          <section>
            <div className="mb-2">
              <h2 className="text-lg font-bold text-[var(--text-primary)]">
                All Store Promo Impact — {currentPromoPresetName} applied to all stores
              </h2>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">
                Promo inputs above apply to all stores. Card colors show urgency — Red needs volume, Green needs protection, Orange needs lift.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {STORE_GRID_IDS.map((storeId) => {
                const data = cubeStoreGridData[storeId]
                const tier = STORE_TIER[storeId] ?? 'T2'
                const name = STORE_NAMES[storeId] ?? `Store ${storeId}`
                if (!data || data.menuPrice <= 0) {
                  return (
                    <div
                      key={storeId}
                      className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 opacity-60"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-[var(--text-primary)]">{storeId} · {name}</span>
                        <span className="rounded bg-[var(--bg-overlay)] px-2 py-0.5 text-[10px] font-semibold text-[var(--text-tertiary)]">{tier}</span>
                      </div>
                      <p className="mt-2 text-xs text-[var(--text-tertiary)]">No cube data — load store first</p>
                    </div>
                  )
                }
                const storePromoResult = calcPromoSimulator({
                  menuPrice: data.menuPrice,
                  minCart: promoMinCart,
                  promoType,
                  discountValue: promoDiscountValue,
                  maxDiscountCap: promoMaxCap,
                  ddCommissionPct: ddCommission,
                  digitalFeePct,
                  foodCostPct: data.foodCostPct,
                })
                const lyAgg = data.lyAggregatorSales || 0
                const tyAgg = data.aggregatorSales || 0
                const estMonthlyOrders = data.menuPrice > 0 ? Math.round((tyAgg / data.menuPrice) * 30) : 0
                const aggRatio = lyAgg > 0 ? tyAgg / lyAgg : 1
                const borderColor =
                  tier === 'T3' || aggRatio > 0.8
                    ? 'border-emerald-500/60'
                    : tier === 'T2' || (aggRatio >= 0.5 && aggRatio <= 0.8)
                      ? 'border-amber-500/60'
                      : 'border-rose-500/60'
                const lyVsTyGap = tyAgg - lyAgg
                const recoveryOrders = lyAgg > 0 && data.menuPrice > 0 ? Math.max(0, Math.ceil((lyAgg - tyAgg) / data.menuPrice)) : 0
                const monthlyMargin = storePromoResult.marginDollar * estMonthlyOrders

                let recLabel = ''
                let recClass = ''
                let recSubtext = ''
                if (storePromoResult.marginPct > 35) {
                  recLabel = 'Run This Promo'
                  recClass = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                } else if (storePromoResult.marginPct >= 25) {
                  recLabel = 'Run with min cart adjustment'
                  recClass = 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  const suggestMinCart = (targetPct: number) => {
                    const start = Math.ceil(Math.max(promoMinCart, data.menuPrice))
                    const max = 120
                    for (let mc = start; mc <= max; mc += 1) {
                      const r = calcPromoSimulator({
                        menuPrice: data.menuPrice,
                        minCart: mc,
                        promoType,
                        discountValue: promoDiscountValue,
                        maxDiscountCap: promoMaxCap,
                        ddCommissionPct: ddCommission,
                        digitalFeePct,
                        foodCostPct: data.foodCostPct,
                      })
                      if (r.marginPct >= targetPct) return mc
                    }
                    return null
                  }
                  const mc = suggestMinCart(35)
                  recSubtext =
                    mc != null
                      ? `Try min cart $${mc} to target 35% margin`
                      : 'Raising min cart may not improve this promo — consider reducing discount or adding a cap'
                } else {
                  recLabel = 'Too aggressive — raise min cart'
                  recClass = 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                  const suggestMinCart = (targetPct: number) => {
                    const start = Math.ceil(Math.max(promoMinCart, data.menuPrice))
                    const max = 120
                    for (let mc = start; mc <= max; mc += 1) {
                      const r = calcPromoSimulator({
                        menuPrice: data.menuPrice,
                        minCart: mc,
                        promoType,
                        discountValue: promoDiscountValue,
                        maxDiscountCap: promoMaxCap,
                        ddCommissionPct: ddCommission,
                        digitalFeePct,
                        foodCostPct: data.foodCostPct,
                      })
                      if (r.marginPct >= targetPct) return mc
                    }
                    return null
                  }
                  const mc = suggestMinCart(25)
                  recSubtext =
                    mc != null
                      ? `Try min cart $${mc} to reach 25% margin`
                      : 'Raise min cart, reduce discount, or add a cap to reach 25% margin'
                }

                return (
                  <div
                    key={storeId}
                    className={`rounded-xl border-2 ${borderColor} bg-[var(--bg-surface)] p-4`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-[var(--text-primary)]">{storeId} · {name}</span>
                      <span className="rounded bg-[var(--bg-overlay)] px-2 py-0.5 text-[10px] font-semibold text-[var(--text-tertiary)]">{tier}</span>
                    </div>
                    <dl className="mt-3 space-y-1 text-xs">
                      <div className="flex justify-between">
                        <dt className="text-[var(--text-tertiary)]">Avg Ticket</dt>
                        <dd className="font-mono">{formatCurrency(data.menuPrice)}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-[var(--text-tertiary)]">Est. Monthly Agg Orders</dt>
                        <dd className="font-mono">{estMonthlyOrders.toLocaleString()}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-[var(--text-tertiary)]">LY vs TY Agg Sales gap $</dt>
                        <dd className={lyVsTyGap < 0 ? 'font-mono text-rose-400' : 'font-mono text-[var(--text-primary)]'}>
                          {formatCurrency(lyVsTyGap)}
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-[var(--text-tertiary)]">Promo margin $/order</dt>
                        <dd className="font-mono font-medium">{formatCurrency(storePromoResult.marginDollar)}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-[var(--text-tertiary)]">Monthly margin $</dt>
                        <dd className="font-mono font-medium">{formatCurrency(monthlyMargin)}</dd>
                      </div>
                      {recoveryOrders > 0 && (
                        <div className="flex justify-between">
                          <dt className="text-[var(--text-tertiary)]">Recovery gap</dt>
                          <dd className="font-mono text-amber-300">Needs {recoveryOrders.toLocaleString()} more orders to recover LY agg sales</dd>
                        </div>
                      )}
                    </dl>
                    <div className="mt-3">
                      <span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-semibold ${recClass}`}>
                        {recLabel}
                      </span>
                      {recSubtext && <p className="mt-1 text-[10px] text-[var(--text-tertiary)]">{recSubtext}</p>}
                    </div>
                  </div>
                )
              })}
            </div>

            {(() => {
              const storesWithData = STORE_GRID_IDS.filter((id) => cubeStoreGridData[id] && cubeStoreGridData[id].menuPrice > 0)
              let totalMonthlyMarginWithPromo = 0
              let totalMonthlyMarginNoPromo = 0
              let totalRecoveryOrders = 0
              for (const id of storesWithData) {
                const d = cubeStoreGridData[id]!
                const res = calcPromoSimulator({
                  menuPrice: d.menuPrice,
                  minCart: promoMinCart,
                  promoType,
                  discountValue: promoDiscountValue,
                  maxDiscountCap: promoMaxCap,
                  ddCommissionPct: ddCommission,
                  digitalFeePct,
                  foodCostPct: d.foodCostPct,
                })
                const estOrd = d.menuPrice > 0 ? (d.aggregatorSales / d.menuPrice) * 30 : 0
                const noPromoMargin = res.marginNoPromo * estOrd
                totalMonthlyMarginWithPromo += res.marginDollar * estOrd
                totalMonthlyMarginNoPromo += noPromoMargin
                const ly = d.lyAggregatorSales || 0
                const ty = d.aggregatorSales || 0
                if (ly > ty && d.menuPrice > 0) totalRecoveryOrders += Math.ceil((ly - ty) / d.menuPrice)
              }
              const netPromoCost = totalMonthlyMarginWithPromo - totalMonthlyMarginNoPromo

              return (
                <div className="mt-6 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-overlay)] p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
                    Group Summary
                  </div>
                  <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
                    <div className="flex justify-between gap-2">
                      <dt className="text-[var(--text-secondary)]">Total monthly margin with promo</dt>
                      <dd className="font-mono font-medium">{formatCurrency(totalMonthlyMarginWithPromo)}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-[var(--text-secondary)]">Total monthly margin without promo</dt>
                      <dd className="font-mono font-medium">{formatCurrency(totalMonthlyMarginNoPromo)}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-[var(--text-secondary)]">Net promo cost to group</dt>
                      <dd className="font-mono font-medium text-rose-400">{formatCurrency(netPromoCost)}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-[var(--text-secondary)]">Total recovery orders needed group-wide</dt>
                      <dd className="font-mono font-medium">{totalRecoveryOrders.toLocaleString()}</dd>
                    </div>
                  </dl>
                </div>
              )
            })()}
          </section>

          {/* Tool 3 — Ideal Food Cost Calculator */}
          <section>
            <div className="mb-4">
              <h2 className="text-lg font-bold text-[var(--text-primary)]">
                Tool 3 — Ideal Food Cost Calculator
              </h2>
              <p className="text-xs text-[var(--text-secondary)]">
                Build any pizza and see the theoretical ingredient cost. Compare to actual food cost % from cube to find variance.
              </p>
            </div>
            <p className="mb-3 text-[11px] text-[var(--text-tertiary)]">
              {IDEAL_FOOD_COST_P3_2026.period} | Cheese Case: {formatCurrency(IDEAL_FOOD_COST_P3_2026.cheeseCasePrice)}
            </p>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4">
                <div className="mb-4 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">Pizza builder</div>
                <div className="space-y-4">
                  <div>
                    <label className="mb-1 block text-xs text-[var(--text-secondary)]">Pizza type</label>
                    <select
                      value={idealPizzaType}
                      onChange={(e) => setIdealPizzaType(e.target.value)}
                      className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-overlay)] px-3 py-2 text-sm text-[var(--text-primary)]"
                    >
                      {IDEAL_SPECIALTY_NAMES.map((name) => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-2 block text-xs text-[var(--text-secondary)]">Size</label>
                    <div className="flex flex-wrap gap-2">
                      {IDEAL_SIZE_OPTIONS.map(({ key, label }) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setIdealSize(key)}
                          className={`rounded-full px-4 py-1.5 text-sm font-semibold ${idealSize === key ? 'bg-[var(--brand)] text-white' : 'bg-[var(--bg-overlay)] text-[var(--text-secondary)]'}`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {idealPizzaType === 'Custom Pizza' && (
                    <div>
                      <label className="mb-2 block text-xs text-[var(--text-secondary)]">Toppings</label>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                        {IDEAL_CUSTOM_TOPPING_NAMES.map((name) => (
                          <label key={name} className="flex cursor-pointer items-center gap-2 text-sm text-[var(--text-primary)]">
                            <input
                              type="checkbox"
                              checked={idealToppings.has(name)}
                              onChange={() => toggleIdealTopping(name)}
                              className="rounded border-[var(--border-default)]"
                            />
                            <span>{name.replace(/  2$/, '')}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                  <div>
                    <label className="mb-1 block text-xs text-[var(--text-secondary)]">Menu price ($)</label>
                    <div className="flex items-center gap-1">
                      <span className="text-[var(--text-tertiary)]">$</span>
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={idealMenuPrice}
                        onChange={(e) => setIdealMenuPrice(e.target.value)}
                        placeholder="0"
                        className="w-28 rounded-lg border border-[var(--border-default)] bg-[var(--bg-overlay)] px-3 py-2 text-sm text-[var(--text-primary)]"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-[var(--text-secondary)]">Store (for actual food cost %)</label>
                    <select
                      value={idealStore}
                      onChange={(e) => setIdealStore(e.target.value)}
                      className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-overlay)] px-3 py-2 text-sm text-[var(--text-primary)]"
                    >
                      <option value="">Select store</option>
                      {STORE_GRID_IDS.map((id) => (
                        <option key={id} value={id}>{id} {STORE_NAMES[id] ?? ''}</option>
                      ))}
                    </select>
                    {idealCubeLoading && idealStore && (
                      <span className="ml-2 text-xs text-[var(--text-tertiary)]">Loading…</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4">
                  <div className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">Ideal cost breakdown</div>
                  <dl className="space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-[var(--text-secondary)]">Base (dough, sauce, cheese, box)</dt>
                      <dd className="font-mono font-medium">{formatCurrency(idealCostResult.baseCost)}</dd>
                    </div>
                    {idealCostResult.toppingLines.map((line) => (
                      <div key={line.name} className="flex justify-between">
                        <dt className="text-[var(--text-secondary)]">{line.name}</dt>
                        <dd className="font-mono">{formatCurrency(line.cost)}</dd>
                      </div>
                    ))}
                    <div className="mt-2 flex justify-between border-t border-[var(--border-subtle)] pt-2">
                      <dt className="font-semibold text-[var(--text-primary)]">Total ideal food cost</dt>
                      <dd className="font-mono font-bold">{formatCurrency(idealCostResult.totalCost)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-[var(--text-secondary)]">Ideal food cost %</dt>
                      <dd className="font-mono font-medium">{formatPercent(idealCostResult.idealPct)}</dd>
                    </div>
                  </dl>
                </div>
                {idealStore && (
                  <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4">
                    <div className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">Variance analysis</div>
                    <dl className="space-y-1.5 text-sm">
                      <div className="flex justify-between">
                        <dt className="text-[var(--text-secondary)]">Actual food cost % (cube)</dt>
                        <dd className="font-mono font-medium" style={{ color: idealCubeFoodPct != null && idealCubeFoodPct > 28 ? 'var(--danger-text)' : 'var(--success-text)' }}>
                          {idealCubeFoodPct != null ? formatPercent(idealCubeFoodPct) : '—'}
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-[var(--text-secondary)]">Ideal food cost %</dt>
                        <dd className="font-mono">{formatPercent(idealCostResult.idealPct)}</dd>
                      </div>
                      {idealCubeFoodPct != null && (
                        <>
                          <div className="flex justify-between">
                            <dt className="text-[var(--text-secondary)]">Variance</dt>
                            <dd
                              className="font-mono font-medium"
                              style={{
                                color:
                                  idealCubeFoodPct - idealCostResult.idealPct > 5
                                    ? 'var(--danger-text)'
                                    : idealCubeFoodPct - idealCostResult.idealPct > 2
                                      ? 'var(--warning-text, #f97316)'
                                      : 'var(--success-text)',
                              }}
                            >
                              {(idealCubeFoodPct - idealCostResult.idealPct) >= 0 ? '+' : ''}
                              {(idealCubeFoodPct - idealCostResult.idealPct).toFixed(1)}%
                            </dd>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2 border-t border-[var(--border-subtle)] pt-2">
                            {idealCubeFoodPct - idealCostResult.idealPct > 5 ? (
                              <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-xs font-semibold text-red-400">Investigate</span>
                            ) : idealCubeFoodPct - idealCostResult.idealPct > 2 ? (
                              <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-semibold text-amber-400">Monitor</span>
                            ) : (
                              <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-semibold text-emerald-400">On Target</span>
                            )}
                          </div>
                        </>
                      )}
                    </dl>
                    <p className="mt-3 text-[11px] italic text-[var(--text-tertiary)]">
                      Positive variance = potential waste, portioning, or theft
                    </p>
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}

