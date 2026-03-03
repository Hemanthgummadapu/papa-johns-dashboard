import { NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/db'

export const dynamic = 'force-dynamic';

/**
 * Check if Supabase is configured
 */
function isSupabaseConfigured(): boolean {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const service = process.env.SUPABASE_SERVICE_ROLE_KEY
    return !!(url && service && url.length > 0 && service.length > 0)
  } catch {
    return false
  }
}

/**
 * GET /api/automation-log
 * Fetch automation log entries from Supabase
 */
export async function GET() {
  try {
    const useSupabase = isSupabaseConfigured()

    if (!useSupabase) {
      // Return empty array if Supabase not configured
      return NextResponse.json([])
    }

    const supabaseAdmin = getSupabaseAdminClient()
    const { data, error } = await supabaseAdmin
      .from('automation_log')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(100)

    if (error) {
      console.error('Error fetching automation logs:', error)
      return NextResponse.json([])
    }

    return NextResponse.json(data || [])
  } catch (error: any) {
    console.error('Error in automation-log API:', error)
    return NextResponse.json([])
  }
}

