import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

// Must set env vars BEFORE importing tableau-client
// since TABLEAU_CONFIG reads process.env at module load time
async function main() {
  console.log('Server URL:', process.env.TABLEAU_SERVER_URL)
  console.log('Token name:', process.env.TABLEAU_TOKEN_NAME)
  console.log('Token secret set:', !!process.env.TABLEAU_TOKEN_SECRET)
  
  // Dynamic import AFTER dotenv loads
  const { getTableauAuthToken } = await import('../lib/tableau-client')
  
  try {
    const { token, siteId } = await getTableauAuthToken()
    console.log('✅ Auth success! Token:', token.substring(0, 20) + '...')
    console.log('Site ID:', siteId)
  } catch (err: any) {
    console.error('❌ Auth failed:', err.message)
  }
}
main()
