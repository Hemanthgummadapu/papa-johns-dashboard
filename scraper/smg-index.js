require('dotenv').config();
const express = require('express');
const cron = require('node-cron');
const smg = require('./jobs/smg');

const app = express();
const PORT = process.env.PORT || 3002;

let lastRun = null;

function requireApiKey(req, res, next) {
  const key = req.headers['x-api-key'];
  const expected = process.env.SCRAPER_API_KEY;
  if (!expected || key !== expected) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Missing or invalid x-api-key' });
  }
  next();
}

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'smg-scraper', lastRun, timestamp: new Date() });
});

app.post('/run/smg', requireApiKey, async (req, res) => {
  try {
    await smg.run();
    lastRun = new Date().toISOString();
    res.json({ success: true, job: 'smg' });
  } catch (err) {
    res.status(500).json({ success: false, job: 'smg', error: err.message });
  }
});

cron.schedule('0 */5 * * *', async () => {
  try {
    await smg.run();
    lastRun = new Date().toISOString();
  } catch (err) {
    console.error(`[${new Date().toISOString()}] SMG job failed:`, err.message);
  }
}, { timezone: 'America/Chicago' });

app.listen(PORT, () => {
  console.log(`SMG scraper running on port ${PORT}`);
  console.log('NEXTJS_URL:', process.env.NEXTJS_URL);
});
