import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

async function main() {
  const { getTableauAuthToken } = await import('../lib/tableau-client')
  const { token, siteId } = await getTableauAuthToken()
  
  const views = {
    badOrderSummary: '235ac17d-2e73-46be-ba0a-6c4fef76e73e',
    zeroedOutSummary: 'a73dd014-36b2-4da1-af90-55621b4ac0ab',
    canceledOrderSummary: '1c468a1d-fdda-4abb-82aa-dea509b4139c',
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
    console.log('First 3 rows:')
    console.log(text.split('\n').slice(0, 3).join('\n'))
  }
}
main().catch(console.error)
