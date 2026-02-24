export interface SMGStoreData {
  store_number: string
  period: 'current' | 'previous'
  date: string
  period_start_date: string | null
  period_end_date: string | null
  responses: number | null
  osat: number | null
  osat_vs_last_period: number | null
  osat_vs_papa_johns: number | null
  taste_of_food: number | null
  taste_vs_papa_johns: number | null
  accuracy_of_order: number | null
  accuracy_vs_last_period: number | null
  accuracy_vs_papa_johns: number | null
  wait_time: number | null
  wait_time_vs_papa_johns: number | null
  driver_friendliness: number | null
  driver_vs_papa_johns: number | null
  pj_osat: number | null
  pj_taste: number | null
  pj_accuracy: number | null
  pj_wait_time: number | null
  pj_driver: number | null
  scraped_at: string
}
