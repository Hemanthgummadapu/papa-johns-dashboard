import { getTableauAuthToken } from '@/lib/tableau-client'
import { getSupabaseAdminClient } from '@/lib/db'

export const dynamic = 'force-dynamic'

const HS_VIEW_ID = 'e77c8165-d943-4674-97f8-4a4a7f06a0ad'

function parseCSV(text: string) {
  const lines = text.split('\n').filter((l) => l.trim())
  const headers = lines[0]?.split(',') ?? []
  return lines.slice(1).map((line) => {
    const values = line.split(',')
    return {
      measureName: values[0]?.trim() ?? '',
      storeNumber: values[1]?.trim() ?? '',
      timeline: values[2]?.trim() ?? '',
      timelineBD: values[3]?.trim() ?? '',
      value: parseFloat(values[4] ?? '0') || 0,
    }
  })
}

export async function GET(request: Request) {
  const apiKey = request.headers.get('x-api-key')
  const expectedKey = process.env.SCRAPER_API_KEY
  if (expectedKey && apiKey !== expectedKey) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { token, siteId } = await getTableauAuthToken()

    const res = await fetch(
      `https://us-east-1.online.tableau.com/api/3.21/sites/${siteId}/views/${HS_VIEW_ID}/data`,
      { headers: { 'X-Tableau-Auth': token } }
    )
    const csvText = await res.text()
    if (!res.ok) throw new Error(`Tableau view data failed: ${res.status} ${res.statusText}`)
    const rows = parseCSV(csvText)

    const grouped: Record<string, {
      store_number: string
      week: string
      week_bd: string
      instore_scheduled_hours: number
      instore_actual_hours: number
      instore_forecasted_hours: number
      instore_optimal_hours: number
      manager_scheduled_hours: number
      manager_actual_hours: number
      manager_forecasted_hours: number
      manager_optimal_hours: number
      driver_scheduled_hours: number
      driver_actual_hours: number
      driver_forecasted_hours: number
      driver_optimal_hours: number
      synced_at?: string
    }> = {}
    for (const row of rows) {
      const key = `${row.storeNumber}__${row.timeline}`
      if (!grouped[key]) {
        grouped[key] = {
          store_number: row.storeNumber,
          week: row.timeline,
          week_bd: row.timelineBD,
          instore_scheduled_hours: 0,
          instore_actual_hours: 0,
          instore_forecasted_hours: 0,
          instore_optimal_hours: 0,
          manager_scheduled_hours: 0,
          manager_actual_hours: 0,
          manager_forecasted_hours: 0,
          manager_optimal_hours: 0,
          driver_scheduled_hours: 0,
          driver_actual_hours: 0,
          driver_forecasted_hours: 0,
          driver_optimal_hours: 0,
        }
      }
      const g = grouped[key]
      const m = row.measureName.toLowerCase()
      if (m.includes('instore scheduled')) g.instore_scheduled_hours = row.value
      if (m.includes('instore actual')) g.instore_actual_hours = row.value
      if (m.includes('instore forecast')) g.instore_forecasted_hours = row.value
      if (m.includes('instore optimal')) g.instore_optimal_hours = row.value
      if (m.includes('manager scheduled')) g.manager_scheduled_hours = row.value
      if (m.includes('manager actual')) g.manager_actual_hours = row.value
      if (m.includes('manager forecast')) g.manager_forecasted_hours = row.value
      if (m.includes('manager optimal')) g.manager_optimal_hours = row.value
      if (m.includes('driver scheduled')) g.driver_scheduled_hours = row.value
      if (m.includes('driver actual')) g.driver_actual_hours = row.value
      if (m.includes('driver forecast')) g.driver_forecasted_hours = row.value
      if (m.includes('driver optimal')) g.driver_optimal_hours = row.value
    }

    const records = Object.values(grouped)
    records.forEach((r) => (r.synced_at = new Date().toISOString()))

    const supabase = getSupabaseAdminClient()
    const { error } = await supabase
      .from('hotschedules_labor')
      .upsert(records, { onConflict: 'store_number,week' })

    if (error) throw error

    return Response.json({
      success: true,
      records: records.length,
      message: `Synced ${records.length} store/week combinations`,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return Response.json({ success: false, error: message }, { status: 500 })
  }
}
