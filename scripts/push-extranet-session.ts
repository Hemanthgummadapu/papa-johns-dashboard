/**
 * Push local extranet-session.json to Supabase settings (key: extranet_session_state).
 * Run from repo root: npx tsx scripts/push-extranet-session.ts
 * Or with explicit path: node -e "..." (see README or cron docs)
 */
import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

async function main() {
  const path = process.argv[2] || './extranet-session.json'
  if (!fs.existsSync(path)) {
    console.error('File not found:', path)
    process.exit(1)
  }

  const session = fs.readFileSync(path, 'utf-8')
  const parsed = JSON.parse(session)
  console.log('Cookie count:', parsed.cookies?.length)
  console.log('First domain:', parsed.cookies?.[0]?.domain)

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const { error } = await supabase
    .from('settings')
    .upsert(
      {
        key: 'extranet_session_state',
        value: session,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key' }
    )

  if (error) {
    console.error('Failed:', error)
    process.exit(1)
  }
  console.log('✅ Extranet session pushed to Supabase (key: extranet_session_state)')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
