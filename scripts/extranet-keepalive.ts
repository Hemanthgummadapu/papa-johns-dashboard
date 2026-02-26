import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const SESSION_FILE = path.join(process.cwd(), 'extranet-session.json');

async function keepAlive() {
  if (!fs.existsSync(SESSION_FILE)) {
    console.log('❌ No extranet session file found');
    process.exit(1);
  }

  const sessionData = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf-8'));
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  await context.addCookies(sessionData.cookies);
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

    // Save refreshed cookies back to keep them fresh
    const cookies = await context.cookies();
    const allCookies = { ...sessionData, cookies };
    fs.writeFileSync(SESSION_FILE, JSON.stringify(allCookies, null, 2));
    console.log(`✅ Extranet session alive and refreshed at ${new Date().toISOString()}`);
  } catch (err) {
    console.error('❌ Keepalive failed:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

keepAlive().catch(console.error);


