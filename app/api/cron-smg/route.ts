import { chromium } from 'playwright'
import { writeFileSync, readFileSync, mkdirSync } from 'fs'
import { getSupabaseAdminClient } from '@/lib/db'
import { scrapeSMG } from '@/lib/smg-scraper'
import type { SMGStoreData } from '@/types/smg'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

const EXTRANET_SESSION_PATH = '/tmp/extranet-session.json'
const SMG_SESSION_PATH = '/tmp/smg-session.json'

function mapToSmgScoresRow(d: SMGStoreData): Record<string, unknown> {
  return {
    store_id: d.store_number,
    period: 'current',
    scraped_at: d.scraped_at,
    ranking_store_responses: d.responses,
    ranking_store_osat: d.osat,
    ranking_store_taste_of_food: d.taste_of_food,
    ranking_store_accuracy_of_order: d.accuracy_of_order,
    ranking_store_wait_time: d.wait_time,
    ranking_store_friendliness: d.driver_friendliness,
    ranking_pj_osat: d.pj_osat,
    ranking_pj_taste_of_food: d.pj_taste,
    ranking_pj_accuracy_of_order: d.pj_accuracy,
    ranking_pj_wait_time: d.pj_wait_time,
    ranking_pj_friendliness: d.pj_driver,
    osat_my_score: d.osat,
    osat_vs_last_period: d.osat_vs_last_period,
    osat_pj_score: d.pj_osat,
    osat_vs_pj: d.osat_vs_papa_johns,
    accuracy_my_score: d.accuracy_of_order,
    accuracy_vs_last_period: d.accuracy_vs_last_period,
    accuracy_pj_score: d.pj_accuracy,
    accuracy_vs_pj: d.accuracy_vs_papa_johns,
  }
}

export async function GET(request: Request) {
  const apiKey = request.headers.get('x-api-key')
  const expectedKey = process.env.SCRAPER_API_KEY
  if (expectedKey && apiKey !== expectedKey) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null

  try {
    // 1. Load extranet session from Supabase into /tmp/extranet-session.json
    const supabase = getSupabaseAdminClient()
    const { data: extranetRow } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'extranet_session_state')
      .single()

    if (!extranetRow?.value) {
      return Response.json(
        { success: false, error: 'Extranet session not found in settings (key: extranet_session_state)' },
        { status: 500 }
      )
    }

    mkdirSync('/tmp', { recursive: true })
    writeFileSync(EXTRANET_SESSION_PATH, extranetRow.value)

    // 2. Launch Playwright
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    })

    // 3. Create context with extranet storage state
    const context = await browser.newContext({ storageState: EXTRANET_SESSION_PATH })
    const page = await context.newPage()

    try {
      // 4. Navigate to extranet gateway
      await page.goto('https://extranet.papajohns.com/GatewayMenu/#/GATEWAY', {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      })
      await page.waitForTimeout(3000)

      // 5. Find and click PIE - Powered by SMG link via evaluate
      await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a'))
        const pieSmg = links.find(
          (a) => a.textContent?.includes('PIE') && a.textContent?.includes('SMG')
        )
        if (!pieSmg) throw new Error('PIE - SMG link not found')
        ;(pieSmg as HTMLElement).click()
      })

      // 6. Wait for SMG redirect
      await page.waitForURL('**/reporting.smg.com/**', { timeout: 60000 })
      await page.waitForTimeout(3000)

      // 7. Run scrape with the same page (already on SMG)
      const { data } = await scrapeSMG(page, 'current')

      // 8. Save results to smg_scores
      for (const row of data) {
        await supabase.from('smg_scores').upsert(mapToSmgScoresRow(row), {
          onConflict: 'store_id,period',
        })
      }

      // 9. Save fresh SMG context to file then to Supabase (key: smg_session_state)
      await context.storageState({ path: SMG_SESSION_PATH })
      const smgSessionJson = readFileSync(SMG_SESSION_PATH, 'utf-8')
      await supabase
        .from('settings')
        .upsert(
          {
            key: 'smg_session_state',
            value: smgSessionJson,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'key' }
        )

      return Response.json({
        success: true,
        stores: data.length,
        message: 'SMG scrape completed successfully',
      })
    } finally {
      await context.close()
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return Response.json(
      { success: false, error: message },
      { status: 500 }
    )
  } finally {
    if (browser) await browser.close()
  }
}
