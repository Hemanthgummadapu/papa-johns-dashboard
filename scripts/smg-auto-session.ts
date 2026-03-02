import { chromium } from 'playwright';
import { existsSync, unlinkSync } from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const EXTRANET_SESSION_FILE = path.join(process.cwd(), 'scripts', 'session.json');
const SMG_SESSION_FILE = path.join(process.cwd(), 'smg-session.json');

async function refreshSMGSession() {
  // Check if extranet session exists
  if (!existsSync(EXTRANET_SESSION_FILE)) {
    throw new Error('extranet-session.json not found. Please run extranet login first.');
  }

  console.log('=== Loading extranet session ===');
  const browser = await chromium.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  try {
    // Load extranet session
    const context = await browser.newContext({ storageState: EXTRANET_SESSION_FILE });
    const page = await context.newPage();

    // Navigate to extranet gateway
    console.log('=== Navigating to extranet gateway ===');
    await page.goto('https://extranet.papajohns.com/GatewayMenu/#/GATEWAY', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    await page.waitForTimeout(3000);

    // Verify we're logged in
    const currentUrl = page.url();
    if (!currentUrl.includes('extranet.papajohns.com')) {
      throw new Error('Not logged into extranet. Session may have expired.');
    }

    console.log('=== Searching for PIE - Powered by SMG link ===');
    
    // Debug: Find what links are available on the page
    const links = await page.evaluate(() => 
      Array.from(document.querySelectorAll('a, button, [role="link"]'))
        .map(el => ({ text: el.textContent?.trim(), href: (el as HTMLAnchorElement).href }))
        .filter(l => l.text && l.text.length > 0)
    );
    console.log('Available links:', JSON.stringify(links.slice(0, 30), null, 2));
    
    // Wait for page to be fully loaded
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    
    // Try to find and click the SMG link using multiple strategies
    let linkClicked = false;
    
    // Strategy 1: Try Playwright locators
    const locatorStrategies = [
      () => page.getByText('PIE - Powered by SMG', { exact: false }),
      () => page.getByText('PIE', { exact: false }).filter({ hasText: 'SMG' }),
      () => page.locator('a').filter({ hasText: /PIE.*SMG/i }),
      () => page.locator('a[href*="smg"]'),
      () => page.locator('a[href*="SMG"]'),
    ];

    for (const getLocator of locatorStrategies) {
      try {
        const locator = getLocator();
        const count = await locator.count();
        if (count > 0) {
          const firstLink = locator.first();
          const isVisible = await firstLink.isVisible({ timeout: 3000 }).catch(() => false);
          if (isVisible) {
            await firstLink.click();
            linkClicked = true;
            console.log('=== Clicked SMG link using locator strategy ===');
            break;
          }
        }
      } catch (e) {
        continue;
      }
    }

    // Strategy 2: Use page.evaluate to find and click
    if (!linkClicked) {
      console.log('=== Trying to find link by evaluating page content ===');
      linkClicked = await page.evaluate(() => {
        // Try multiple approaches
        const allLinks = Array.from(document.querySelectorAll('a'));
        
        // Look for link with "PIE" and "SMG" in text
        const smgLink = allLinks.find(link => {
          const text = link.textContent || '';
          return text.includes('PIE') && (text.includes('SMG') || text.includes('smg'));
        });
        
        if (smgLink) {
          (smgLink as HTMLElement).click();
          return true;
        }
        
        // Look for link with href containing smg
        const hrefLink = allLinks.find(link => {
          const href = link.getAttribute('href') || '';
          return href.toLowerCase().includes('smg');
        });
        
        if (hrefLink) {
          (hrefLink as HTMLElement).click();
          return true;
        }
        
        return false;
      });

      if (!linkClicked) {
        // Debug: Get all links for troubleshooting
        const allLinks = await page.evaluate(() => {
          return Array.from(document.querySelectorAll('a')).map(a => ({
            text: a.textContent?.trim(),
            href: a.getAttribute('href'),
            id: a.id,
            className: a.className
          }));
        });
        console.log('Available links on page:', JSON.stringify(allLinks, null, 2));
        throw new Error('Could not find "PIE - Powered by SMG" link on the gateway page');
      }
      
      console.log('=== Clicked SMG link using page.evaluate ===');
    }

    // Wait for SMG to load (SSO redirect)
    console.log('=== Waiting for reporting.smg.com to load ===');
    try {
      await page.waitForURL('**/reporting.smg.com/**', { timeout: 120000 }); // 2 minute timeout
    } catch (e) {
      const currentUrl = page.url();
      if (currentUrl.includes('login.microsoftonline.com')) {
        console.error('❌ SMG SESSION EXPIRED - Microsoft login required');
        if (existsSync(EXTRANET_SESSION_FILE)) {
          unlinkSync(EXTRANET_SESSION_FILE);
          console.log('Deleted extranet-session.json');
        }
        if (existsSync(SMG_SESSION_FILE)) {
          unlinkSync(SMG_SESSION_FILE);
          console.log('Deleted smg-session.json');
        }
        
        // Save status to Supabase
        try {
          const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
          );
          await supabase.from('scraper_status').update({
            last_error_at: new Date().toISOString(),
            last_error_message: 'Microsoft session expired',
            session_expired: true,
            updated_at: new Date().toISOString()
          }).eq('id', 'smg');
        } catch (statusError) {
          console.error('Failed to update scraper status:', statusError);
        }
        
        throw new Error('SMG_SESSION_EXPIRED');
      }
      throw e;
    }
    await page.waitForTimeout(3000);

    // Verify we're on SMG dashboard
    const finalUrl = page.url();
    if (!finalUrl.includes('reporting.smg.com')) {
      throw new Error('Failed to reach SMG dashboard. Current URL: ' + finalUrl);
    }

    console.log('=== SMG dashboard loaded ===');

    // Save combined session (extranet + SMG cookies)
    await context.storageState({ path: SMG_SESSION_FILE });
    console.log(`✅ SMG session refreshed automatically`);
    console.log(`=== Session saved to ${SMG_SESSION_FILE} ===`);
    
    // Update scraper status on success
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      await supabase.from('scraper_status').update({
        last_success_at: new Date().toISOString(),
        last_error_message: null,
        session_expired: false,
        updated_at: new Date().toISOString()
      }).eq('id', 'smg');
    } catch (statusError) {
      console.error('Failed to update scraper status:', statusError);
    }

  } catch (error: any) {
    console.error('Error refreshing SMG session:', error.message);
    
    // Update scraper status on error (if not already SMG_SESSION_EXPIRED)
    if (!error.message.includes('SMG_SESSION_EXPIRED')) {
      try {
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        );
        await supabase.from('scraper_status').update({
          last_error_at: new Date().toISOString(),
          last_error_message: error.message || 'SMG session refresh failed',
          session_expired: false,
          updated_at: new Date().toISOString()
        }).eq('id', 'smg');
      } catch (statusError) {
        console.error('Failed to update scraper status:', statusError);
      }
    }
    
    throw error;
  } finally {
    await browser.close();
  }
}

// Run if called directly
if (require.main === module) {
  refreshSMGSession().catch((error) => {
    console.error('Failed to refresh SMG session:', error);
    process.exit(1);
  });
}

export { refreshSMGSession };

