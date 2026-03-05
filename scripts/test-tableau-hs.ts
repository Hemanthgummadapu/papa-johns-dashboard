import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

async function main() {
  const { getTableauAuthToken } = await import('../lib/tableau-client')
  const { token, siteId } = await getTableauAuthToken()
  
  console.log('✅ Authenticated, searching for HotSchedules workbook...')
  
  // Search workbooks
  const res = await fetch(
    `https://us-east-1.online.tableau.com/api/3.21/sites/${siteId}/workbooks?filter=name:eq:Hotschedules reporting`,
    { headers: { 'X-Tableau-Auth': token, 'Accept': 'application/json' } }
  )
  const data = await res.json()
  const workbooks = data?.workbooks?.workbook || []
  console.log('Found workbooks:', workbooks.map((w: any) => ({ id: w.id, name: w.name })))
  
  if (workbooks.length === 0) {
    console.log('Not found - listing all workbooks...')
    const res2 = await fetch(
      `https://us-east-1.online.tableau.com/api/3.21/sites/${siteId}/workbooks`,
      { headers: { 'X-Tableau-Auth': token, 'Acpt': 'application/json' } }
    )
    const data2 = await res2.json()
    const all = data2?.workbooks?.workbook || []
    console.log('All workbooks:', all.map((w: any) => ({ id: w.id, name: w.name })))
  }
}
main().catch(console.error)
