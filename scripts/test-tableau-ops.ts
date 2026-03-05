import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

async function main() {
  const { getTableauAuthToken } = await import('../lib/tableau-client')
  const { token, siteId } = await getTableauAuthToken()
  
  const workbookId = '5231ea91-4dd6-45a9-bcf5-bd7e645c7b44'
  
  // Get all views
  const res = await fetch(
    `https://us-east-1.online.tableau.com/api/3.21/sites/${siteId}/workbooks/${workbookId}/views`,
    { headers: { 'X-Tableau-Auth': token, 'Accept': 'application/json' } }
  )
  const data = await res.json()
  const views = data?.views?.view || []
  console.log('All views:')
  views.forEach((v: any) => console.log(`  ${v.id} - ${v.name}`))
  
  // Get ALL rows from first view (Operational Metrics - Summary)
  const viewId = views[0].id
  const res2 = await fetch(
    `https://us-east-1.online.tableau.com/api/3.21/sites/${siteId}/views/${viewId}/data`,
    { headers: { 'X-Tableau-Auth': token } }
  )
  const text = await res2.text()
  const rows = text.split('\n').filter(l => l.trim())
  console.log('\nHeaders:', rows[0])
  const measures = Array.from(new Set(rows.slice(1).map(r => r.split(',')[0])))
  console.log('\nUnique measures:', measures)
  const storeTypes = Array.from(new Set(rows.slice(1).map(r => r.split(',')[1])))
  console.log('\nStore types:', storeTypes)
  console.log('\nFirst 15 rows:')
  rows.slice(0, 15).forEach(r => console.log(r))
}
main().catch(console.error)
