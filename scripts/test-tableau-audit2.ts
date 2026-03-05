import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

async function main() {
  const { getTableauAuthToken } = await import('../lib/tableau-client')
  const { token, siteId } = await getTableauAuthToken()
  
  const views = {
    badOrderDetails: '80a213a3-3ffa-433f-8ee4-b72c6fa6bb6d',
    zeroedOutDetails: 'f43d5823-937c-4273-8aef-3e90a4f859a0',
    canceledOrderDetails: '7e2ec3c6-4ca6-47cd-a5f2-f7a08b5c785a',
    refundOrderDetails: 'bc43483e-48ee-4fb7-a4b1-575111728e5c',
  }
  
  for (const [name, viewId] of Object.entries(views)) {
    const res = await fetch(
      `https://us-east-1.online.tableau.com/api/3.21/sites/${siteId}/views/${viewId}/data`,
      { headers: { 'X-Tableau-Auth': token } }
    )
    const text = await res.text()
    console.log(`\n=== ${name} ===`)
    console.log('Status:', res.status)
    console.log('Rows:', text.split('\n').length)
    console.log('First 5 rows:')
    console.log(text.split('\n').slice(0, 5).join('\n'))
  }
}
main().catch(console.error)
