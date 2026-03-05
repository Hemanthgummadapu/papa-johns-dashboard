import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
import { writeFileSync } from 'fs'

async function main() {
  const { getTableauAuthToken } = await import('../lib/tableau-client')
  const { token, siteId } = await getTableauAuthToken()
  
  // Audit Summary - main view
  const auditSummaryViewId = 'f9e9cb6d-6b66-4d91-9c7d-210d3d4ba09b'
  const pivotedViewId = 'fda22b49-96b3-4092-972d-93e700fa746c'
  
  // Get audit summary
  const res = await fetch(
    `https://us-east-1.online.tableau.com/api/3.21/sites/${siteId}/views/${auditSummaryViewId}/data`,
    { headers: { 'X-Tableau-Auth': token } }
  )
  const text = await res.text()
  writeFileSync('/tmp/audit-summary.csv', text)
  console.log('Audit Summary rows:', text.split('\n').length)
  console.log('First 10 rows:')
  console.log(text.split('\n').slice(0, 10).join('\n'))
  
  // Get pivoted summary  
  const res2 = await fetch(
    `https://us-east-1.online.tableau.com/api/3.21/sites/${siteId}/views/${pivotedViewId}/data`,
    { headers: { 'X-Tableau-Auth': token } }
  )
  const text2 = await res2.text()
  writeFileSync('/tmp/audit-pivoted.csv', text2)
  console.log('\nPivoted Summary rows:', text2.split('\n').length)
  console.log('First 10 rows:')
  console.log(text2.split('\n').slice(0, 10).join('\n'))
}
main().catch(console.error)
