import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

async function main() {
  const { getTableauAuthToken } = await import('../lib/tableau-client')
  const { token, siteId } = await getTableauAuthToken()
  
  const viewId = 'f9e9cb6d-6b66-4d91-9c7d-210d3d4ba09b' // Audit Summary
  
  const res = await fetch(
    `https://us-east-1.online.tableau.com/api/3.21/sites/${siteId}/views/${viewId}/data`,
    { headers: { 'X-Tableau-Auth': token } }
  )
  const text = await res.text()
  const rows = text.split('\n').filter(l => l.trim())
  
  // Show all unique columns
  console.log('Headers:', rows[0])
  
  // Show unique DVP/dimension values
  const col0 = Array.from(new Set(rows.slice(1).map(r => r.split(',')[0])))
  console.log('\nUnique col0:', col0)
  
  // Show unique measure names
  const measures = Array.from(new Set(rows.slice(1).map(r => r.split(',')[1])))
  console.log('\nUnique measures:', measures)
  
  // Show unique timelines
  const timelines = Array.from(new Set(rows.slice(1).map(r => r.split(',')[2])))
  console.log('\nUnique timelines:', timelines)
  
  // Show all rows for P3 2026
  console.log('\nP3 2026 rows:')
  rows.slice(1).filter(r => r.includes('P3 2026')).forEach(r => console.log(r))
}
main().catch(console.error)
