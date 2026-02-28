import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const SESSION_FILE = path.join(process.cwd(), 'extranet-session.json');

async function keepAlive() {
  if (!fs.existsSync(SESSION_FILE)) {
    console.log('❌ No extranet session file found');
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState: SESSION_FILE });
  const page = await context.newPage();

  try {
    await page.goto('https://extranet.papajohns.com/GatewayMenu/', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    const url = page.url();
    if (url.includes('microsoftonline') || url.includes('login')) {
      console.log('❌ Extranet session expired — manual re-login required');
      await browser.close();
      process.exit(1);
    }

    await context.storageState({ path: SESSION_FILE });
    console.log(`✅ Extranet session alive and refreshed at ${new Date().toISOString()}`);
  } catch (err) {
    console.error('❌ Keepalive failed:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

