async function run() {
  try {
    const baseUrl = process.env.NEXTJS_URL || 'http://localhost:3000';
    const apiKey = process.env.SCRAPER_API_KEY;
    const res = await fetch(`${baseUrl}/api/cube?period=daily`, {
      method: 'GET',
      headers: apiKey ? { 'x-api-key': apiKey } : {},
    });
    const data = await res.json().catch(() => ({}));
    console.log(`[${new Date().toISOString()}] cubeRefresh result:`, JSON.stringify(data));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return { success: true, data };
  } catch (err) {
    console.error(`[${new Date().toISOString()}] cubeRefresh FAILED:`, err.message);
    throw err;
  }
}

module.exports = { run };
