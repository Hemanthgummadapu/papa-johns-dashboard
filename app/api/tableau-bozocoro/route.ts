import { NextResponse } from 'next/server'
import {
  getTableauAuthToken,
  getViewDataCsv,
  getViews,
  queryView,
  signOut,
  TABLEAU_VIEW_IDS,
} from '@/lib/tableau-client'

/** Workbook "Zero, Bad, and Canceled" (Audit project). */
const ZERO_BAD_CANCELED_WORKBOOK_ID = '63bc9637-9a7b-44db-b62d-a9a1e5dc6982'

/** Tableau UI filter set (use with filterPrefix 'vf_'). */
const TABLEAU_UI_FILTERS: Record<string, string> = {
  'Year': '2026',
  'Period': 'P03 2026',
  'Week': 'W9 2026',
  'Operated By': 'Franchise',
  'Store Type': 'Traditional',
  'DMA': 'Los Angeles, CA',
  'DVP': 'Daniel Collinsworth',
}

/** Date filter param names for /views/{viewId}/data (prefix with vf_): Weekly=vf_Week (e.g. W9 2026), Period=vf_Period (e.g. P03 2026), Daily=vf_Business Date (e.g. 2026-03-02). */

const TABLEAU_API_VERSION = '3.21'

/** Single probe: call /views/{viewId}/data with given API version and optional Accept header. Returns status + raw text; logs full URL. */
async function fetchViewDataProbe(
  token: string,
  siteId: string,
  viewId: string,
  apiVersion: string,
  acceptHeader: string | undefined,
  extraParams?: string
): Promise<{ url: string; status: number; raw: string }> {
  const baseUrl = (process.env.TABLEAU_SERVER_URL ?? '').replace(/\/$/, '')
  if (!baseUrl) throw new Error('TABLEAU_SERVER_URL is not set')
  const url = `${baseUrl}/api/${apiVersion}/sites/${siteId}/views/${viewId}/data?maxAge=1${extraParams ? `&${extraParams}` : ''}`
  console.log('[fetchViewDataProbe] URL:', url)
  const headers: Record<string, string> = { 'X-Tableau-Auth': token }
  if (acceptHeader !== undefined) headers['Accept'] = acceptHeader
  const response = await fetch(url, { method: 'GET', headers })
  const raw = await response.text()
  return { url, status: response.status, raw }
}

/** Tableau REST API /views/{viewId}/data endpoint — returns underlying data table as CSV. Uses Accept: text/csv. */
async function fetchViewDataCsv(
  token: string,
  siteId: string,
  viewId: string,
  extraParams?: string
): Promise<string> {
  const result = await fetchViewDataProbe(token, siteId, viewId, TABLEAU_API_VERSION, 'text/csv', extraParams)
  if (result.status !== 200) throw new Error(`Tableau data endpoint failed: ${result.status}`)
  return result.raw
}

/** GET a direct Tableau .csv URL with session cookie + X-Tableau-Auth. Returns status and first 500 chars. */
async function fetchDirectCsvUrl(
  url: string,
  token: string
): Promise<{ url: string; status: number; raw_first_500: string }> {
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Cookie': `workgroup_session_id=${token}`,
      'X-Tableau-Auth': token,
    },
  })
  const raw = await response.text()
  return { url, status: response.status, raw_first_500: raw.substring(0, 500) }
}

/** Tableau API base URL (no hash or path). */
function getTableauBaseUrl(): string {
  const u = process.env.TABLEAU_SERVER_URL ?? ''
  const base = u.split('#')[0].split('/').slice(0, 3).join('/')
  return base || 'https://us-east-1.online.tableau.com'
}

/** Request body sent to Tableau PAT signin (for debug). */
function buildPatSigninBody(): { credentials: { personalAccessTokenName: string; personalAccessTokenSecret: string; site: { contentUrl: string } } } {
  const patName = process.env.TABLEAU_PAT_NAME
  const patSecret = process.env.TABLEAU_PAT_SECRET
  const siteContentUrl = process.env.TABLEAU_SITE ?? 'storeanalytics'
  if (!patName || !patSecret) throw new Error('TABLEAU_PAT_NAME and TABLEAU_PAT_SECRET must be set')
  return {
    credentials: {
      personalAccessTokenName: patName,
      personalAccessTokenSecret: patSecret,
      site: { contentUrl: siteContentUrl },
    },
  }
}

/** Sign in with Personal Access Token (PAT). Returns { token, siteId }. */
async function signInWithPat(): Promise<{ token: string; siteId: string }> {
  const baseUrl = getTableauBaseUrl()
  const body = buildPatSigninBody()
  const bodyStr = JSON.stringify(body)
  const res = await fetch(`${baseUrl}/api/${TABLEAU_API_VERSION}/auth/signin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: bodyStr,
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`Tableau PAT signin failed: ${res.status} - ${text}`)
  let data: any
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error(`Tableau signin response not JSON: ${text.substring(0, 200)}`)
  }
  const token = data?.credentials?.token
  const siteId = data?.credentials?.site?.id
  if (!token || !siteId) throw new Error('Tableau signin response missing token or site.id')
  return { token, siteId }
}

/** PAT signin debug: send request, return request_body + response_status + response_body (no token use). */
async function signInWithPatDebug(): Promise<{ request_body: object; response_status: number; response_body: string }> {
  const baseUrl = getTableauBaseUrl()
  const requestBody = buildPatSigninBody()
  const bodyStr = JSON.stringify(requestBody)
  console.log('[Tableau PAT signin] request body:', bodyStr)
  const res = await fetch(`${baseUrl}/api/${TABLEAU_API_VERSION}/auth/signin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: bodyStr,
  })
  const responseBody = await res.text()
  return { request_body: requestBody, response_status: res.status, response_body: responseBody }
}

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

function norm(col: string): string {
  return col.toLowerCase().replace(/\s+/g, '_').replace(/%/g, 'pct')
}

type DetailRow = { employee: string; order_id: string; amount: number; time: string; reason?: string }

function mapRowToDetail(row: Record<string, string>, includeReason = false): DetailRow {
  const byKey: Record<string, string> = {}
  Object.entries(row).forEach(([k, v]) => {
    byKey[norm(k)] = v
  })
  const str = (keys: string[]) => {
    for (const k of keys) if (byKey[k] != null && byKey[k] !== '') return byKey[k]
    return ''
  }
  const num = (keys: string[]) => {
    for (const k of keys) {
      const v = byKey[k]
      if (v != null && v !== '') {
        const n = parseFloat(String(v).replace(/[,$%]/g, ''))
        if (Number.isFinite(n)) return n
      }
    }
    return 0
  }
  const out: DetailRow = {
    employee: str(['employee', 'employee_name', 'name', 'team_member', 'tm']),
    order_id: str(['order_id', 'order id', 'orderid', 'order_number']),
    amount: num(['amount', 'total', 'value', 'sales', 'order_value']),
    time: str(['time', 'date', 'datetime', 'order_time', 'created']),
  }
  if (includeReason) out.reason = str(['reason', 'comment', 'notes'])
  return out
}

function buildSummaryAndDetails(rows: Record<string, string>[], includeReason = false): {
  summary: { count: number; total_value: number }
  details: DetailRow[]
} {
  const details = rows.map((r) => mapRowToDetail(r, includeReason))
  const total_value = details.reduce((s, d) => s + d.amount, 0)
  return { summary: { count: details.length, total_value }, details }
}

const BOZOCORO_VIEWS = [
  { key: 'zeroedOutDetails' as const, viewId: TABLEAU_VIEW_IDS.zeroedOutDetails },
  { key: 'badOrderDetails' as const, viewId: TABLEAU_VIEW_IDS.badOrderDetails },
  { key: 'canceledOrderDetails' as const, viewId: TABLEAU_VIEW_IDS.canceledOrderDetails },
  { key: 'refundOrderDetails' as const, viewId: TABLEAU_VIEW_IDS.refundOrderDetails },
]

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const store = searchParams.get('store') ?? ''
  const dateParam = searchParams.get('date')
  const date = dateParam ?? new Date().toISOString().slice(0, 10)

  let token: string | null = null
  let siteId: string | null = null

  try {
    // PAT signin debug only — return request_body, response_status, response_body (no token used)
    if (searchParams.get('test_pat_signin_debug') === 'true') {
      const debug = await signInWithPatDebug()
      return NextResponse.json(debug)
    }

    // PAT auth then crosstab/export for BadOrderSummary — with and without filters; status + first 500 chars each
    if (searchParams.get('test_personal_auth') === 'true') {
      const auth = await signInWithPat()
      token = auth.token
      siteId = auth.siteId
      const baseUrl = getTableauBaseUrl()
      const BAD_ORDER_SUMMARY_VIEW_ID = '235ac17d-2e73-46be-ba0a-6c4fef76e73e'
      const crosstabBase = `${baseUrl}/api/${TABLEAU_API_VERSION}/sites/${siteId}/views/${BAD_ORDER_SUMMARY_VIEW_ID}/crosstab/export`
      const headers = { 'X-Tableau-Auth': token!, 'Content-Type': 'application/json' }
      const body = JSON.stringify({ format: 'csv' })

      const [resNoFilters, resWithFilters] = await Promise.all([
        fetch(crosstabBase, { method: 'POST', headers, body }),
        fetch(`${crosstabBase}?vf_Week=W9%202026&vf_Period=P03%202026`, { method: 'POST', headers, body }),
      ])
      const textNoFilters = await resNoFilters.text()
      const textWithFilters = await resWithFilters.text()

      return NextResponse.json({
        crosstab_no_filters: { status: resNoFilters.status, response_first_500: textNoFilters.substring(0, 500) },
        crosstab_with_week_period: { status: resWithFilters.status, response_first_500: textWithFilters.substring(0, 500) },
      })
    }

    // PAT token: /data with includeAllColumns + crosstab/export — status and first 300 chars each
    if (searchParams.get('test_data_export') === 'true') {
      const auth = await signInWithPat()
      token = auth.token
      siteId = auth.siteId
      const baseUrl = getTableauBaseUrl()
      const BAD_ORDER_SUMMARY_VIEW_ID = '235ac17d-2e73-46be-ba0a-6c4fef76e73e'

      const dataUrl = `${baseUrl}/api/${TABLEAU_API_VERSION}/sites/${siteId}/views/${BAD_ORDER_SUMMARY_VIEW_ID}/data?maxAge=1&includeAllColumns=true`
      const dataRes = await fetch(dataUrl, {
        method: 'GET',
        headers: { 'X-Tableau-Auth': token! },
      })
      const dataBody = await dataRes.text()
      const dataFirst300 = dataBody.substring(0, 300)

      const crosstabUrl = `${baseUrl}/api/${TABLEAU_API_VERSION}/sites/${siteId}/views/${BAD_ORDER_SUMMARY_VIEW_ID}/crosstab/export`
      const crosstabRes = await fetch(crosstabUrl, {
        method: 'POST',
        headers: {
          'X-Tableau-Auth': token!,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ format: 'excel' }),
      })
      const crosstabBody = await crosstabRes.text()
      const crosstabFirst300 = crosstabBody.substring(0, 300)

      return NextResponse.json({
        data_endpoint: { status: dataRes.status, response_first_300: dataFirst300 },
        crosstab_export: { status: crosstabRes.status, response_first_300: crosstabFirst300 },
      })
    }

    // PAT auth + BadOrderSummary with 4 filter variations — full raw CSV and auth status per attempt
    if (searchParams.get('test_pat_filters') === 'true') {
      let patStatus: { status: string; siteId?: string; error?: string } = { status: 'unknown' }
      try {
        const auth = await signInWithPat()
        token = auth.token
        siteId = auth.siteId
        patStatus = { status: 'success', siteId: auth.siteId }
      } catch (e) {
        patStatus = { status: 'failed', error: e instanceof Error ? e.message : String(e) }
        return NextResponse.json({ pat_auth: patStatus }, { status: 500 })
      }
      const BAD_ORDER_SUMMARY_VIEW_ID = '235ac17d-2e73-46be-ba0a-6c4fef76e73e'
      const filterAttempts = [
        { key: 'no_filters', extraParams: undefined as string | undefined },
        { key: 'vf_Week_W9_2026', extraParams: 'vf_Week=W9%202026' },
        { key: 'vf_Period_P03_2026', extraParams: 'vf_Period=P03%202026' },
        { key: 'vf_Week_and_vf_Period', extraParams: 'vf_Week=W9%202026&vf_Period=P03%202026' },
      ]
      const results = await Promise.all(
        filterAttempts.map((a) =>
          fetchViewDataProbe(token!, siteId!, BAD_ORDER_SUMMARY_VIEW_ID, TABLEAU_API_VERSION, undefined, a.extraParams)
        )
      )
      const out: Record<string, { status: number; raw_csv: string } | { status: string; siteId?: string; error?: string }> = {
        pat_auth: patStatus,
      }
      filterAttempts.forEach((a, i) => {
        out[a.key] = { status: results[i].status, raw_csv: results[i].raw }
      })
      return NextResponse.json(out)
    }

    const auth = await getTableauAuthToken()
    token = auth.token
    siteId = auth.siteId

    // List all views in the Zero, Bad, and Canceled workbook (no store required)
    if (searchParams.get('debugviews') === 'true') {
      const views = await getViews(token!, siteId!, ZERO_BAD_CANCELED_WORKBOOK_ID)
      if (token && siteId) await signOut(token, siteId)
      return NextResponse.json({
        workbook_id: ZERO_BAD_CANCELED_WORKBOOK_ID,
        workbook_name: 'Zero, Bad, and Canceled',
        views: views.map((v: any) => ({ id: v.id, name: v.name })),
      })
    }

    // Query Zeroed Out / Bad Order / Canceled Order Summary views with Tableau UI filters; return full raw CSV
    if (searchParams.get('summary_csv') === 'true') {
      const views = await getViews(token!, siteId!, ZERO_BAD_CANCELED_WORKBOOK_ID)
      const names = ['Zeroed Out Summary', 'Bad Order Summary', 'Canceled Order Summary']
      const summaryViews = names.map((name) => views.find((v: any) => (v.name || '').trim() === name)).filter(Boolean) as { id: string; name: string }[]
      if (summaryViews.length === 0) {
        if (token && siteId) await signOut(token, siteId)
        return NextResponse.json({
          error: 'Summary views not found',
          available_views: views.map((v: any) => ({ id: v.id, name: v.name })),
        }, { status: 404 })
      }
      const csvs = await Promise.all(
        summaryViews.map((v) => queryView(token!, siteId!, v.id, TABLEAU_UI_FILTERS, 'vf_'))
      )
      const out: Record<string, { raw_csv: string }> = {}
      summaryViews.forEach((v, i) => {
        out[v.name.replace(/\s+/g, '_').toLowerCase()] = { raw_csv: csvs[i] }
      })
      if (token && siteId) await signOut(token, siteId)
      return NextResponse.json(out)
    }

    // CSV download endpoint (Accept: text/csv, maxAge=1) for BadOrderSummary and ZeroedOutSummary — full raw response
    if (searchParams.get('csv_download') === 'true') {
      const [badOrderCsv, zeroedOutCsv] = await Promise.all([
        getViewDataCsv(token!, siteId!, '235ac17d-2e73-46be-ba0a-6c4fef76e73e', undefined, ''),
        getViewDataCsv(token!, siteId!, 'a73dd014-36b2-4da1-af90-55621b4ac0ab', undefined, ''),
      ])
      if (token && siteId) await signOut(token, siteId)
      return NextResponse.json({
        BadOrderSummary: badOrderCsv,
        ZeroedOutSummary: zeroedOutCsv,
      })
    }

    // Test BadOrderSummary: try multiple Accept headers and API versions (3.21 + 3.8); return status + raw for each
    if (searchParams.get('test_date_filters') === 'true') {
      const BAD_ORDER_SUMMARY_VIEW_ID = '235ac17d-2e73-46be-ba0a-6c4fef76e73e'
      const versions = ['3.21', '3.8']
      const acceptOptions: { key: string; value: string | undefined }[] = [
        { key: 'accept_text_csv', value: 'text/csv' },
        { key: 'accept_application_json', value: 'application/json' },
        { key: 'no_accept', value: undefined },
      ]
      const probes = versions.flatMap((ver) =>
        acceptOptions.map((opt) =>
          fetchViewDataProbe(token!, siteId!, BAD_ORDER_SUMMARY_VIEW_ID, ver, opt.value).then((r) => ({
            key: `v${ver.replace('.', '')}_${opt.key}`,
            ...r,
          }))
        )
      )
      const results = await Promise.all(probes)
      const out: Record<string, { url: string; status: number; raw: string }> = {}
      results.forEach((r) => {
        out[r.key] = { url: r.url, status: r.status, raw: r.raw }
      })
      if (token && siteId) await signOut(token, siteId)
      return NextResponse.json(out)
    }

    // Direct .csv URLs (Tableau view export) with Cookie + X-Tableau-Auth — return status and first 500 chars
    if (searchParams.get('test_direct_csv') === 'true') {
      const DIRECT_CSV_URLS = [
        'https://us-east-1.online.tableau.com/views/ZeroBadandCanceled/BadOrderSummary.csv',
        'https://us-east-1.online.tableau.com/views/ZeroBadandCanceled/BadOrderSummary.csv?:showVizHome=no&vf_Week=W9+2026',
      ]
      const [r1, r2] = await Promise.all(
        DIRECT_CSV_URLS.map((url) => fetchDirectCsvUrl(url, token!))
      )
      if (token && siteId) await signOut(token, siteId)
      return NextResponse.json({
        url1_no_params: r1,
        url2_with_week_filter: r2,
      })
    }

    if (!store) {
      return NextResponse.json({ error: 'Missing query param: store' }, { status: 400 })
    }

    const filters: Record<string, string> = { Store: store, Date: date }

    const debugcsv = searchParams.get('debugcsv') === 'true'
    if (debugcsv) {
      const DEBUG_BOZOCORO_VIEWS = [
        { name: 'ZeroedOutSummary', id: 'a73dd014-36b2-4da1-af90-55621b4ac0ab' },
        { name: 'ZeroedOutDetails', id: 'f43d5823-937c-4273-8aef-3e90a4f859a0' },
        { name: 'BadOrderSummary', id: '235ac17d-2e73-46be-ba0a-6c4fef76e73e' },
        { name: 'BadOrderDetails', id: '80a213a3-3ffa-433f-8ee4-b72c6fa6bb6d' },
        { name: 'CanceledOrderSummary', id: '1c468a1d-fdda-4abb-82aa-dea509b4139c' },
        { name: 'RefundOrderSummary', id: '7fe8f27b-3dac-4a50-aa88-d97ba1f425aa' },
      ]
      const attemptAFilters: Record<string, string> = {
        'vf_Year': '2026',
        'vf_Period': 'P03 2026',
        'vf_Week': 'W9 2026',
        'vf_Operated By': 'Franchise',
        'vf_Store Type': 'Traditional',
        'vf_DMA': 'Los Angeles, CA',
        'vf_DVP': 'Daniel Collinsworth',
      }
      const queries = DEBUG_BOZOCORO_VIEWS.flatMap((v) => [
        queryView(token!, siteId!, v.id, attemptAFilters, ''),
        queryView(token!, siteId!, v.id, undefined, ''),
      ])
      const results = await Promise.all(queries)
      const out: Record<string, { attempt_a: string; attempt_b: string }> = {}
      DEBUG_BOZOCORO_VIEWS.forEach((v, i) => {
        out[v.name] = {
          attempt_a: results[i * 2],
          attempt_b: results[i * 2 + 1],
        }
      })
      if (token && siteId) await signOut(token, siteId)
      return NextResponse.json(out)
    }

    const csvResults = await Promise.all(
      BOZOCORO_VIEWS.map(({ viewId }) => queryView(token!, siteId!, viewId, filters, ''))
    )

    const zeroedRows = parseCSV(csvResults[0])
    const badRows = parseCSV(csvResults[1])
    const cancelledRows = parseCSV(csvResults[2])
    const refundRows = parseCSV(csvResults[3])

    const zeroed_out = buildSummaryAndDetails(zeroedRows, true)
    const bad_orders = buildSummaryAndDetails(badRows, false)
    const cancelled = buildSummaryAndDetails(cancelledRows, false)
    const refunds = buildSummaryAndDetails(refundRows, false)

    if (token && siteId) await signOut(token, siteId)

    return NextResponse.json({
      store_number: store,
      date,
      zeroed_out,
      bad_orders,
      cancelled,
      refunds,
    })
  } catch (err) {
    if (token && siteId) {
      try {
        await signOut(token, siteId)
      } catch (_) {}
    }
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
