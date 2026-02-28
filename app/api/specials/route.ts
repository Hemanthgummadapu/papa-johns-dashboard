import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function supabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') // active | stopped | all
    const sb = supabase()
    let q = sb.from('specials').select('*').order('start_date', { ascending: false })
    if (status && status !== 'all') {
      q = q.eq('status', status)
    }
    const { data, error } = await q
    if (error) throw error
    return NextResponse.json(data ?? [])
  } catch (err: any) {
    console.error('[specials] GET error:', err)
    return NextResponse.json([], { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, platform, store_ids, start_date, end_date, notes } = body
    if (!name || !platform || !Array.isArray(store_ids) || !start_date) {
      return NextResponse.json(
        { error: 'Missing required fields: name, platform, store_ids, start_date' },
        { status: 400 }
      )
    }
    const sb = supabase()
    const { data: special, error: insertError } = await sb
      .from('specials')
      .insert({
        name,
        platform: platform.toLowerCase().replace(/\s/g, '_'),
        store_ids,
        start_date,
        end_date: end_date || null,
        notes: notes || null,
        status: 'active',
      })
      .select()
      .single()
    if (insertError) throw insertError
    await sb.from('specials_history').insert({
      special_id: special.id,
      action: 'started',
      notes: notes || null,
    })
    return NextResponse.json(special)
  } catch (err: any) {
    console.error('[specials] POST error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
