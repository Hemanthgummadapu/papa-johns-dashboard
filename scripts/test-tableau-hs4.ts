import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
import { writeFileSync } from 'fs'

async function main() {
  const { getTableauAuthToken } = await import('../lib/tableau-client')
  const { token, siteId } = await getTableauAuthToken()
  
  const viewId = 'e77c8165-d943-4674-97f8-4a4a7f06a0ad'
  
  const res = await fetch(
    `https://us-east-1.online.tableau.com/api/3.21/sites/${siteId}/views/${viewId}/data`,
    { headers: { 'X-Tableau-Auth': token } }
  )
  const text = await res.text()
  
  // Save full CSV to inspect
  writeFileSync('/tmp/hs-data.csv', text)
  console.log('Total rows:', text.split('\n').length)
  console.log('First 20 rows:')
  console.log(text.split('\n').slice(0, 20).join('\n'))
}
main().catch(console.error)
