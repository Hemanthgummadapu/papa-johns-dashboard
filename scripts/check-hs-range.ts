import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

async function main() {
  const { getTableauAuthToken } = await import('../lib/tableau-client')
  const { token, siteId } = await getTableauAuthToken()
  
  // HS Store Level view
  const viewId = 'e77c8165-d943-4674-97f8-4a4a7f06a0ad'
  
  const res = await fetch(
    `https://us-east-1.online.tableau.com/api/3.21/sites/${siteId}/views/${viewId}/data`,
    { headers: { 'X-Tableau-Auth': token } }
  )
  const text = await res.text()
  const rows = text.split('\n').filter(l => l.trim())
  
  // Get all unique weeks
  const weeks = Array.from(new Set(rows.slice(1).map(r => {
    const cols = r.split(',')
    return cols[2] // Timeline column
  }))).sort()
  
  console.log('All weeks available in Tableau HotSchedules:')
  weeks.forEach(w => console.log(' ', w))
  console.log('\nTotal weeks:', weeks.length)
}
main().catch(console.error)
