import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables')
  console.error('Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Sample store data (matching dashboard seed data)
const stores = [
  { store_number: 2081, name: 'Store 2081', location: 'Burbank' },
  { store_number: 2292, name: 'Store 2292', location: 'Glendale' },
  { store_number: 3011, name: 'Store 3011', location: 'Pasadena' },
  { store_number: 3102, name: 'Store 3102', location: 'Van Nuys' },
  { store_number: 3245, name: 'Store 3245', location: 'Northridge' },
  { store_number: 3389, name: 'Store 3389', location: 'Chatsworth' },
]

// Generate 5 weeks (35 days) of fake data for each store
function generateFakeReport(storeId: string, daysAgo: number) {
  const reportDate = new Date()
  reportDate.setDate(reportDate.getDate() - daysAgo)
  const dateStr = reportDate.toISOString().split('T')[0]

  // Generate data matching dashboard seed requirements
  // net_sales: random between 55000-75000
  const netSales = Math.round((55000 + Math.random() * 20000) * 100) / 100

  // labor_pct: random between 24-31
  const laborPct = Math.round((24 + Math.random() * 7) * 100) / 100

  // food_cost_pct: random between 24-30
  const foodCostPct = Math.round((24 + Math.random() * 6) * 100) / 100

  // flm_pct: random between 50-58
  const flmPct = Math.round((50 + Math.random() * 8) * 100) / 100

  // cash_short: random between -50 to 400
  const cashShort = Math.round((Math.random() * 450 - 50) * 100) / 100

  return {
    store_id: storeId,
    report_date: dateStr,
    net_sales: netSales,
    labor_pct: laborPct,
    food_cost_pct: foodCostPct,
    flm_pct: flmPct,
    cash_short: cashShort,
    raw_pdf_url: null,
  }
}

async function seed() {
  console.log('🌱 Starting database seed...')

  try {
    // Clear existing data
    console.log('Clearing existing data...')
    await supabase.from('daily_reports').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabase.from('stores').delete().neq('id', '00000000-0000-0000-0000-000000000000')

    // Insert stores
    console.log('Inserting stores...')
    const { data: insertedStores, error: storesError } = await supabase
      .from('stores')
      .insert(stores)
      .select()

    if (storesError) {
      throw storesError
    }

    console.log(`✅ Inserted ${insertedStores.length} stores`)

    // Insert daily reports for each store (5 weeks = 35 days)
    console.log('Inserting daily reports...')
    const reports = []
    for (const store of insertedStores) {
      for (let i = 0; i < 35; i++) {
        reports.push(generateFakeReport(store.id, i))
      }
    }

    const { data: insertedReports, error: reportsError } = await supabase
      .from('daily_reports')
      .insert(reports)
      .select()

    if (reportsError) {
      throw reportsError
    }

    console.log(`✅ Inserted ${insertedReports.length} daily reports`)
    console.log('🎉 Seed completed successfully!')
  } catch (error) {
    console.error('❌ Error seeding database:', error)
    process.exit(1)
  }
}

seed()

