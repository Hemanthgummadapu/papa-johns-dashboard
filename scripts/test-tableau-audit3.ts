import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

async function main() {
  const { getTableauAuthToken } = await import('../lib/tableau-client')
  const { token, siteId } = await getTableauAuthToken()
  
  // List ALL workbooks to find the right one
  const res = await fetch(
    `https://us-east-1.online.tableau.com/api/3.21/sites/${siteId}/workbooks?pageSize=100`,
    { headers: { 'X-Tableau-Auth': token, 'Accept': 'application/json' } }
  )
  const data = await res.json()
  const workbooks = data?.workbooks?.workbook || []
  console.log('All workbooks:')
  workbooks.forEach((w: any) => console.log(`  ${w.id} - ${w.name}`))
  
  // Also try bad order details with filter params
  const viewId = '80a213a3-3ffa-433f-8ee4-b72c6fa6bb6d'
  const res2 = await fetch(
    `https://us-east-1.online.tableau.com/api/3.21/sites/${siteId}/views/${viewId}/data?maxAge=0`,
    { headers: { 'X-Tableau-Auth': token } }
  )
  const text = await res2.text()
  console.log('\nBad order with maxAge=0:')
  console.log('Rows:', text.split('\n').length)
  console.log(text.split('\n').slice(0, 10).join('\n'))
}
main().catch(console.error)
