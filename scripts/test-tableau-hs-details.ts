import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

async function main() {
  const { getTableauAuthToken } = await import('../lib/tableau-client')
  const { token, siteId } = await getTableauAuthToken()
  
  const views = {
    'HS-Pivoted': '1dd9f6b1-a4aa-489b-9e5b-b4cfbd2ddf64',
    'HS-Details': '26b315ea-ee84-4467-819a-1b0bb96121fb',
  }
  
  for (const [name, viewId] of Object.entries(views)) {
    const res = await fetch(
      `https://us-east-1.online.tableau.com/api/3.21/sites/${siteId}/views/${viewId}/data`,
      { headers: { 'X-Tableau-Auth': token } }
    )
    const text = await res.text()
    const rows = text.split('\n').filter(l => l.trim())
    console.log(`\n=== ${name} ===`)
    console.log('Headers:', rows[0])
    console.log('Total rows:', rows.length)
    console.log('Sample rows:')
    rows.slice(1, 6).forEach(r => console.log(' ', r.substring(0, 120)))
  }
}
main().catch(console.error)
