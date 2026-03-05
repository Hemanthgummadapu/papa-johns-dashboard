import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

async function main() {
  const { getTableauAuthToken } = await import('../lib/tableau-client')
  const { token, siteId } = await getTableauAuthToken()
  
  // Bad Order Details view - try with filter params
  const viewId = '80a213a3-3ffa-433f-8ee4-b72c6fa6bb6d'
  
  // Try passing store filter and removing time filter
  const params = new URLSearchParams({
    'vf_Operated By': 'Franchise',
    'vf_Store Type': 'Traditional', 
  })
  
  const res = await fetch(
    `https://us-east-1.online.tableau.com/api/3.21/sites/${siteId}/views/${viewId}/data?${params}`,
    { headers: { 'X-Tableau-Auth': token } }
  )
  const text = await res.text()
  console.log('Status:', res.status)
  console.log('Rows:', text.split('\n').length)
  console.log('First 5 rows:')
  console.log(text.split('\n').slice(0, 5).join('\n'))
}
main().catch(console.error)
