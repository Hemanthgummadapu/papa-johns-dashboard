/**
 * Diagnostic script for audit_details — Last Year data.
 * Run: npx tsx scripts/audit-diagnostics.ts
 * Requires .env.local with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
 */
import 'dotenv/config'
import { config } from 'dotenv'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'

config({ path: resolve(process.cwd(), '.env.local') })

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(url, serviceKey)

async function run() {
  console.log('=== 1. Row counts by type and period ===\n')
  const { data: allRows, error: e1 } = await supabase
    .from('audit_details')
    .select('audit_type, time_period_label, amount')
  if (e1) {
    console.error('Error:', e1.message)
    return
  }
  const byTypePeriod = new Map<string, { count: number; total: number }>()
  for (const r of allRows ?? []) {
    const key = `${r.audit_type}\t${r.time_period_label ?? '(null)'}`
    const cur = byTypePeriod.get(key) ?? { count: 0, total: 0 }
    cur.count += 1
    cur.total += Number(r.amount) || 0
    byTypePeriod.set(key, cur)
  }
  const sorted = Array.from(byTypePeriod.entries()).sort((a, b) => {
    const [_, periodA] = a[0].split('\t')
    const [__, periodB] = b[0].split('\t')
    return (periodA || '').localeCompare(periodB || '') || a[0].localeCompare(b[0])
  })
  for (const [key, v] of sorted) {
    const [auditType, timePeriod] = key.split('\t')
    console.log(`${auditType}\t${timePeriod}\trows=${v.count}\ttotal=${v.total.toFixed(2)}`)
  }

  console.log('\n=== 2. Bad orders exist for last_year? (by store and type) ===\n')
  const { data: lastYear, error: e2 } = await supabase
    .from('audit_details')
    .select('store_number, audit_type')
    .eq('time_period_label', 'last_year')
  if (e2) {
    console.error('Error:', e2.message)
    return
  }
  const byStoreType = new Map<string, number>()
  for (const r of lastYear ?? []) {
    const key = `${r.store_number}\t${r.audit_type}`
    byStoreType.set(key, (byStoreType.get(key) ?? 0) + 1)
  }
  const sorted2 = Array.from(byStoreType.entries()).sort()
  if (sorted2.length === 0) {
    console.log('(no rows with time_period_label = last_year)')
  } else {
    for (const [key, count] of sorted2) {
      const [store, auditType] = key.split('\t')
      console.log(`store=${store}\taudit_type=${auditType}\tcount=${count}`)
    }
  }

  console.log('\n=== 3. Sample last_year zeroed_out (limit 5) ===\n')
  const { data: zeroed, error: e3 } = await supabase
    .from('audit_details')
    .select('*')
    .eq('time_period_label', 'last_year')
    .eq('audit_type', 'zeroed_out')
    .limit(5)
  if (e3) {
    console.error('Error:', e3.message)
    return
  }
  console.log(JSON.stringify(zeroed ?? [], null, 2))

  console.log('\n=== 4. Sample last_year bad_order (limit 5) ===\n')
  const { data: badOrder, error: e4 } = await supabase
    .from('audit_details')
    .select('*')
    .eq('time_period_label', 'last_year')
    .eq('audit_type', 'bad_order')
    .limit(5)
  if (e4) {
    console.error('Error:', e4.message)
    return
  }
  console.log(JSON.stringify(badOrder ?? [], null, 2))
}

run().catch(console.error)
