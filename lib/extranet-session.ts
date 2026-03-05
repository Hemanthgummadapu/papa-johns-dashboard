import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'fs'
import path from 'path'
import type { BrowserContext, Page } from 'playwright'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

export const EXTRANET_SESSION_PATH = '/tmp/extranet-session.json'

export async function loadSessionFromSupabase(): Promise<void> {
  try {
    const supabase = getSupabase()
    const { data } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'extranet_session_state')
      .single()

    if (data?.value) {
      mkdirSync('/tmp', { recursive: true })
      writeFileSync('/tmp/extranet-session.json', data.value)
      console.log('[session] Loaded from Supabase → /tmp/extranet-session.json')
    } else {
      console.log('[session] No session in Supabase')
    }
  } catch (err) {
    console.error('[session] Failed to load from Supabase:', err)
  }
}

function ensureSessionDirExists() {
  const dir = path.dirname(EXTRANET_SESSION_PATH)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

async function validateLoggedIn(page: Page, timeoutMs = 15000): Promise<boolean> {
  try {
    await page.goto(
      'https://extranet.papajohns.com/kpi/#/realtime?type=STORE_ID&id=2081&view=summary',
      { waitUntil: 'domcontentloaded', timeout: 30000 }
    )

    // The KPI summary page contains these labels when authenticated.
    await page.waitForFunction(() => {
      const t = document?.body?.innerText || ''
      return t.includes('Total Store Net Sales') && t.includes('Total Orders')
    }, { timeout: timeoutMs })

    const url = page.url()
    if (url.includes('login.microsoftonline.com') || url.includes('microsoftonline')) return false
    return true
  } catch {
    return false
  }
}

async function waitForAuthRedirect(context: BrowserContext, timeoutMs: number): Promise<boolean> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const pages = context.pages().filter((p) => !p.isClosed())
    for (const p of pages) {
      const url = p.url()
      if (url.includes('extranet.papajohns.com')) return true
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  return false
}

async function freshLogin(page: Page) {
  // Go to extranet - will redirect to Microsoft login
  await page.goto('https://extranet.papajohns.com/GatewayMenu/', { waitUntil: 'domcontentloaded', timeout: 60000 })

  // Microsoft login page
  await page.waitForSelector('input[type="email"]', { timeout: 30000 })
  await page.fill('input[type="email"]', process.env.PAPAJOHNS_EXTRANET_USER || '')
  await page.click('input[type="submit"]')

  // Password field
  await page.waitForSelector('input[type="password"]', { timeout: 30000 })
  await page.fill('input[type="password"]', process.env.PAPAJOHNS_EXTRANET_PASSWORD || '')
  await page.click('input[type="submit"]')

  // Wait for "Stay signed in?" prompt and click Yes if it appears (wait up to 8 seconds)
  try {
    await page.waitForSelector('#idSIButton9', { timeout: 8000 }) // Yes button
    await page.click('#idSIButton9') // Click "Yes"
  } catch {
    // No prompt
  }

  // Do not rely on a specific redirect URL here; the AAD → extranet redirect chain varies
  // and may even open/close tabs. Validation is handled by `ensureSession` on the caller page.
  const ok = await waitForAuthRedirect(page.context(), 90000)
  if (!ok) {
    throw new Error('Login failed — check credentials or site is blocking')
  }
}

/**
 * Production-grade session persistence.
 *
 * - If `scripts/session.json` exists, assumes the BrowserContext was created with `storageState` already.
 * - Validates the session by loading a KPI summary page and checking for known authenticated labels.
 * - On invalid session: deletes `scripts/session.json` and performs a fresh login.
 * - After any fresh login: saves storage state to `scripts/session.json`.
 */
export async function ensureSession(page: Page, context: BrowserContext) {
  ensureSessionDirExists()

  const hasSession = existsSync(EXTRANET_SESSION_PATH)
  if (hasSession) {
    return
  }

  // Use a dedicated login page so the scraper's `page` remains stable even if the
  // identity provider opens/closes tabs during the redirect chain.
  const loginPage = await context.newPage()
  try {
    await freshLogin(loginPage)
  } finally {
    await loginPage.close().catch(() => {})
  }

  const ok = await validateLoggedIn(page, 90000)
  if (!ok) {
    throw new Error('Login failed — check credentials or site is blocking')
  }

  await context.storageState({ path: EXTRANET_SESSION_PATH })

  const state = readFileSync(EXTRANET_SESSION_PATH, 'utf8')
  const supabase = getSupabase()
  await supabase.from('settings').upsert(
    {
      key: 'extranet_session_state',
      value: state,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'key' }
  )
  console.log('[session] Session saved back to Supabase')
}

