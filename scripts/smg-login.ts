import { chromium } from 'playwright';
import path from 'path';

const SESSION_FILE = path.join(process.cwd(), 'smg-session.json');

async function smgLogin() {
  console.log('=== SMG Manual Login Script ===');
  console.log('This will open a browser window. Please:');
  console.log('1. Navigate to Papa Johns gateway');
  console.log('2. Click "PIE - Powered by SMG"');
  console.log('3. Complete any SSO/MFA if prompted');
  console.log('4. Wait for reporting.smg.com to load');
  console.log('5. Session will be saved automatically');
  console.log('');

  const browser = await chromium.launch({ 
    headless: false, // Visible browser for manual interaction
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Navigate to gateway
    console.log('Navigating to Papa Johns gateway...');
    await page.goto('https://extranet.papajohns.com/GatewayMenu/#/GATEWAY');
    await page.waitForTimeout(2000);

    console.log('=== Please click "PIE - Powered by SMG" in the browser window ===');
    console.log('=== Waiting for reporting.smg.com to load... ===');
    
    // Wait for SMG to load (SSO redirect)
    await page.waitForURL('**/reporting.smg.com/**', { timeout: 120000 }); // 2 minute timeout
    await page.waitForTimeout(3000);
    
    console.log('=== SMG dashboard loaded ===');
    
    // Verify we're on the SMG dashboard
    const currentUrl = page.url();
    if (!currentUrl.includes('reporting.smg.com')) {
      throw new Error('Failed to reach SMG dashboard. Current URL: ' + currentUrl);
    }

    // Save session
    await context.storageState({ path: SESSION_FILE });
    console.log(`=== Session saved to ${SESSION_FILE} ===`);
    console.log('=== Login complete! You can close the browser window. ===');
    
    // Keep browser open for a moment so user can see it worked
    await page.waitForTimeout(2000);
    
  } catch (error: any) {
    console.error('Login error:', error.message);
    throw error;
  } finally {
    await browser.close();
  }
}

// Run if called directly
if (require.main === module) {
  smgLogin().catch((error) => {
    console.error('Failed to complete SMG login:', error);
    process.exit(1);
  });
}

export { smgLogin };


