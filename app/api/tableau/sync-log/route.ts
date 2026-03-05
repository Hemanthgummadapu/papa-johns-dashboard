import { NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = getSupabaseAdminClient()
    const { data, error } = await supabase
      .from('tableau_sync_log')
      .select('*')
      .order('synced_at', { ascending: false })
      .limit(20)
    if (error) throw error
    return NextResponse.json({ data: data ?? [] })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
