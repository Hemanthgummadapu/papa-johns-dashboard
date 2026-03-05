import { NextRequest, NextResponse } from 'next/server'
import {
  getTableauAuthToken,
  getViews,
  queryView,
  signOut,
  TABLEAU_VIEW_IDS,
} from '@/lib/tableau-client'

export const dynamic = 'force-dynamic'

/** Parse a single CSV line respecting quoted fields (e.g. "2,680.89"). */
function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  result.push(current.trim())
  return result
}

/** Parse CSV string into array of row objects (first row = headers). */
function parseCSV(csv: string): Record<string, string>[] {
  const lines = csv.trim().split(/\r?\n/)
  if (lines.length < 2) return []
  const headers = parseCSVLine(lines[0]).map((h) => h.replace(/^"|"$/g, '').trim())
  const rows: Record<string, string>[] = []
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]).map((v) => v.replace(/^"|"$/g, '').trim())
    const row: Record<string, string> = {}
    headers.forEach((h, j) => {
      row[h] = values[j] ?? ''
    })
    rows.push(row)
  }
  return rows
}

/** If CSV is "Measure Names","Measure Values" format, return key-value object; else null. */
function parseMeasureNamesValues(csv: string): Record<string, string> | null {
  const lines = csv.trim().split(/\r?\n/)
  if (lines.length < 2) return null
  const headers = parseCSVLine(lines[0]).map((h) => h.replace(/^"|"$/g, '').trim())
  if (headers.length !== 2 || headers[0] !== 'Measure Names' || headers[1] !== 'Measure Values') return null
  const out: Record<string, string> = {}
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]).map((v) => v.replace(/^"|"$/g, '').trim())
    const key = values[0] ?? ''
    const val = values[1] ?? ''
    if (key) out[key] = val
  }
  return out
}

/** Fallback: map first CSV row (standard headers) to leadership shape. */
function norm(col: string): string {
  return col.toLowerCase().replace(/\s+/g, '_').replace(/%/g, 'pct')
}

function mapRowToLeadershipFallback(row: Record<string, string>): {
  store_number: string
  date: string
  net_sales: number
  ty_orders: number
  comp_pct: string
  orders_comp_pct: string
  labor_pct: number
  food_pct: number
  bozocoro_pct: number
  dispatch_fee_pct: number
  mileage_pct: number
  gross_profit: number
  pph_dr30: number
  pph_dr50: number
  osat_pct: number
  avg_otd_time: string
} {
  const byKey: Record<string, string> = {}
  Object.entries(row).forEach(([k, v]) => {
    byKey[norm(k)] = v
  })
  const num = (key: string) => {
    const v = byKey[key]
    if (v == null || v === '') return 0
    const n = parseFloat(String(v).replace(/[,$%]/g, ''))
    return Number.isFinite(n) ? n : 0
  }
  const str = (key: string) => byKey[key] ?? ''
  return {
    store_number: str('store_number') || str('store') || str('store number') || str('storenumber') || '',
    date: str('date') || str('report_date') || '',
    net_sales: num('net_sales') || num('net sales') || num('netsales'),
    ty_orders: num('ty_orders') || num('ty orders') || num('orders') || num('total_orders'),
    comp_pct: str('comp_pct') || str('comp %') || str('sales_comp') || '',
    orders_comp_pct: str('orders_comp_pct') || str('orders comp %') || str('orders_comp') || '',
    labor_pct: num('labor_pct') || num('labor %') || num('actual_labor_pct') || num('laborpct'),
    food_pct: num('food_pct') || num('food %') || num('actual_food_pct') || num('foodpct'),
    bozocoro_pct: num('bozocoro_pct') || num('bozocoro %') || num('bozocoro_pct') || num('bozocoropct'),
    dispatch_fee_pct: num('dispatch_fee_pct') || num('dispatch fee %') || num('dispatchfeepct'),
    mileage_pct: num('mileage_pct') || num('mileage %') || num('mileagepct'),
    gross_profit: num('gross_profit') || num('gross profit') || num('grossprofit'),
    pph_dr30: num('pph_dr30') || num('pph dr30') || num('pphdr30'),
    pph_dr50: num('pph_dr50') || num('pph dr50') || num('pphdr50'),
    osat_pct: num('osat_pct') || num('osat %') || num('osat') || num('osatpct'),
    avg_otd_time: str('avg_otd_time') || str('avg otd time') || str('avg_otd') || str('otd_time') || '',
  }
}

/** Map key-value object (from Measure Names / Measure Values) to leadership payload. */
function mapMeasureKvToLeadership(
  kv: Record<string, string>,
  store: string,
  date: string
): {
  store_number: string
  date: string
  net_sales: number
  ty_orders: number
  comp_pct: string
  orders_comp_pct: string
  labor_pct: number
  food_pct: number
  bozocoro_pct: number
  dispatch_fee_pct: number
  mileage_pct: number
  gross_profit: number
  pph_dr30: number
  pph_dr50: number
  osat_pct: number
  avg_otd_time: string
} {
  const get = (key: string) => kv[key] ?? ''
  const num = (key: string) => {
    const v = get(key)
    if (!v) return 0
    const n = parseFloat(String(v).replace(/[,$%]/g, ''))
    return Number.isFinite(n) ? n : 0
  }
  return {
    store_number: store,
    date,
    net_sales: num('Net Sales (Fran)') || num('Net Sales'),
    ty_orders: num('TY Orders') || num('Orders'),
    comp_pct: get('Comp %') || get('Sales Comp %') || '',
    orders_comp_pct: get('Orders Comp %') || '',
    labor_pct: num('Actual Labor %') * 100 || num('Labor %') * 100,
    food_pct: num('Actual Food %') * 100 || num('Food %') * 100,
    bozocoro_pct: num('BOZOCORO %') * 100,
    dispatch_fee_pct: num('Dispatch Fee %') * 100,
    mileage_pct: num('Mileage %') * 100,
    gross_profit: num('Gross Profit (Fran)') || num('Gross Profit'),
    pph_dr30: num('PPH - with DR30/50') || num('PPH DR30'),
    pph_dr50: num('PPH - with DR30/50'), // same as dr30 if single metric
    osat_pct: num('OSAT %') * 100 || num('OSAT'),
    avg_otd_time: get('Avg OTD Time') || get('OTD Time') || '',
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)

  // Debug: inspect all 3 key workbooks and their views
  if (searchParams.get('debug') === 'true') {
    const WORKBOOKS = [
      { id: '6ce0f96f-49f4-49b9-83db-1edcaa783638', name: 'Store Leadership Dashboard' },
      { id: '63bc9637-9a7b-44db-b62d-a9a1e5dc6982', name: 'Zero, Bad, and Canceled' },
      { id: 'c741a688-a003-4d91-9195-a41bd65bec56', name: 'ProfitKeeper - Franchise' },
    ]
    let token: string | null = null
    let siteId: string | null = null
    try {
      const auth = await getTableauAuthToken()
      token = auth.token
      siteId = auth.siteId
      const workbooksWithViews = await Promise.all(
        WORKBOOKS.map(async (workbook) => {
          const views = await getViews(token!, siteId!, workbook.id)
          return {
            id: workbook.id,
            name: workbook.name,
            views: views.map((v: any) => ({ id: v.id, name: v.name, contentUrl: v.contentUrl })),
          }
        })
      )
      if (token && siteId) await signOut(token, siteId)
      return NextResponse.json({
        auth: 'success',
        workbooks: workbooksWithViews,
      })
    } catch (err) {
      if (token && siteId) {
        try { await signOut(token, siteId) } catch (_) {}
      }
      const message = err instanceof Error ? err.message : String(err)
      return NextResponse.json({ error: message }, { status: 500 })
    }
  }

  // Debug: list all views for candidate workbooks (Labor % / BOZOCORO % sources)
  if (searchParams.get('debugviews') === 'true') {
    const CANDIDATE_WORKBOOKS = [
      { id: 'f7362040-3445-4dd9-a61f-357d89d7368f', name: 'Daily Operating Report' },
      { id: '5231ea91-4dd6-45a9-bcf5-bd7e645c7b44', name: 'Ops One Stop Shop' },
      { id: 'e6945146-6bf6-4635-b192-5d2fa7b84a2c', name: 'Profitability Analysis' },
      { id: '16aa06c0-e817-41cd-9f32-6c68d2aac94a', name: 'Loss Prevention' },
    ]
    let token: string | null = null
    let siteId: string | null = null
    try {
      const auth = await getTableauAuthToken()
      token = auth.token
      siteId = auth.siteId
      const workbooksWithViews = await Promise.all(
        CANDIDATE_WORKBOOKS.map(async (wb) => {
          const views = await getViews(token!, siteId!, wb.id)
          return {
            id: wb.id,
            name: wb.name,
            views: views.map((v: any) => ({ id: v.id, name: v.name, contentUrl: v.contentUrl })),
          }
        })
      )
      if (token && siteId) await signOut(token, siteId)
      return NextResponse.json({
        auth: 'success',
        workbooks: workbooksWithViews,
      })
    } catch (err) {
      if (token && siteId) {
        try { await signOut(token, siteId) } catch (_) {}
      }
      const message = err instanceof Error ? err.message : String(err)
      return NextResponse.json({ error: message }, { status: 500 })
    }
  }

  const store = searchParams.get('store') ?? ''
  const dateParam = searchParams.get('date')
  const date = dateParam ?? new Date().toISOString().slice(0, 10) // YYYY-MM-DD today

  if (!store) {
    return NextResponse.json({ error: 'Missing query param: store' }, { status: 400 })
  }

  let token: string | null = null
  let siteId: string | null = null

  try {
    const auth = await getTableauAuthToken()
    token = auth.token
    siteId = auth.siteId

    const FRANCHISE_VIEW_ID = 'c659c524-9dbf-4bbd-a2b4-d16ae205f7eb'
    const CORPORATE_VIEW_ID = 'c36d2637-b1d9-4a1e-8e64-9ba4fc99d804'
    const filters: Record<string, string> = { Store: store, Date: date }

    if (searchParams.get('debugcsv') === 'true') {
      const PROBE_VIEWS = [
        { name: 'DOR_Export', id: 'f0f01ea1-f45f-42df-a76d-98898e384ea5' },
        { name: 'DOR_ClockInOut', id: '9f327359-e0af-46d6-835b-572901b17439' },
        { name: 'Ops_Franchise', id: '3aea74ab-fc79-4986-915a-51123500a041' },
        { name: 'DOR_Detail', id: '6022653b-bc93-498c-b573-365ebc2d12cf' },
      ]
      const probeCsvs = await Promise.all(
        PROBE_VIEWS.map((view) => queryView(token!, siteId!, view.id, {}, ''))
      )
      const result: Record<string, { raw: string; headers: string[]; parsed_key_value?: Record<string, string> }> = {}
      PROBE_VIEWS.forEach((view, i) => {
        const csv = probeCsvs[i]
        const firstLine = csv.trim().split(/\r?\n/)[0] ?? ''
        const headers = parseCSVLine(firstLine).map((h) => h.replace(/^"|"$/g, '').trim())
        const parsed = parseMeasureNamesValues(csv)
        result[view.name] = {
          raw: csv.substring(0, 500),
          headers,
          ...(parsed ? { parsed_key_value: parsed } : {}),
        }
      })
      if (token && siteId) await signOut(token, siteId)
      return NextResponse.json(result)
    }

    // Try without vf_ prefix first — filter names must match workbook exactly
    const [franchiseCsv, corporateCsv] = await Promise.all([
      queryView(token, siteId, FRANCHISE_VIEW_ID, filters, ''),
      queryView(token, siteId, CORPORATE_VIEW_ID, filters, ''),
    ])

    const franchiseParsed = parseMeasureNamesValues(franchiseCsv)
    const corporateParsed = parseMeasureNamesValues(corporateCsv)

    const mergedKv = { ...(franchiseParsed ?? {}), ...(corporateParsed ?? {}) }
    if (Object.keys(mergedKv).length > 0) {
      const payload = mapMeasureKvToLeadership(mergedKv, store, date)
      if (token && siteId) await signOut(token, siteId)
      return NextResponse.json(payload)
    }

    const rows = parseCSV(franchiseCsv)
    const first = rows[0]
    if (!first) {
      if (token && siteId) await signOut(token, siteId)
      return NextResponse.json(
        { error: 'No data returned from view', store_number: store, date },
        { status: 200 }
      )
    }

    // Fallback: standard header/row format (legacy) — use franchise CSV
    const payload = mapRowToLeadershipFallback(first)
    payload.store_number = payload.store_number || store
    payload.date = payload.date || date

    if (token && siteId) await signOut(token, siteId)

    return NextResponse.json(payload)
  } catch (err) {
    if (token && siteId) {
      try {
        await signOut(token, siteId)
      } catch (_) {}
    }
    const raw = err && typeof (err as Error & { raw?: string }).raw === 'string' ? (err as Error & { raw: string }).raw : null
    if (raw) {
      console.log('Tableau raw response:', raw.substring(0, 500))
      return NextResponse.json(
        { error: 'Tableau returned unexpected format', raw: raw.substring(0, 300) },
        { status: 500 }
      )
    }
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
