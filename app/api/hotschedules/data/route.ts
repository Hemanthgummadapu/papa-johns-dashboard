import { getSupabaseAdminClient } from '@/lib/db'

export const dynamic = 'force-dynamic'

const STORE_NUMBERS = ['2021', '2081', '2259', '2292', '2481', '3011']

export async function GET() {
  const supabase = getSupabaseAdminClient()

  const { data, error } = await supabase
    .from('hotschedules_labor')
    .select('*')
    .in('store_number', STORE_NUMBERS)
    .order('week_bd', { ascending: false })
    .limit(120)

  if (error) return Response.json({ error: error.message }, { status: 500 })

  // Only return weeks that have at least one store with total_actual_hours > 0 (filter out weeks with all zeros)
  const rows = data ?? []
  const weeksWithActuals = new Set<string>()
  for (const row of rows) {
    const actual = Number(row?.total_actual_hours ?? 0)
    if (actual > 0) weeksWithActuals.add(row.week)
  }
  const filtered = rows.filter((row) => weeksWithActuals.has(row.week))

  return Response.json({ data: filtered })
}
