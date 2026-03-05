import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

async function main() {
  const { getTableauAuthToken } = await import('../lib/tableau-client')
  const { token, siteId } = await getTableauAuthToken()
  
  const workbooks = {
    'Zero Bad Canceled': '63bc9637-9a7b-44db-b62d-a9a1e5dc6982',
    'Audit Summary': '3cadf2a2-514b-4efc-8e21-4545aefd6252',
    'Store Leadership': '6ce0f96f-49f4-49b9-83db-1edcaa783638',
    'Loss Prevention': '16aa06c0-e817-41cd-9f32-6c68d2aac94a',
  }
  
  for (const [name, workbookId] of Object.entries(workbooks)) {
    const res = await fetch(
      `https://us-east-1.online.tableau.com/api/3.21/sites/${siteId}/workbooks/${workbookId}/views`,
      { headers: { 'X-Tableau-Auth': token, 'Accept': 'application/json' } }
    )
    const data = await res.json()
    const views = data?.views?.view || []
    console.log(`\n=== ${name} ===`)
    views.forEach((v: any) => console.log(`  ${v.id} - ${v.name}`))
    
    // Try first view data
    if (views.length > 0) {
      const res2 = await fetch(
        `https://us-east-1.online.tableau.com/api/3.21/sites/${siteId}/views/${views[0].id}/data`,
        { headers: { 'X-Tableau-Auth': token } }
      )
      const text = await res2.text()
      console.log(`  First view rows: ${text.split('\n').length}`)
      console.log(`  Headers: ${text.split('\n')[0]}`)
      console.log(`  Row 2: ${text.split('\n')[1]}`)
    }
  }
}
main().catch(console.error)
