import { NextRequest, NextResponse } from 'next/server'
import { parsePapaJohnsPDF } from '@/lib/pdf-parser'
import { getSupabaseAdminClient } from '@/lib/db'
import { addReportToMemory } from '@/lib/memory-store'
import { appendToSheet, getSheetUrl } from '@/lib/gsheets'
import type { DailyReportWithStore } from '@/lib/db'

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

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const searchParams = request.nextUrl.searchParams
    const period = searchParams.get('period') || 'current' // 'current' or 'lastyear'

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Parse PDF
    const metrics = await parsePapaJohnsPDF(buffer)
    const periodLabel = period === 'lastyear' ? 'lastyear' : 'current'

    // Check if Supabase is configured
    const useSupabase = isSupabaseConfigured()

    if (useSupabase) {
      // Use Supabase if configured
      try {
        const supabaseAdmin = getSupabaseAdminClient()

        // Find store by store number
        const { data: store, error: storeError } = await supabaseAdmin
          .from('stores')
          .select('id')
          .eq('store_number', parseInt(metrics.store_number, 10))
          .single()

        if (storeError || !store) {
          // Auto-create store if it doesn't exist
          const { data: newStore, error: createError } = await supabaseAdmin
            .from('stores')
            .insert({
              store_number: parseInt(metrics.store_number, 10),
              name: `Store ${metrics.store_number}`,
              location: 'Unknown',
            })
            .select()
            .single()

          if (createError || !newStore) {
            throw new Error(`Could not find or create store ${metrics.store_number}`)
          }

          // Use the newly created store
          const storeId = newStore.id

          // Create new report
          const { data, error } = await supabaseAdmin
            .from('daily_reports')
            .insert({
              store_id: storeId,
              report_date: metrics.date_start,
              report_date_end: metrics.date_end,
              net_sales: metrics.net_sales,
              labor_pct: metrics.labor_pct,
              food_cost_pct: metrics.food_cost_pct,
              flm_pct: metrics.flm_pct,
              cash_short: metrics.cash_short,
              doordash_sales: metrics.doordash_sales,
              ubereats_sales: metrics.ubereats_sales,
              period_label: periodLabel,
            })
            .select()
            .single()

          if (error) throw error

          return NextResponse.json({
            ...metrics,
            data,
            created: true,
            storage: 'supabase',
            period: periodLabel,
          })
        }

        // Check if report already exists for this date range
        const { data: existingReport } = await supabaseAdmin
          .from('daily_reports')
          .select('id')
          .eq('store_id', store.id)
          .eq('report_date', metrics.date_start)
          .eq('report_date_end', metrics.date_end)
          .single()

        if (existingReport) {
          // Update existing report
          const { data, error } = await supabaseAdmin
            .from('daily_reports')
            .update({
              net_sales: metrics.net_sales,
              labor_pct: metrics.labor_pct,
              food_cost_pct: metrics.food_cost_pct,
              flm_pct: metrics.flm_pct,
              cash_short: metrics.cash_short,
              doordash_sales: metrics.doordash_sales,
              ubereats_sales: metrics.ubereats_sales,
              period_label: periodLabel,
            })
            .eq('id', existingReport.id)
            .select()
            .single()

          if (error) throw error

          // Also write to Google Sheets
          console.log('=== PARSE PDF: Calling appendToSheet ===')
          let sheetResult
          try {
            sheetResult = await appendToSheet({
              store_number: metrics.store_number,
              date_start: metrics.date_start,
              date_end: metrics.date_end,
              net_sales: metrics.net_sales,
              labor_pct: metrics.labor_pct,
              food_cost_pct: metrics.food_cost_pct,
              flm_pct: metrics.flm_pct,
              cash_short: metrics.cash_short,
              doordash_sales: metrics.doordash_sales,
              ubereats_sales: metrics.ubereats_sales,
            })
            console.log('=== PARSE PDF: appendToSheet completed ===', sheetResult)
          } catch (err: any) {
            console.error('=== PARSE PDF: Sheet write failed ===', err.message)
            sheetResult = { success: false, error: err.message }
          }

          return NextResponse.json({
            ...metrics,
            data,
            updated: true,
            storage: 'supabase',
            period: periodLabel,
            savedTo: {
              supabase: true,
              googleSheets: sheetResult.success,
              sheetUrl: getSheetUrl(),
              sheetRow: sheetResult.rowNumber,
            },
          })
        } else {
          // Create new report
          const { data, error } = await supabaseAdmin
            .from('daily_reports')
            .insert({
              store_id: store.id,
              report_date: metrics.date_start,
              report_date_end: metrics.date_end,
              net_sales: metrics.net_sales,
              labor_pct: metrics.labor_pct,
              food_cost_pct: metrics.food_cost_pct,
              flm_pct: metrics.flm_pct,
              cash_short: metrics.cash_short,
              doordash_sales: metrics.doordash_sales,
              ubereats_sales: metrics.ubereats_sales,
              period_label: periodLabel,
            })
            .select()
            .single()

          if (error) throw error

          // Also write to Google Sheets
          console.log('=== PARSE PDF: Calling appendToSheet ===')
          let sheetResult
          try {
            sheetResult = await appendToSheet({
              store_number: metrics.store_number,
              date_start: metrics.date_start,
              date_end: metrics.date_end,
              net_sales: metrics.net_sales,
              labor_pct: metrics.labor_pct,
              food_cost_pct: metrics.food_cost_pct,
              flm_pct: metrics.flm_pct,
              cash_short: metrics.cash_short,
              doordash_sales: metrics.doordash_sales,
              ubereats_sales: metrics.ubereats_sales,
            })
            console.log('=== PARSE PDF: appendToSheet completed ===', sheetResult)
          } catch (err: any) {
            console.error('=== PARSE PDF: Sheet write failed ===', err.message)
            sheetResult = { success: false, error: err.message }
          }

          return NextResponse.json({
            ...metrics,
            data,
            created: true,
            storage: 'supabase',
            period: periodLabel,
            savedTo: {
              supabase: true,
              googleSheets: sheetResult.success,
              sheetUrl: getSheetUrl(),
              sheetRow: sheetResult.rowNumber,
            },
          })
        }
      } catch (supabaseError: any) {
        // If Supabase fails, fall back to memory storage
        console.warn('Supabase operation failed, using memory storage:', supabaseError.message)
        // Continue to memory storage below
      }
    }

    // Fallback to in-memory storage
    const storeId = `memory-${metrics.store_number}-${Date.now()}`
    const reportId = `memory-report-${Date.now()}`

    const memoryReport: DailyReportWithStore = {
      id: reportId,
      store_id: storeId,
      report_date: metrics.date_start,
      report_date_end: metrics.date_end,
      net_sales: metrics.net_sales,
      labor_pct: metrics.labor_pct,
      food_cost_pct: metrics.food_cost_pct,
      flm_pct: metrics.flm_pct,
      cash_short: metrics.cash_short,
      raw_pdf_url: null,
      created_at: new Date().toISOString(),
      doordash_sales: metrics.doordash_sales,
      ubereats_sales: metrics.ubereats_sales,
      period_label: periodLabel,
      stores: {
        id: storeId,
        store_number: parseInt(metrics.store_number, 10),
        name: `Store ${metrics.store_number}`,
        location: 'Unknown',
        created_at: new Date().toISOString(),
      },
    }

    const result = addReportToMemory(memoryReport)

    // Also try to write to Google Sheets even if using memory storage
    console.log('=== PARSE PDF (memory): Calling appendToSheet ===')
    let sheetResult
    try {
      sheetResult = await appendToSheet({
        store_number: metrics.store_number,
        date_start: metrics.date_start,
        date_end: metrics.date_end,
        net_sales: metrics.net_sales,
        labor_pct: metrics.labor_pct,
        food_cost_pct: metrics.food_cost_pct,
        flm_pct: metrics.flm_pct,
        cash_short: metrics.cash_short,
        doordash_sales: metrics.doordash_sales,
        ubereats_sales: metrics.ubereats_sales,
      })
      console.log('=== PARSE PDF (memory): appendToSheet completed ===', sheetResult)
    } catch (err: any) {
      console.error('=== PARSE PDF (memory): Sheet write failed ===', err.message)
      sheetResult = { success: false, error: err.message }
    }

    return NextResponse.json({
      ...metrics,
      ...result,
      data: memoryReport,
      storage: 'memory',
      period: periodLabel,
      savedTo: {
        supabase: false,
        googleSheets: sheetResult.success,
        sheetUrl: getSheetUrl(),
        sheetRow: sheetResult.rowNumber,
      },
    })
  } catch (error: any) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('Error parsing PDF:', error)
    return NextResponse.json(
      { error: msg || 'Failed to parse PDF' },
      { status: 500 }
    )
  }
}

