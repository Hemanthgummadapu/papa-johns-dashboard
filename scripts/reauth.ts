// Run this once manually when session expires: npm run reauth

import { chromium } from 'playwright'
import { existsSync, mkdirSync } from 'fs'
import path from 'path'

const SESSION_FILE = path.join(process.cwd(), 'scripts', 'session.json')

function ensureDir() {
  const dir = path.dirname(SESSION_FILE)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

async function main() {
  ensureDir()

  console.log('=== Extranet re-auth (manual MFA) ===')
  console.log('A browser window will open. Complete Microsoft login + MFA.\n')

  const browser = await chromium.launch({
    headless: false,
    slowMo: 250,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  })

  const context = await browser.newContext()
  const page = await context.newPage()

  try {
    await page.goto('https://extranet.papajohns.com/GatewayMenu/', {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    })

    console.log('[SESSION] Complete Microsoft login + MFA in the browser window.')
    console.log('[SESSION] Waiting for redirect to extranet (up to 5 minutes)…')

    // IMPORTANT: Do NOT navigate or submit anything while the user is typing OTP.
    // Just wait for the URL to become the extranet domain, giving the user up to 5 minutes.
    try {
      await page.waitForURL('**/extranet.papajohns.com/**', { timeout: 5 * 60 * 1000 })
      await context.storageState({ path: SESSION_FILE })
      console.log('[SESSION] Auth complete — session saved. You won’t need to do this again until Microsoft expires it.')
    } catch {
      console.log('[SESSION] Timed out waiting — try npm run reauth again')
    }
  } finally {
    await browser.close()
  }
}

main().catch((err) => {
  console.error(err?.message || err)
  process.exit(1)
})

