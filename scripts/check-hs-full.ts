import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
  
  const { data, count } = await supabase
    .from('hotschedules_labor')
    .select('*', { count: 'exact' })
    .order('week_bd', { ascending: false })
  
  console.log('Total records in DB:', count)
  console.log('\nAll weeks in DB:')
  const weeks = Array.from(new Set(data?.map(r => r.week) ?? [])).sort()
  weeks.forEach(w => {
    const stores = data?.filter(r => r.week === w).map(r => r.store_number)
    console.log(`  ${w}: ${stores?.length} stores ${stores?.join(', ')}`)
  })
}
main().catch(console.error)
