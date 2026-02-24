/**
 * In-memory store for parsed reports
 * Used when Supabase is not configured
 */

import type { DailyReportWithStore } from './db'

// In-memory storage
let memoryStore: DailyReportWithStore[] = []

export function addReportToMemory(report: DailyReportWithStore) {
  // Check if report already exists (same store + date range + period)
  const exists = memoryStore.find(
    (r) =>
      (r as any).stores?.store_number === (report as any).stores?.store_number &&
      r.report_date === report.report_date &&
      (r.report_date_end || r.report_date) === (report.report_date_end || report.report_date) &&
      (r.period_label || 'current') === (report.period_label || 'current')
  )

  if (exists) {
    // Update existing
    const index = memoryStore.indexOf(exists)
    memoryStore[index] = report
    return { updated: true, data: report }
  } else {
    // Add new
    memoryStore.push(report)
    return { created: true, data: report }
  }
}

export function getReportsFromMemory(): DailyReportWithStore[] {
  return [...memoryStore] // Return copy
}

export function clearMemoryStore() {
  memoryStore = []
}

