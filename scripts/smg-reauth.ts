/**
 * Manual SMG re-authentication script.
 * Run with headless: false and slowMo so you can complete MFA in the browser.
 * Usage: npm run smg:reauth
 */
import { chromium } from 'playwright';
import { existsSync, copyFileSync, readFileSync } from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const EXTRANET_SESSION_FILE = path.join(process.cwd(), 'extranet-session.json');
const SMG_SESSION_FILE = path.join(process.cwd(), 'smg-session.json');

async function reauth() {
  console.log('=== SMG Re-authentication (manual MFA) ===');
  console.log('A browser window will open. Complete Microsoft login/MFA if prompted.\n');

  const browser = await chromium.launch({
    headless: false,
    slowMo: 500,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  try {
    let context;
    if (existsSync(EXTRANET_SESSION_FILE)) {
      console.log('Loading extranet-session.json...');
      context = await browser.newContext({ storageState: EXTRANET_SESSION_FILE });
    } else {
      console.log('No extranet-session.json found. Starting fresh — complete full login in browser.');
      context = await browser.newContext();
    }

    const page = await context.newPage();

    if (!existsSync(EXTRANET_SESSION_FILE)) {
      // Full extranet login — user completes in browser
      console.log('Navigating to extranet...');
      await page.goto('https://extranet.papajohns.com/GatewayMenu/', {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      });
      console.log('Complete Microsoft login and MFA in the browser. Waiting for extranet...');
      await page.waitForURL('**/extranet.papajohns.com/**', { timeout: 120000 });
      await page.waitForTimeout(2000);
      await context.storageState({ path: EXTRANET_SESSION_FILE });
      console.log('✅ Extranet session saved.');
    }

    // Navigate to gateway (required for SMG link)
    console.log('Navigating to extranet gateway...');
    await page.goto('https://extranet.papajohns.com/GatewayMenu/#/GATEWAY', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await page.waitForTimeout(3000);

    // Find and click SMG link
    console.log('Looking for PIE - Powered by SMG link...');
    const linkClicked = await page.evaluate(() => {
      const allLinks = Array.from(document.querySelectorAll('a'));
      const smgLink = allLinks.find(
        (link) =>
          (link.textContent || '').includes('PIE') &&
          ((link.textContent || '').includes('SMG') || (link.textContent || '').includes('smg'))
      );
      if (smgLink) {
        (smgLink as HTMLElement).click();
        return true;
      }
      const hrefLink = allLinks.find(
        (link) => (link.getAttribute('href') || '').toLowerCase().includes('smg')
      );
      if (hrefLink) {
        (hrefLink as HTMLElement).click();
        return true;
      }
      return false;
    });

    if (!linkClicked) {
      throw new Error('Could not find "PIE - Powered by SMG" link on the gateway page');
    }

    console.log('Clicked SMG link. Complete MFA if prompted. Waiting for reporting.smg.com...');
    await page.waitForURL('**/reporting.smg.com/**', { timeout: 120000 });
    await page.waitForTimeout(3000);

    await context.storageState({ path: SMG_SESSION_FILE });
    // Also copy to /tmp path used by smg-browser.ts
    copyFileSync(SMG_SESSION_FILE, '/tmp/smg-session.json');
    console.log('✅ Session copied to /tmp/smg-session.json');

    // Update Supabase scraper status
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      await supabase.from('scraper_status').update({
        session_expired: false,
        last_success_at: new Date().toISOString(),
        last_error_message: null,
        updated_at: new Date().toISOString()
      }).eq('id', 'smg');
      // Also save session to Supabase so Railway gets fresh session too
      const sessionData = readFileSync(SMG_SESSION_FILE, 'utf-8');
      await supabase.from('settings').upsert({
        key: 'smg_session_state',
        value: sessionData,
      }, { onConflict: 'key' });
      console.log('✅ Scraper status cleared in Supabase');
    } catch (statusError) {
      console.error('Failed to update scraper status:', statusError);
    }
  } catch (error: any) {
    console.error('Re-auth failed:', error.message);
    throw error;
  } finally {
    await browser.close();
  }
}

reauth().catch((err) => {
  console.error(err);
  process.exit(1);
});
