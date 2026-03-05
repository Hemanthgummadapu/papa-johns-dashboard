/**
 * Tableau REST API client for Papa Johns dashboard.
 * Handles authentication (Personal Access Token) and data fetching.
 */

export const TABLEAU_VIEW_IDS = {
  // Store Leadership Dashboard
  storeLeadershipFranchise: 'c659c524-9dbf-4bbd-a2b4-d16ae205f7eb',

  // Zero, Bad, and Canceled
  zeroedOutSummary: 'a73dd014-36b2-4da1-af90-55621b4ac0ab',
  zeroedOutDetails: 'f43d5823-937c-4273-8aef-3e90a4f859a0',
  badOrderSummary: '235ac17d-2e73-46be-ba0a-6c4fef76e73e',
  badOrderDetails: '80a213a3-3ffa-433f-8ee4-b72c6fa6bb6d',
  canceledOrderSummary: '1c468a1d-fdda-4abb-82aa-dea509b4139c',
  canceledOrderDetails: '7e2ec3c6-4ca6-47cd-a5f2-f7a08b5c785a',
  refundOrderSummary: '7fe8f27b-3dac-4a50-aa88-d97ba1f425aa',
  refundOrderDetails: 'bc43483e-48ee-4fb7-a4b1-575111728e5c',

  // ProfitKeeper
  profitKeeper: 'a10fd478-29bb-44a8-8d99-b20b58aaa187',
}

export const TABLEAU_CONFIG = {
  serverUrl: process.env.TABLEAU_SERVER_URL, // e.g. https://10ax.online.tableau.com
  siteName: process.env.TABLEAU_SITE_NAME ?? '', // site content URL (empty string if default)
  tokenName: process.env.TABLEAU_TOKEN_NAME, // Personal Access Token name
  tokenSecret: process.env.TABLEAU_TOKEN_SECRET, // Personal Access Token secret
}

const API_VERSION = '3.21'

function getBaseUrl(): string {
  const url = TABLEAU_CONFIG.serverUrl?.replace(/\/$/, '')
  if (!url) throw new Error('TABLEAU_SERVER_URL is not set')
  return url
}

/**
 * Sign in with Personal Access Token. Returns token and siteId for subsequent requests.
 */
export async function getTableauAuthToken(): Promise<{ token: string; siteId: string }> {
  const baseUrl = getBaseUrl()
  const tokenName = TABLEAU_CONFIG.tokenName
  const tokenSecret = TABLEAU_CONFIG.tokenSecret
  if (!tokenName || !tokenSecret) throw new Error('TABLEAU_TOKEN_NAME and TABLEAU_TOKEN_SECRET must be set')

  const res = await fetch(`${baseUrl}/api/${API_VERSION}/auth/signin`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      credentials: {
        personalAccessTokenName: tokenName,
        personalAccessTokenSecret: tokenSecret,
        site: { contentUrl: TABLEAU_CONFIG.siteName },
      },
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Tableau signin failed: ${res.status} ${res.statusText} - ${text}`)
  }

  const responseText = await res.text()
  console.log('Tableau signin raw response:', responseText.substring(0, 500))
  let data: any
  try {
    data = JSON.parse(responseText)
  } catch {
    const err = new Error('Tableau returned unexpected format') as Error & { raw?: string }
    err.raw = responseText
    throw err
  }
  const token = data?.credentials?.token
  const siteId = data?.credentials?.site?.id
  if (!token || !siteId) throw new Error('Tableau signin response missing token or site.id')
  return { token, siteId }
}

/**
 * List workbooks on the site.
 */
export async function getWorkbooks(token: string, siteId: string): Promise<any[]> {
  const baseUrl = getBaseUrl()
  const res = await fetch(`${baseUrl}/api/${API_VERSION}/sites/${siteId}/workbooks`, {
    headers: { 'X-Tableau-Auth': token, 'Accept': 'application/json' },
  })
  if (!res.ok) throw new Error(`Tableau getWorkbooks failed: ${res.status} ${res.statusText}`)
  const responseText = await res.text()
  console.log('Tableau getWorkbooks raw response:', responseText.substring(0, 500))
  let data: any
  try {
    data = JSON.parse(responseText)
  } catch {
    const err = new Error('Tableau returned unexpected format') as Error & { raw?: string }
    err.raw = responseText
    throw err
  }
  const workbooks = data?.workbooks?.workbook ?? []
  return Array.isArray(workbooks) ? workbooks : [workbooks]
}

/**
 * List views for a workbook.
 */
export async function getViews(token: string, siteId: string, workbookId: string): Promise<any[]> {
  const baseUrl = getBaseUrl()
  const res = await fetch(`${baseUrl}/api/${API_VERSION}/sites/${siteId}/workbooks/${workbookId}/views`, {
    headers: { 'X-Tableau-Auth': token, 'Accept': 'application/json' },
  })
  if (!res.ok) throw new Error(`Tableau getViews failed: ${res.status} ${res.statusText}`)
  const responseText = await res.text()
  console.log('Tableau getViews raw response:', responseText.substring(0, 500))
  let data: any
  try {
    data = JSON.parse(responseText)
  } catch {
    const err = new Error('Tableau returned unexpected format') as Error & { raw?: string }
    err.raw = responseText
    throw err
  }
  const views = data?.views?.view ?? []
  return Array.isArray(views) ? views : [views]
}

/**
 * Get view data as CSV. Optional filters as query params.
 * @param filterPrefix - Prefix for filter param names (e.g. 'vf_' for vf_Store=2081). Use '' to send filter names as-is.
 */
export async function queryView(
  token: string,
  siteId: string,
  viewId: string,
  filters?: Record<string, string>,
  filterPrefix: string = 'vf_'
): Promise<string> {
  const baseUrl = getBaseUrl()
  const params = new URLSearchParams()
  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      const paramName = filterPrefix ? filterPrefix + key : key
      params.set(paramName, value)
    })
  }
  const query = params.toString()
  const url = `${baseUrl}/api/${API_VERSION}/sites/${siteId}/views/${viewId}/data${query ? `?${query}` : ''}`
  const res = await fetch(url, {
    headers: { 'X-Tableau-Auth': token, 'Accept': 'application/json' },
  })
  if (!res.ok) throw new Error(`Tableau queryView failed: ${res.status} ${res.statusText}`)
  return res.text()
}

/**
 * Get view data as CSV using the download endpoint (Accept: text/csv).
 * Use this for underlying CSV data instead of chart/image endpoints.
 * Optional filters appended as query params; maxAge=1 is always added.
 */
export async function getViewDataCsv(
  token: string,
  siteId: string,
  viewId: string,
  filters?: Record<string, string>,
  filterPrefix: string = 'vf_'
): Promise<string> {
  const baseUrl = getBaseUrl()
  const params = new URLSearchParams()
  params.set('maxAge', '1')
  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      const paramName = filterPrefix ? filterPrefix + key : key
      params.set(paramName, value)
    })
  }
  const query = params.toString()
  const url = `${baseUrl}/api/${API_VERSION}/sites/${siteId}/views/${viewId}/data?${query}`
  const res = await fetch(url, {
    headers: { 'X-Tableau-Auth': token, 'Accept': 'text/csv' },
  })
  if (!res.ok) throw new Error(`Tableau getViewDataCsv failed: ${res.status} ${res.statusText}`)
  return res.text()
}

/**
 * Sign out and invalidate the token.
 */
export async function signOut(token: string, siteId: string): Promise<void> {
  const baseUrl = getBaseUrl()
  await fetch(`${baseUrl}/api/${API_VERSION}/auth/signout`, {
    method: 'POST',
    headers: {
      'X-Tableau-Auth': token,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  })
}
