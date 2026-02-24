import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/db'
import { getReportsFromMemory } from '@/lib/memory-store'

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

export async function GET(request: NextRequest) {
  try {
    const useSupabase = isSupabaseConfigured()

    if (!useSupabase) {
      // Return in-memory data
      const memoryData = getReportsFromMemory()
      return NextResponse.json(memoryData)
    }

    const supabaseAdmin = getSupabaseAdminClient()
    const searchParams = request.nextUrl.searchParams
    const date = searchParams.get('date')
    const storeId = searchParams.get('store_id')
    const daysParam = searchParams.get('days')
    const startParam = searchParams.get('start')
    const endParam = searchParams.get('end')

    let query = supabaseAdmin
      .from('daily_reports')
      .select(`
        *,
        stores (*)
      `)
      .order('report_date', { ascending: false })

    if (date) {
      query = query.eq('report_date', date)
    }

    if (storeId) {
      query = query.eq('store_id', storeId)
    }

    // Range query: either explicit start/end, or "days" back from today.
    // If none specified, default to the last 7 days.
    if (!date && !startParam && !endParam) {
      const days = Math.max(1, Math.min(90, parseInt(daysParam || '7', 10) || 7))
      const end = new Date()
      const start = new Date()
      start.setDate(end.getDate() - (days - 1))
      const startIso = start.toISOString().slice(0, 10)
      const endIso = end.toISOString().slice(0, 10)
      query = query.gte('report_date', startIso).lte('report_date', endIso)
    }

    if (!date && (startParam || endParam)) {
      const startIso = startParam || '1970-01-01'
      const endIso = endParam || '2999-12-31'
      query = query.gte('report_date', startIso).lte('report_date', endIso)
    }

    const { data, error } = await query

    if (error) {
      throw error
    }

    return NextResponse.json(data)
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    // Avoid noisy stack traces during builds when env vars aren't set.
    if (!msg.includes('Missing Supabase environment variables')) {
      console.error('Error fetching daily reports:', error)
    }
    return NextResponse.json(
      { error: msg.includes('Missing Supabase environment variables') ? msg : 'Failed to fetch daily reports' },
      { status: 500 }
    )
  }
}

