import { getSupabaseAdminClient } from '@/lib/db'
import SMGDashboard from './SMGDashboard'

export interface SMGScore {
  id: string
  store_id: string
  period: string
  scraped_at: string
  focus_accuracy_current: number | null
  focus_accuracy_vs_previous: number | null
  focus_wait_time_current: number | null
  focus_wait_time_vs_previous: number | null
  osat_my_score: number | null
  osat_vs_last_period: number | null
  osat_pj_score: number | null
  osat_vs_pj: number | null
  accuracy_my_score: number | null
  accuracy_vs_last_period: number | null
  accuracy_pj_score: number | null
  accuracy_vs_pj: number | null
  csc_my_score: number | null
  csc_vs_last_period: number | null
  csc_pj_score: number | null
  csc_vs_pj: number | null
  comp_orders_my_score: number | null
  comp_orders_vs_last_period: number | null
  comp_orders_pj_score: number | null
  comp_orders_vs_pj: number | null
  comp_sales_my_score: number | null
  comp_sales_vs_last_period: number | null
  comp_sales_pj_score: number | null
  comp_sales_vs_pj: number | null
  ranking_store_responses: number | null
  ranking_store_osat: number | null
  ranking_store_taste_of_food: number | null
  ranking_store_accuracy_of_order: number | null
  ranking_store_wait_time: number | null
  ranking_store_friendliness: number | null
  ranking_pj_responses: number | null
  ranking_pj_osat: number | null
  ranking_pj_taste_of_food: number | null
  ranking_pj_accuracy_of_order: number | null
  ranking_pj_wait_time: number | null
  ranking_pj_friendliness: number | null
}

export default async function SMGPage() {
  let data: SMGScore[] = []
  let lastScraped: string | null = null

  try {
    const supabase = getSupabaseAdminClient()
    const { data: scores, error } = await supabase
      .from('smg_scores')
      .select('*')
      .eq('period', 'current')
      .order('store_id', { ascending: true })

    if (error) {
      console.error('Error fetching SMG scores:', error)
    } else {
      data = scores || []
      // Get the most recent scraped_at timestamp
      if (data.length > 0) {
        const timestamps = data
          .map(d => d.scraped_at)
          .filter(Boolean)
          .sort()
          .reverse()
        lastScraped = timestamps[0] || null
      }
    }
  } catch (error) {
    console.error('Error in SMG page:', error)
  }

  return <SMGDashboard data={data} lastScraped={lastScraped} />
}

