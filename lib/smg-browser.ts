import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { existsSync } from 'fs';
import path from 'path';

const SESSION_FILE = path.join(process.cwd(), 'smg-session.json');

export async function getSMGAuthenticatedPage(): Promise<{ browser: Browser; context: BrowserContext; page: Page }> {
  if (!existsSync(SESSION_FILE)) {
    throw new Error('SMG session file not found. Please run: npx tsx scripts/smg-login.ts');
  }

  const browser = await chromium.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  try {
    // Load session
    const context = await browser.newContext({ storageState: SESSION_FILE });
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

