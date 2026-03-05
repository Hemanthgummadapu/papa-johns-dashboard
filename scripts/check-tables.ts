import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
  
  const tables = ['realtime_summary', 'live_data', 'store_snapshots', 'extranet_data', 'daily_snapshots', 'store_data']
  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('*').limit(2)
    if (!error && data) {
      console.log(`✅ ${table}: ${data.length} rows, cols: ${data[0] ? Object.keys(data[0]).join(', ') : 'empty'}`)
    } else {
      console.log(`❌ ${table}: ${error?.message}`)
    }
  }
}
main().catch(console.error)
