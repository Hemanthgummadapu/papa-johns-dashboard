async function run() {
  const baseUrl = process.env.NEXTJS_URL || 'http://localhost:3000'
  const apiKey = process.env.SCRAPER_API_KEY
  const res = await fetch(`${baseUrl}/api/hotschedules/sync`, {
    headers: apiKey ? { 'x-api-key': apiKey } : {},
  })
  const data = await res.json().catch(() => ({}))
  console.log(`[${new Date().toISOString()}] hotschedules result:`, JSON.stringify(data))
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
  return { success: true, data }
}

module.exports = { run }
