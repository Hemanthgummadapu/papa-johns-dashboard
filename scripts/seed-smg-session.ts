import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import * as dotenv from 'dotenv'

dotenv.config({ path: path.join(process.cwd(), '.env.local') })

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
  const sessionPath = path.join(process.cwd(), 'smg-session.json')
  const session = fs.readFileSync(sessionPath, 'utf8')
  const { error } = await supabase.from('settings').upsert(
    {
      key: 'smg_session_state',
      value: session,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'key' }
  )
  if (error) console.error('Failed:', error)
  else console.log('✅ SMG session seeded to Supabase')
}
main().catch(console.error)
