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
    .select('store_number, scraped_at, net_sales, labor_pct')
    .order('scraped_at', { ascending: false })
    .limit(12)
  
  console.log('Latest data in Supabase:')
  data?.forEach(r => console.log(`  Store ${r.store_number}: scraped_at=${r.scraped_at} sales=$${r.net_sales} labor=${r.labor_pct}%`))
}
main().catch(console.error)
