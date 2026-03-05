import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
  
  const { data, error } = await supabase
    .from('live_kpi')
    .select('*')
    .order('scraped_at', { ascending: false })
    .limit(6)
  
  if (error) {
    console.log('live_kpi error:', error.message)
  } else {
    console.log('live_kpi rows:', data?.length)
    data?.forEach(r => console.log(`  Store ${r.store_number} | scraped=${r.scraped_at} | sales=$${r.total_net_sales}`))
  }

  // Also check what table the scrape-extranet route writes to
}
main().catch(console.error)
