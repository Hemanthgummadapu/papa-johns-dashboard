import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
  
  const session = fs.readFileSync('scripts/session.json', 'utf8')
  
  const { error } = await supabase.from('settings').upsert({
    key: 'extranet_session_state',
    value: session,
    updated_at: new Date().toISOString()
  }, { onConflict: 'key' })
  
  if (error) {
    console.error('Failed:', error)
  } else {
    console.log('✅ Session seeded to Supabase successfully')
  }
}
main().catch(console.error)
