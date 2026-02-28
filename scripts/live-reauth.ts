/**
 * Manual extranet live KPI re-authentication script.
 * Run with headless: false and slowMo so you can complete MFA in the browser.
 * Usage: npm run live:reauth
 */
import { chromium } from 'playwright';
import { existsSync } from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const EXTRANET_SESSION_FILE = path.join(process.cwd(), 'extranet-session.json');

async function reauth() {
  console.log('=== Extranet Live KPI Re-authentication (manual MFA) ===');
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

    // Navigate to KPI page for store 2081 to verify session works
    console.log('Navigating to extranet KPI page for store 2081 to verify session...');
    await page.goto(
      'https://extranet.papajohns.com/kpi/#/realtime?type=STORE_ID&id=2081&view=summary',
      { waitUntil: 'domcontentloaded', timeout: 30000 }
    );
    await page.waitForTimeout(3000);

    // Check if session is still valid (not redirected to Microsoft login)
    const currentUrl = page.url();
    if (currentUrl.includes('login.microsoftonline.com')) {
      throw new Error('Session expired during verification. Please try again.');
    }

    console.log('✅ Session verified — successfully accessed KPI page');

    // Save session
    await context.storageState({ path: EXTRANET_SESSION_FILE });
    console.log('\n✅ Extranet session saved - live KPI cron will resume');
    
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
      }).eq('id', 'live_kpi');
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
