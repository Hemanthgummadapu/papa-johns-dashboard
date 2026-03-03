const { Pool } = require('pg');

let pool = null;

function getPool() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set');
  }
  if (!pool) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
  }
  return pool;
}

async function initTables() {
  const client = await getPool().connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS scrape_logs (
        id SERIAL PRIMARY KEY,
        job_name VARCHAR(100) NOT NULL,
        status VARCHAR(50) NOT NULL,
        started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        completed_at TIMESTAMPTZ,
        error_message TEXT
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS store_data (
        store_id VARCHAR(50) NOT NULL,
        metric VARCHAR(200) NOT NULL,
        value TEXT,
        period VARCHAR(100),
        scraped_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (store_id, metric, period, scraped_at)
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS settings (
        key VARCHAR(200) PRIMARY KEY,
        value TEXT,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
  } finally {
    client.release();
  }
}

async function logScrapeStart(jobName) {
  const res = await getPool().query(
    'INSERT INTO scrape_logs (job_name, status, started_at) VALUES ($1, $2, NOW()) RETURNING id',
    [jobName, 'running']
  );
  return res.rows[0].id;
}

async function logScrapeEnd(logId, status, errorMessage = null) {
  await getPool().query(
    'UPDATE scrape_logs SET status = $1, completed_at = NOW(), error_message = $2 WHERE id = $3',
    [status, errorMessage, logId]
  );
}

module.exports = { getPool, initTables, logScrapeStart, logScrapeEnd };
