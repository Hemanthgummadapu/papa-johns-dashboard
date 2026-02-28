import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function supabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { status, end_date, action } = body
    const sb = supabase()
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (status) updates.status = status
    if (end_date !== undefined) updates.end_date = end_date || null
    const { data: special, error: updateError } = await sb
      .from('specials')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (updateError) throw updateError
    if (action) {
      await sb.from('specials_history').insert({
        special_id: id,
        action,
        notes: body.notes || null,
      })
    }
    return NextResponse.json(special)
  } catch (err: any) {
    console.error('[specials] PATCH error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
