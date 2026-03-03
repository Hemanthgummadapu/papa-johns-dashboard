const { logScrapeStart, logScrapeEnd } = require('../db');

async function run() {
  const logId = await logScrapeStart('pjExtranet');
  try {
    const baseUrl = process.env.NEXTJS_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const apiKey = process.env.SCRAPER_API_KEY;
    const res = await fetch(`${baseUrl}/api/cron`, {
      method: 'GET',
      headers: apiKey ? { 'x-api-key': apiKey } : {},
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || data.message || `HTTP ${res.status}`);
    }
    await logScrapeEnd(logId, 'success');
    return { success: true, data };
  } catch (err) {
    await logScrapeEnd(logId, 'failed', err.message);
    throw err;
  }
}

module.exports = { run };
