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
    .from('realtime_summary')
    .select('*')
    .order('scraped_at', { ascending: false })
  
  console.log('All rows in realtime_summary:')
  data?.forEach(r => console.log(`  Store ${r.store_number} | date=${r.date} | scraped=${r.scraped_at} | sales=$${r.total_net_sales} | labor=${r.labor_pct}%`))
  
  // Check what live-data API route reads
  console.log('\nChecking live-data API route file:')
}
main().catch(console.error)
