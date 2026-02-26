import { NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/db'

export async function GET() {
  try {
    const supabase = getSupabaseAdminClient()
    const { data, error } = await supabase
      .from('smg_scores')
      .select('*')
      .eq('period', 'current')
      .order('store_id', { ascending: true })

    if (error) {
      console.error('Error fetching SMG scores:', error)
      return NextResponse.json(
        { error: 'Failed to fetch SMG scores', data: [], lastScraped: null },
        { status: 500 }
      )
    }

    // Get the most recent scraped_at timestamp
    let lastScraped: string | null = null
    if (data && data.length > 0) {
      const timestamps = data
        .map(d => d.scraped_at)
        .filter(Boolean)
        .sort()
        .reverse()
      lastScraped = timestamps[0] || null
    }

    return NextResponse.json(
      {
        data: data || [],
        lastScraped,
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      }
    )
  } catch (error) {
    console.error('Error in SMG data API:', error)
    return NextResponse.json(
      { error: 'Failed to fetch SMG data', data: [], lastScraped: null },
      { status: 500 }
    )
  }
}
