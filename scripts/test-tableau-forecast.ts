import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

async function main() {
  const { getTableauAuthToken } = await import('../lib/tableau-client')
  const { token, siteId } = await getTableauAuthToken()
  
  // Check workbooks that might have forecasting
  const workbooks: Record<string, string> = {
    'Profitability Analysis': 'e6945146-6bf6-4635-b192-5d2fa7b84a2c',
    'Daily Operating Report': 'f7362040-3445-4dd9-a61f-357d89d7368f',
    'Papanet Interval Report': '35223ed4-76b4-4b36-875c-94357d21f51a',
  }
  
  for (const [name, workbookId] of Object.entries(workbooks)) {
    const res = await fetch(
      `https://us-east-1.online.tableau.com/api/3.21/sites/${siteId}/workbooks/${workbookId}/views`,
      { headers: { 'X-Tableau-Auth': token, 'Accept': 'application/json' } }
    )
    const data = await res.json()
    const views = data?.views?.view || []
    console.log(`\n=== ${name} ===`)
    for (const v of views.slice(0, 4)) {
      const res2 = await fetch(
        `https://us-east-1.online.tableau.com/api/3.21/sites/${siteId}/views/${v.id}/data`,
        { headers: { 'X-Tableau-Auth': token } }
      )
      const text = await res2.text()
      const rows = text.split('\n')
      console.log(`  ${v.name}: ${rows.length} rows | ${rows[0]?.substring(0, 100)}`)
      if (rows.length > 3) console.log(`    sample: ${rows[1]?.substring(0, 100)}`)
    }
  }
}
main().catch(console.error)
