import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
  
  const { data } = await supabase
    .from('hotschedules_labor')
    .select('week, week_bd, total_actual_hours, total_scheduled_hours')
    .order('week_bd', { ascending: false })
    .limit(30)
  
  // Show unique weeks and whether they have actual data
  const weekMap = new Map<string, { scheduled: number, actual: number }>()
  for (const row of data ?? []) {
    const existing = weekMap.get(row.week) ?? { scheduled: 0, actual: 0 }
    weekMap.set(row.week, {
      scheduled: existing.scheduled + (row.total_scheduled_hours ?? 0),
      actual: existing.actual + (row.total_actual_hours ?? 0)
    })
  }
  
  console.log('Week | Total Scheduled | Total Actual | Has Real Data?')
  Array.from(weekMap.entries()).forEach(([week, totals]) => {
    const hasData = totals.actual > 0
    console.log(`${week} | ${totals.scheduled}h | ${totals.actual}h | ${hasData ? '✅' : '❌ no actuals yet'}`)
  })
}
main().catch(console.error)
