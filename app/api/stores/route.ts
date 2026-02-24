import { NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/db'

export async function GET() {
  try {
    const supabaseAdmin = getSupabaseAdminClient()
    const { data, error } = await supabaseAdmin
      .from('stores')
      .select('*')
      .order('store_number', { ascending: true })

    if (error) {
      throw error
    }

    return NextResponse.json(data)
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (!msg.includes('Missing Supabase environment variables')) {
      console.error('Error fetching stores:', error)
    }
    return NextResponse.json(
      { error: msg.includes('Missing Supabase environment variables') ? msg : 'Failed to fetch stores' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const supabaseAdmin = getSupabaseAdminClient()
    const body = await request.json()
    const { store_number, name, location } = body

    if (!store_number || !name || !location) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('stores')
      .insert({ store_number, name, location })
      .select()
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (!msg.includes('Missing Supabase environment variables')) {
      console.error('Error creating store:', error)
    }
    return NextResponse.json(
      { error: msg.includes('Missing Supabase environment variables') ? msg : 'Failed to create store' },
      { status: 500 }
    )
  }
}

