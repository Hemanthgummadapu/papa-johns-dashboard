import { getSupabaseAdminClient } from '@/lib/db'
import { loadSMGSessionFromSupabase } from '@/lib/smg-browser'
import { chromium } from 'playwright'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

function generateCommentId(storeId: string, commentText: string): string {
  const text = `${storeId}-${commentText.slice(0, 80)}`;
  return Buffer.from(text).toString('base64').slice(0, 64);
}

export async function GET(request: Request) {
  const apiKey = request.headers.get('x-api-key')
  const expectedKey = process.env.SCRAPER_API_KEY
  if (expectedKey && apiKey !== expectedKey) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await loadSMGSessionFromSupabase()

    const browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    })

    try {
      const { readFileSync } = await import('fs')
      const session = JSON.parse(readFileSync('/tmp/smg-session.json', 'utf-8'))
      const context = await browser.newContext()
      await context.addCookies(session.cookies || session)
      const page = await context.newPage()

      await page.goto('https://reporting.smg.com/dashboard.aspx?id=5', {
        waitUntil: 'domcontentloaded', timeout: 30000
      })
      await page.waitForTimeout(3000)

      for (const selector of ['text=Comments', 'a:has-text("Comments")', 'button:has-text("Comments")']) {
        try {
          const tab = await page.locator(selector).first()
          const isVisible = await tab.isVisible({ timeout: 2000 }).catch(() => false)
          if (isVisible) { await tab.click(); break; }
        } catch { continue }
      }

      await page.waitForFunction(() => {
        const hasAngular = document.querySelector('[ng-app], comment-report-item, .comment-list')
        const jqReady = !(window as any).jQuery || (window as any).jQuery.active === 0
        return !!(hasAngular && jqReady)
      }, { timeout: 20000 }).catch(() => {})

      await page.waitForSelector('.comment-list, comment-report-item', {
        timeout: 15000, state: 'attached'
      }).catch(() => {})
      await page.waitForTimeout(3000)

      const comments = await page.evaluate(() => {
        const cssPatterns = [/\{/, /color\s*:/, /!important/, /--[a-z-]+:/, /background\s*:/, /rgba?\(/, /@media/]
        const items = Array.from(document.querySelectorAll('comment-report-item'))
        let currentDate: string | null = null
        const results: any[] = []

        for (const item of items) {
          let itemDate: string | null = currentDate
          let parent = item.parentElement
          while (parent && !itemDate) {
            const dl = parent.querySelector('.day-label')
            if (dl && /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dl.textContent?.trim() || '')) {
              itemDate = dl.textContent!.trim(); currentDate = itemDate
            }
            parent = parent.parentElement
          }

          const storeId = item.querySelector('.smg-report-item-left')?.textContent?.trim() || null
          const surveyType = item.querySelector('.smg-report-item-right')?.textContent?.trim() || null

          let rawText = ''
          for (const sel of ['.smg-report-item-text', '.smg-report-item-partial-multiple p', '.smg-report-item-partial-multiple']) {
            const el = item.querySelector(sel)
            if (el) { rawText = el.textContent?.trim() || ''; if (rawText.length > 5) break }
          }
          if (!rawText || rawText.length < 5 || cssPatterns.some(p => p.test(rawText))) continue

          let cleaned = rawText
          const vmIdx = cleaned.search(/View\s*More/i)
          if (vmIdx > -1) cleaned = cleaned.substring(0, vmIdx).trim()
          cleaned = cleaned.replace(/View\s*Less/gi, '').trim()
          const tIdx = cleaned.search(/Topics\s*:/i)
          if (tIdx > -1) cleaned = cleaned.substring(0, tIdx).trim()

          let category = null
          const firstLine = cleaned.split('\n')[0]?.trim() || ''
          if (/^Compliment/i.test(firstLine)) { category = 'Compliment'; cleaned = cleaned.replace(/^Compliment\s*:?\s*/i, '').trim() }
          else if (/^Complaint/i.test(firstLine)) { category = 'Complaint'; cleaned = cleaned.replace(/^Complaint\s*:?\s*/i, '').trim() }
          else if (/^Suggestion/i.test(firstLine)) { category = 'Suggestion'; cleaned = cleaned.replace(/^Suggestion\s*:?\s*/i, '').trim() }

          if (storeId && cleaned.length > 5) {
            results.push({ store_id: storeId, comment_date: itemDate, survey_type: surveyType, category, comment_text: cleaned })
          }
        }
        return results.slice(0, 20)
      })

      await browser.close()

      if (comments.length === 0) {
        return Response.json({ success: true, comments: 0, message: 'No comments found' })
      }

      const supabase = getSupabaseAdminClient()
      const toUpsert = comments.map((c: any) => ({
        comment_id: generateCommentId(c.store_id || '', c.comment_text || ''),
        store_id: c.store_id,
        comment_date: c.comment_date || null,
        survey_type: c.survey_type,
        category: c.category,
        comment_text: c.comment_text,
        scraped_at: new Date().toISOString()
      }))

      const { error } = await supabase.from('smg_comments').upsert(toUpsert, { onConflict: 'comment_id' })
      if (error) throw new Error(error.message)

      return Response.json({ success: true, comments: toUpsert.length })

    } catch (err) {
      await browser.close()
      throw err
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return Response.json({ success: false, error: message }, { status: 500 })
  }
}
