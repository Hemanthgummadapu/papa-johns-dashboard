import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

async function main() {
  const { getTableauAuthToken } = await import('../lib/tableau-client')
  const { token, siteId } = await getTableauAuthToken()
  
  const viewId = 'e77c8165-d943-4674-97f8-4a4a7f06a0ad' // Hotschedules-Store Level
  
  // Try the correct CSV export endpoint
  const res = await fetch(
    `https://us-east-1.online.tableau.com/api/3.21/sites/${siteId}/views/${viewId}/crosstab/excel`,
    { headers: { 'X-Tableau-Auth': token } }
  )
  console.log('Excel status:', res.status)

  // Also try the data endpoint with no Accept header
  const res2 = await fetch(
    `https://us-east-1.online.tableau.com/api/3.21/sites/${siteId}/views/${viewId}/data`,
    { headers: { 'X-Tableau-Auth': token } }
  )
  const text2 = await res2.text()
  console.log('Data status:', res2.status)
  console.log('Content-Type:', res2.headers.get('content-type'))
  console.log('Preview:', text2.substring(0, 500))
}
main().catch(console.error)
