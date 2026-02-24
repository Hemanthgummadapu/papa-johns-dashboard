import { createClient } from '@supabase/supabase-js'

function getEnv(name: string): string | undefined {
  const v = process.env[name]
  return v && v.length > 0 ? v : undefined
}

/**
 * IMPORTANT:
 * Do NOT throw at module-import time. Next.js imports route modules during `next build`,
 * and we don't want builds to fail just because env vars aren't present in CI/dev.
 */
export function getSupabaseAnonClient() {
  const url = getEnv('NEXT_PUBLIC_SUPABASE_URL')
  const anon = getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY')
  if (!url || !anon) {
    throw new Error('Missing Supabase environment variables (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY)')
  }
  return createClient(url, anon)
}

export function getSupabaseAdminClient() {
  const url = getEnv('NEXT_PUBLIC_SUPABASE_URL')
  const service = getEnv('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !service) {
    throw new Error('Missing Supabase environment variables (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)')
  }
  return createClient(url, service)
}

// Types
export interface Store {
  id: string
  store_number: number
  name: string
  location: string
  created_at: string
}

export interface DailyReport {
  id: string
  store_id: string
  report_date: string
  report_date_end?: string | null
  net_sales: number | null
  labor_pct: number | null
  food_cost_pct: number | null
  flm_pct: number | null
  cash_short: number | null
  raw_pdf_url: string | null
  created_at: string
  doordash_sales?: number | null
  ubereats_sales?: number | null
  period_label?: string | null
}

export interface DailyReportWithStore extends DailyReport {
  stores: Store
}

