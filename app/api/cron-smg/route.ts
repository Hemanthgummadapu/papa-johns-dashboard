import { getSupabaseAdminClient } from '@/lib/db'
import { getSMGAuthenticatedPage, loadSMGSessionFromSupabase } from '@/lib/smg-browser'
import { scrapeSMG } from '@/lib/smg-scraper'
import type { SMGStoreData } from '@/types/smg'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

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

  try {
    await loadSMGSessionFromSupabase()
    const { browser, page } = await getSMGAuthenticatedPage()
    try {
      const { data } = await scrapeSMG(page, 'current')
      const supabase = getSupabaseAdminClient()
      for (const row of data) {
        await supabase.from('smg_scores').upsert(mapToSmgScoresRow(row), {
          onConflict: 'store_id,period',
        })
      }
      await browser.close()
      return Response.json({
        success: true,
        stores: data.length,
        message: 'SMG scrape completed successfully',
      })
    } catch (err) {
      await browser.close()
      throw err
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return Response.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
