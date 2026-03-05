import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

async function main() {
  const { getTableauAuthToken } = await import('../lib/tableau-client')
  const { token, siteId } = await getTableauAuthToken()
  
  // Check Store Leadership - already has franchise view
  // And check Ops One Stop Shop which sounds promising
  const workbooks: Record<string, string> = {
    'Ops One Stop Shop': '5231ea91-4dd6-45a9-bcf5-bd7e645c7b44',
    'Store Leadership': '6ce0f96f-49f4-49b9-83db-1edcaa783638',
    'Daily Operating Report': 'f7362040-3445-4dd9-a61f-357d89d7368f',
  }
  
  for (const [name, workbookId] of Object.entries(workbooks)) {
    const res = await fetch(
      `https://us-east-1.online.tableau.com/api/3.21/sites/${siteId}/workbooks/${workbookId}/views`,
      { headers: { 'X-Tableau-Auth': token, 'Accept': 'application/json' } }
    )
    const data = await res.json()
    const views = data?.views?.view || []
    console.log(`\n=== ${name} ===`)
    for (const v of views.slice(0, 3)) {
      const res2 = await fetch(
        `https://us-east-1.online.tableau.com/api/3.21/sites/${siteId}/views/${v.id}/data`,
        { headers: { 'X-Tableau-Auth': token } }
      )
      const text = await res2.text()
      const rows = text.split('\n')
      console.log(`  ${v.name}: ${rows.length} rows | headers: ${rows[0]?.substring(0, 80)}`)
      if (rows.length > 5) console.log(`  sample: ${rows[1]?.substring(0, 80)}`)
    }
  }
}
main().catch(console.error)
