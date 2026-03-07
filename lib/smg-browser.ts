import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { existsSync, writeFileSync, mkdirSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

const SMG_SESSION_PATH = '/tmp/smg-session.json';

async function autoReauthSMG(): Promise<boolean> {
  try {
    const { chromium } = await import('playwright');
    const fs = await import('fs');
    const path = (await import('path')).default;

    // Check extranet session exists
    const extranetSessionPath = '/tmp/extranet-session.json';
    const localExtranetPath = path.join(process.cwd(), 'extranet-session.json');

    const sessionPath = fs.existsSync(extranetSessionPath)
      ? extranetSessionPath
      : fs.existsSync(localExtranetPath)
        ? localExtranetPath
        : null;

    if (!sessionPath) return false; // Can't reauth without extranet session

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ storageState: sessionPath });
    const page = await context.newPage();

    // Navigate to extranet gateway
    await page.goto('https://extranet.papajohns.com/GatewayMenu/#/GATEWAY', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await page.waitForTimeout(3000);

    // Click PIE - Powered by SMG
    await page.click('text=PIE - Powered by SMG');

    // Wait for SMG redirect
    await page.waitForURL('**/reporting.smg.com/**', { timeout: 30000 });
    await page.waitForTimeout(3000);

    // Save new SMG session
    await context.storageState({ path: SMG_SESSION_PATH });
    await browser.close();

    // Save to Supabase
    try {
      const { getSupabaseAdminClient } = await import('./db');
      const supabase = getSupabaseAdminClient();
      const sessionData = fs.readFileSync(SMG_SESSION_PATH, 'utf-8');
      await supabase
        .from('scraper_status')
        .update({
          session_expired: false,
          last_success_at: new Date().toISOString(),
          last_error_message: null,
        })
        .eq('id', 'smg');
      await supabase.from('scraper_status').upsert({
        key: 'smg_session_state',
        value: sessionData,
      });
    } catch (e) {
      // Non-fatal - session file saved locally at least
    }

    console.log('[smg-session] Auto-reauth successful via extranet SSO');
    return true;
  } catch (err) {
    console.error('[smg-session] Auto-reauth failed:', err);
    return false;
  }
}

export async function loadSMGSessionFromSupabase(): Promise<void> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );
    const { data } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'smg_session_state')
      .single();
    if (data?.value) {
      mkdirSync('/tmp', { recursive: true });
      writeFileSync(SMG_SESSION_PATH, data.value);
      console.log('[smg-session] Loaded from Supabase → /tmp/smg-session.json');
    }
  } catch (err) {
    console.error('[smg-session] Failed to load from Supabase:', err);
  }
}

export async function getSMGAuthenticatedPage(): Promise<{ browser: Browser; context: BrowserContext; page: Page }> {
  await loadSMGSessionFromSupabase();

  if (!existsSync(SMG_SESSION_PATH)) {
    throw new Error('SMG session file not found. Please run: npx tsx scripts/smg-login.ts');
  }

  const browser = await chromium.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  try {
    // Load session
    const context = await browser.newContext({ storageState: SMG_SESSION_PATH });
    const page = await context.newPage();

    // Verify session is valid by navigating to SMG dashboard
    await page.goto('https://reporting.smg.com/dashboard.aspx?id=5', {
      waitUntil: 'domcontentloaded',
      timeout: 15000
    });

    // Check if we're still on SMG (not redirected to login)
    const currentUrl = page.url();
    if (!currentUrl.includes('reporting.smg.com')) {
      await browser.close();
      throw new Error('SMG session expired — run npx tsx scripts/smg-login.ts');
    }

    // Additional check: look for SMG-specific content
    const pageText = await page.evaluate(() => document.body.innerText);
    if (pageText.includes('Sign in') || pageText.includes('Login') || pageText.includes('Microsoft')) {
      await browser.close();
      throw new Error('SMG session expired — run npx tsx scripts/smg-login.ts');
    }

    return { browser, context, page };
  } catch (error: any) {
    await browser.close();
    if (error.message.includes('session expired')) {
      // BEFORE throwing, try auto-reauth once
      const reauthed = await autoReauthSMG();
      if (reauthed) {
        return getSMGAuthenticatedPage();
      }
      throw error;
    }
    throw new Error(`Failed to authenticate SMG session: ${error.message}`);
  }
}

