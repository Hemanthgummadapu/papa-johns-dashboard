import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function parseTableauCSV(buffer: Buffer): string[][] {
  const text = buffer.toString('utf16le')
  const lines = text.split('\n').filter((l) => l.trim())
  return lines.map((line) =>
    line.split('\t').map((cell) => cell.trim().replace(/^"|"$/g, ''))
  )
}

function parseNum(val: string): number {
  if (!val) return 0
  return parseFloat(String(val).replace(/[$,%\s]/g, '').replace(/,/g, '')) || 0
}

function parseDate(val: string): string | null {
  if (!val) return null
  try {
    const d = new Date(val.trim())
    return Number.isNaN(d.getTime()) ? null : d.toISOString().split('T')[0]
  } catch {
    return null
  }
}

function parseTimestamp(val: string): string | null {
  if (!val || !val.trim()) return null
  try {
    const d = new Date(val.trim())
    return Number.isNaN(d.getTime()) ? null : d.toISOString()
  } catch {
    return null
  }
}

function isNumeric(val: string): boolean {
  return /^\d+$/.test(val?.trim() ?? '')
}

const VALID_TIME_PERIODS = ['current_period', 'last_period', 'last_year'] as const
type TimePeriod = (typeof VALID_TIME_PERIODS)[number]

const VIEW_KEYS = [
  'ZeroedOutDetails',
  'ZeroedOutSummary',
  'BadOrderDetails',
  'BadOrderSummary',
  'CanceledOrderDetails',
  'CanceledOrderSummary',
  'RefundOrderDetails',
  'RefundOrderSummary',
] as const

function detectViewFromFilename(filename: string): (typeof VIEW_KEYS)[number] | null {
  const base = filename.replace(/\.csv$/i, '').replace(/\s/g, '').toLowerCase()
  if (base.includes('zero') && base.includes('detail')) return 'ZeroedOutDetails'
  if (base.includes('zero') && base.includes('summary')) return 'ZeroedOutSummary'
  if (base.includes('bad') && base.includes('detail')) return 'BadOrderDetails'
  if (base.includes('bad') && base.includes('summary')) return 'BadOrderSummary'
  if (base.includes('cancel') && base.includes('detail')) return 'CanceledOrderDetails'
  if (base.includes('cancel') && base.includes('summary')) return 'CanceledOrderSummary'
  if (base.includes('refund') && base.includes('detail')) return 'RefundOrderDetails'
  if (base.includes('refund') && base.includes('summary')) return 'RefundOrderSummary'
  return null
}

const VIEW_CONFIG: Record<
  (typeof VIEW_KEYS)[number],
  { auditType: string; type: 'summary' | 'detail' }
> = {
  ZeroedOutDetails: { auditType: 'zeroed_out', type: 'detail' },
  ZeroedOutSummary: { auditType: 'zeroed_out', type: 'summary' },
  BadOrderDetails: { auditType: 'bad_order', type: 'detail' },
  BadOrderSummary: { auditType: 'bad_order', type: 'summary' },
  CanceledOrderDetails: { auditType: 'canceled', type: 'detail' },
  CanceledOrderSummary: { auditType: 'canceled', type: 'summary' },
  RefundOrderDetails: { auditType: 'refund', type: 'detail' },
  RefundOrderSummary: { auditType: 'refund', type: 'summary' },
}

function parseSummaryRows(
  grid: string[][],
  auditType: string,
  timePeriodLabel: string
): Record<string, unknown>[] {
  const year = new Date().getFullYear()
  const rows: Record<string, unknown>[] = []
  for (let i = 1; i < grid.length; i++) {
    const cols = grid[i]
    if (!cols?.[0] || !isNumeric(cols[0])) continue
    rows.push({
      store_number: cols[0].trim(),
      audit_type: auditType,
      period_code: 'upload',
      year,
      period_number: 0,
      week: null,
      percent: parseNum(cols[1]),
      transactions: parseInt(String(cols[2]).replace(/,/g, ''), 10) || 0,
      amount_percent: parseNum(cols[3]),
      amount: parseNum(cols[4]),
      time_period_label: timePeriodLabel,
      synced_at: new Date().toISOString(),
    })
  }
  return rows
}

function baseDetailRow(
  cols: string[],
  auditType: string,
  timePeriodLabel: string
): Record<string, unknown> {
  const year = new Date().getFullYear()
  return {
    store_number: cols[0]?.trim() ?? '',
    audit_type: auditType,
    period_code: 'upload',
    year,
    period_number: 0,
    week: null,
    business_date: parseDate(cols[1]),
    order_placed_at: parseTimestamp(cols[2]) || (cols[2]?.trim() || null),
    event_at: parseTimestamp(cols[3]) || (cols[3]?.trim() || null),
    manager_name: cols[4]?.trim() || null,
    approver_user_id: null,
    approver_name: null,
    order_number: null,
    order_type: null,
    payment_type: null,
    reason: null,
    customer_name: null,
    customer_number: null,
    order_status: null,
    amount: 0,
    amount_charged: null,
    tips_amount: null,
    is_bad_order: null,
    percentage_voided: null,
    time_period_label: timePeriodLabel,
    synced_at: new Date().toISOString(),
  }
}

function parseZeroedOutDetail(
  grid: string[][],
  timePeriodLabel: string
): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = []
  for (let i = 1; i < grid.length; i++) {
    const cols = grid[i]
    if (!cols?.[0] || !isNumeric(cols[0])) continue
    const row = baseDetailRow(cols, 'zeroed_out', timePeriodLabel)
    Object.assign(row, {
      order_number: cols[5]?.trim() || null,
      order_type: cols[6]?.trim() || null,
      payment_type: cols[7]?.trim() || null,
      is_bad_order: (cols[8]?.trim() || '').toLowerCase() === 'true' || null,
      customer_name: cols[9]?.trim() || null,
      customer_number: cols[10]?.trim() || null,
      amount: parseNum(cols[12]),
    })
    rows.push(row)
  }
  return rows
}

function parseBadOrderDetail(
  grid: string[][],
  timePeriodLabel: string
): Record<string, unknown>[] {
  const raw: Record<string, unknown>[] = []
  for (let i = 1; i < grid.length; i++) {
    const cols = grid[i]
    if (!cols?.[0] || !isNumeric(cols[0])) continue
    // DEDUP: only keep rows where Measure Names (cols[14]) = 'Amount Voided' to remove 3x repetition
    if (cols[14]?.trim() !== 'Amount Voided') continue
    const row = baseDetailRow(cols, 'bad_order', timePeriodLabel)
    Object.assign(row, {
      approver_user_id: cols[5]?.trim() || null,
      approver_name: cols[6]?.trim() || null,
      order_number: cols[7]?.trim() || null,
      order_type: cols[8]?.trim() || null,
      payment_type: cols[9]?.trim() || null,
      reason: cols[10]?.trim() || null,
      customer_name: cols[11]?.trim() || null,
      order_status: cols[12]?.trim() || null,
      percentage_voided: parseNum(cols[13]) || null,
      amount_charged: parseNum(cols[16]) || null,
      // cols[15] = Measure Values (amount when Measure Names = 'Amount Voided'), cols[17] = backup
      amount: parseNum(cols[15]) || parseNum(cols[17]),
    })
    raw.push(row)
  }
  return raw.filter((r) => r.store_number && /^\d+$/.test(String(r.store_number)))
}

function parseCanceledOrderDetail(
  grid: string[][],
  timePeriodLabel: string
): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = []
  for (let i = 1; i < grid.length; i++) {
    const cols = grid[i]
    if (!cols?.[0] || !isNumeric(cols[0])) continue
    const row = baseDetailRow(cols, 'canceled', timePeriodLabel)
    Object.assign(row, {
      order_number: cols[5]?.trim() || null,
      order_type: cols[6]?.trim() || null,
      payment_type: cols[7]?.trim() || null,
      customer_name: cols[8]?.trim() || null,
      customer_number: cols[9]?.trim() || null,
      reason: cols[10]?.trim() || null,
      amount: parseNum(cols[12]),
    })
    rows.push(row)
  }
  return rows
}

function parseRefundOrderDetail(
  grid: string[][],
  timePeriodLabel: string
): Record<string, unknown>[] {
  const year = new Date().getFullYear()
  const rows = grid
    .slice(1)
    .filter((cols) => cols[13]?.trim() === 'Amount Refunded')
    .map((cols) => {
      const store_number = cols[0]?.trim() ?? ''
      const business_date = parseDate(cols[1])
      const order_placed_at = parseTimestamp(cols[2]) || (cols[2]?.trim() || null)
      return {
        store_number,
        audit_type: 'refund',
        period_code: 'upload',
        year,
        period_number: 0,
        week: null,
        business_date,
        order_placed_at,
        event_at: parseTimestamp(cols[3]) || (cols[3]?.trim() || null),
        manager_name: cols[4]?.trim() || null,
        approver_user_id: null,
        approver_name: cols[4]?.trim() || null,
        order_number: cols[5]?.trim() || null,
        order_type: cols[6]?.trim() || null,
        payment_type: cols[7]?.trim() || null,
        customer_name: cols[8]?.trim() || null,
        customer_number: cols[9]?.trim() || null,
        reason: cols[10]?.trim() || null,
        order_status: cols[11]?.trim() || null,
        percentage_voided: parseNum(cols[12]) || null,
        amount: parseNum(cols[14]),
        amount_charged: null,
        tips_amount: null,
        is_bad_order: null,
        time_period_label: timePeriodLabel,
        synced_at: new Date().toISOString(),
      } as Record<string, unknown>
    })
    .filter((r) => r.store_number && /^\d+$/.test(String(r.store_number)))
  return rows
}

function parseDetailRows(
  grid: string[][],
  viewName: (typeof VIEW_KEYS)[number],
  timePeriodLabel: string
): Record<string, unknown>[] {
  switch (viewName) {
    case 'ZeroedOutDetails':
      return parseZeroedOutDetail(grid, timePeriodLabel)
    case 'BadOrderDetails':
      return parseBadOrderDetail(grid, timePeriodLabel)
    case 'CanceledOrderDetails':
      return parseCanceledOrderDetail(grid, timePeriodLabel)
    case 'RefundOrderDetails':
      return parseRefundOrderDetail(grid, timePeriodLabel)
    default:
      return []
  }
}

export async function POST(req: NextRequest) {
  const errors: string[] = []
  const results: { file: string; rowsInserted: number; auditType: string; type: string }[] = []

  try {
    const formData = await req.formData()
    const timePeriod = (formData.get('timePeriod') as string)?.trim()
    if (!timePeriod || !VALID_TIME_PERIODS.includes(timePeriod as TimePeriod)) {
      return NextResponse.json(
        { success: false, errors: ['Invalid or missing timePeriod. Use current_period, last_period, or last_year.'] },
        { status: 400 }
      )
    }
    const timePeriodLabel = timePeriod
    console.log('Upload API: timePeriod from form =', timePeriod, '→ saving with time_period_label:', timePeriodLabel)

    const files: File[] = []
    const fileList = formData.getAll('files')
    for (const f of fileList) {
      if (f instanceof File && f.name) files.push(f)
    }
    if (formData.get('file') instanceof File) {
      const single = formData.get('file') as File
      if (single.name && !files.some((f) => f.name === single.name)) files.push(single)
    }
    if (files.length === 0) {
      return NextResponse.json(
        { success: false, errors: ['No files provided.'] },
        { status: 400 }
      )
    }
    let viewNamesByIndex: (string | null)[] = []
    try {
      const raw = formData.get('viewNames')
      if (typeof raw === 'string') viewNamesByIndex = JSON.parse(raw) as (string | null)[]
    } catch {
      // ignore
    }

    const supabase = getSupabaseAdminClient()

    for (let idx = 0; idx < files.length; idx++) {
      const file = files[idx]
      const viewName = (viewNamesByIndex[idx] && VIEW_KEYS.includes(viewNamesByIndex[idx] as (typeof VIEW_KEYS)[number]))
        ? viewNamesByIndex[idx]
        : detectViewFromFilename(file.name)
      const resolvedView = viewName && VIEW_KEYS.includes(viewName as (typeof VIEW_KEYS)[number]) ? viewName as (typeof VIEW_KEYS)[number] : null
      if (!resolvedView) {
        results.push({ file: file.name, rowsInserted: 0, auditType: '', type: '' })
        errors.push(`Unknown view for file: ${file.name}. Select a view type in the UI.`)
        continue
      }
      const config = VIEW_CONFIG[resolvedView]
      if (!config) {
        results.push({ file: file.name, rowsInserted: 0, auditType: '', type: '' })
        continue
      }

      let grid: string[][]
      try {
        const buf = Buffer.from(await file.arrayBuffer())
        grid = parseTableauCSV(buf)
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        errors.push(`${file.name}: Failed to parse CSV (UTF-16 TSV): ${msg}`)
        results.push({ file: file.name, rowsInserted: 0, auditType: config.auditType, type: config.type })
        continue
      }

      if (config.type === 'summary') {
        const rows = parseSummaryRows(grid, config.auditType, timePeriodLabel)
        if (rows.length === 0) {
          results.push({ file: file.name, rowsInserted: 0, auditType: config.auditType, type: config.type })
          continue
        }
        const { error } = await supabase
          .from('audit_summary')
          .upsert(rows, { onConflict: 'store_number,audit_type,time_period_label', ignoreDuplicates: false })
        if (error) {
          errors.push(`${file.name}: ${error.message}`)
          results.push({ file: file.name, rowsInserted: 0, auditType: config.auditType, type: config.type })
          continue
        }
        results.push({ file: file.name, rowsInserted: rows.length, auditType: config.auditType, type: config.type })
        await supabase.from('tableau_sync_log').insert({
          view_name: resolvedView,
          rows_synced: rows.length,
          status: 'success',
          period: timePeriodLabel,
          synced_at: new Date().toISOString(),
        })
      } else {
        const rows = parseDetailRows(grid, resolvedView, timePeriodLabel)
        // CRITICAL: delete must filter by BOTH time_period_label AND audit_type so we never wipe other types
        const { error: deleteErr } = await supabase
          .from('audit_details')
          .delete()
          .eq('time_period_label', timePeriodLabel)
          .eq('audit_type', config.auditType)
          .eq('period_code', 'upload')
        if (deleteErr) errors.push(`${file.name} (delete): ${deleteErr.message}`)
        let inserted = 0
        const BATCH = 200
        for (let i = 0; i < rows.length; i += BATCH) {
          const batch = rows.slice(i, i + BATCH)
          const { error: insertErr } = await supabase.from('audit_details').insert(batch)
          if (insertErr) {
            errors.push(`${file.name}: ${insertErr.message}`)
            break
          }
          inserted += batch.length
        }
        results.push({ file: file.name, rowsInserted: inserted, auditType: config.auditType, type: config.type })
        console.log('Saved with time_period_label:', timePeriodLabel, 'audit_type:', config.auditType, 'rows:', inserted)
        await supabase.from('tableau_sync_log').insert({
          view_name: resolvedView,
          rows_synced: inserted,
          status: errors.length ? 'partial' : 'success',
          period: timePeriodLabel,
          synced_at: new Date().toISOString(),
        })
      }
    }

    return NextResponse.json({
      success: errors.length === 0,
      results,
      errors: errors.length ? errors : undefined,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json(
      { success: false, results: [], errors: [message] },
      { status: 500 }
    )
  }
}
