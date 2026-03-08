const { execSync } = require('child_process');
const path = require('path');

async function run() {
  const root = path.join(__dirname, '../../');
  const npx = 'npx';

  try {
    console.log(`[${new Date().toISOString()}] Starting SMG session refresh...`);
    execSync(`${npx} tsx scripts/smg-auto-session.ts`, {
      cwd: root,
      stdio: 'inherit',
      timeout: 120000
    });
    console.log(`[${new Date().toISOString()}] SMG session refreshed`);

    console.log(`[${new Date().toISOString()}] Starting SMG scrape...`);
    execSync(`node scripts/test-smg-one-store.js`, {
      cwd: root,
      stdio: 'inherit',
      timeout: 600000
    });
    console.log(`[${new Date().toISOString()}] SMG scrape complete`);

    console.log(`[${new Date().toISOString()}] Starting SMG comments scrape...`);
    execSync(`${npx} tsx scripts/smg-scrape-comments.ts`, {
      cwd: root,
      stdio: 'inherit',
      timeout: 120000
    });
    console.log(`[${new Date().toISOString()}] SMG comments complete`);

    return { success: true };
  } catch (err) {
    console.error(`[${new Date().toISOString()}] SMG job failed:`, err.message);
    throw err;
  }
}

module.exports = { run };
