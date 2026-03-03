import { appendToSheet } from '@/lib/gsheets'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic';

/**
 * GET /api/test-sheets
 * Test endpoint to verify Google Sheets integration
 */
export async function GET() {
  try {
    const result = await appendToSheet({
      store_number: 'TEST',
      date_start: '2026-01-08',
      date_end: '2026-02-08',
      net_sales: 59824.27,
      labor_pct: 27.62,
      food_cost_pct: 28.08,
      flm_pct: 55.70,
      cash_short: 2314.27,
      doordash_sales: 6605.39,
      ubereats_sales: 5805.85,
    })
    if (result.success) {
      return NextResponse.json({ 
        success: true, 
        message: `Row written successfully to row ${result.rowNumber}!`,
        rowNumber: result.rowNumber,
      })
    } else {
      return NextResponse.json({ 
        success: false, 
        error: result.error || 'Unknown error',
      }, { status: 500 })
    }
  } catch (error: any) {
    console.error('=== TEST SHEETS: Error ===', error)
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Failed to write to sheet',
      details: error.toString(),
    }, { status: 500 })
  }
}

