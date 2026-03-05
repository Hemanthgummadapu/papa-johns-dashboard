require('dotenv').config();
const express = require('express');
const cron = require('node-cron');
const pjExtranet = require('./jobs/pjExtranet');
const smg = require('./jobs/smg');
const cubeRefresh = require('./jobs/cubeRefresh');

const app = express();
const PORT = process.env.PORT || 3001;

const JOBS = {
  pjExtranet,
  smg,
  cubeRefresh,
};

let lastRuns = { pjExtranet: null, smg: null, cubeRefresh: null };

function updateLastRun(jobName) {
  lastRuns[jobName] = new Date().toISOString();
}

async function runJob(jobName) {
  const job = JOBS[jobName];
  if (!job) return;
  try {
    await job.run();
    updateLastRun(jobName);
  } catch (_err) {
    // Job failure logged in scrape_logs
  }
}

// Cron: PJ Extranet every 15 minutes
cron.schedule('*/15 * * * *', () => runJob('pjExtranet'), { timezone: 'America/Chicago' });

// Cron: SMG every 5 hours
cron.schedule('0 */5 * * *', () => runJob('smg'), { timezone: 'America/Chicago' });

// Cron: Cube refresh every hour
cron.schedule('0 * * * *', () => runJob('cubeRefresh'), { timezone: 'America/Chicago' });

function requireApiKey(req, res, next) {
  const key = req.headers['x-api-key'];
  const expected = process.env.SCRAPER_API_KEY;
  if (!expected || key !== expected) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Missing or invalid x-api-key' });
  }
  next();
}

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date(), lastRuns });
});

app.post('/run/:job', requireApiKey, async (req, res) => {
  const jobName = req.params.job;
  if (!JOBS[jobName]) {
    return res.status(404).json({ error: 'Not found', message: `Unknown job: ${jobName}` });
  }
  try {
    await JOBS[jobName].run();
    updateLastRun(jobName);
    res.json({ success: true, job: jobName });
  } catch (err) {
    res.status(500).json({ success: false, job: jobName, error: err.message });
  }
});

app.use(express.json());

async function start() {
  console.log('Scraper starting. NEXTJS_URL:', process.env.NEXTJS_URL);
  app.listen(PORT);
}

start().catch((err) => {
  process.exit(1);
});
