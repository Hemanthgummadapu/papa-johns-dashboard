import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

async function main() {
  const { getTableauAuthToken } = await import('../lib/tableau-client')
  const { token, siteId } = await getTableauAuthToken()
  
  // Operational Metrics - Franchise (222 rows)
  const viewId = '3aea74ab-fc79-4986-915a-51123500a041'
  
  const res = await fetch(
    `https://us-east-1.online.tableau.com/api/3.21/sites/${siteId}/views/${viewId}/data`,
    { headers: { 'X-Tableau-Auth': token } }
  )
  const text = await res.text()
  const rows = text.split('\n').filter(l => l.trim())
  
  console.log('Headers:', rows[0])
  
  const l1Values = Array.from(new Set(rows.slice(1).map(r => r.split(',')[0])))
  console.log('\nUnique L1 values:', l1Values)
  
  const measures = Array.from(new Set(rows.slice(1).map(r => r.split(',')[1].trim())))
  console.log('\nUnique measures:', measures)
  
  const timelines = Array.from(new Set(rows.slice(1).map(r => r.split(',')[2].trim())))
  console.log('\nUnique timelines:', timelines)
  
  // Show rows for our franchisee
  console.log('\nAll papa_john rows:')
  rows.slice(1).filter(r => r.toLowerCase().includes('papa_john')).slice(0, 20).forEach(r => console.log(r))
}
main().catch(console.error)
