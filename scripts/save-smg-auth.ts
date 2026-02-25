import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto('https://extranet.papajohns.com/GatewayMenu/#/GATEWAY');
  console.log('👉 Login manually, complete MFA, wait for Gateway tiles...');

  await page.waitForSelector('text=PIE - Powered by SMG', { timeout: 0 });
  await context.storageState({ path: 'smg-session.json' });
  console.log('✅ Saved to smg-session.json');

  await browser.close();
})();

