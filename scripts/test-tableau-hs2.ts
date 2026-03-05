import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

async function main() {
  const { getTableauAuthToken } = await import('../lib/tableau-client')
  const { token, siteId } = await getTableauAuthToken()
  
  const workbookId = '3c2b5fab-75d4-4788-8e05-6a3c716f179c'
  
  // Get all views in the HotSchedules workbook
  const res = await fetch(
    `https://us-east-1.online.tableau.com/api/3.21/sites/${siteId}/workbooks/${workbookId}/views`,
    { headers: { 'X-Tableau-Auth': token, 'Accept': 'application/json' } }
  )
  const data = await res.json()
  const views = data?.views?.view || []
  console.log('Views:', JSON.stringify(views.map((v: any) => ({ 
    id: v.id, 
    name: v.name,
    contentUrl: v.contentUrl 
  })), null, 2))
}
main().catch(console.error)
