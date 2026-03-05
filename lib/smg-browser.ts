import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { existsSync, writeFileSync, mkdirSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

const SMG_SESSION_PATH = '/tmp/smg-session.json';

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
      throw error;
    }
    throw new Error(`Failed to authenticate SMG session: ${error.message}`);
  }
}

