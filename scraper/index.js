require('dotenv').config();
const express = require('express');
const cron = require('node-cron');
const { getPool, initTables } = require('./db');
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

// Cron: PJ Extranet 6am daily
cron.schedule('0 6 * * *', () => runJob('pjExtranet'), { timezone: 'America/Chicago' });

// Cron: SMG 7am daily
cron.schedule('0 7 * * *', () => runJob('smg'), { timezone: 'America/Chicago' });

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

app.get('/health', async (req, res) => {
  let dbOk = false;
  let lastRunRows = [];
  try {
    const pool = getPool();
    const r = await pool.query(
      'SELECT job_name, status, started_at, completed_at FROM scrape_logs ORDER BY started_at DESC LIMIT 10'
    );
    lastRunRows = r.rows;
    dbOk = true;
  } catch (_e) {
    // DB unavailable, status remains degraded
  }
  res.json({
    status: dbOk ? 'ok' : 'degraded',
    timestamp: new Date(),
    database: dbOk ? 'connected' : 'disconnected',
    lastRuns,
    recentLogs: lastRunRows,
  });
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
  if (process.env.DATABASE_URL) {
    try {
      await initTables();
    } catch (_e) {
      // Tables may already exist or DB not yet available
    }
  }
  app.listen(PORT);
}

start().catch((err) => {
  process.exit(1);
});
