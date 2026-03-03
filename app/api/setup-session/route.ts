// OPS TOOL - manual session setup, not used by UI
// This endpoint opens a browser for manual extranet login to create/update extranet-session.json
// Used for initial setup or re-authentication when session expires
import { chromium } from 'playwright';

export const dynamic = 'force-dynamic';

export async function GET() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto('https://extranet.papajohns.com');
    await page.waitForURL('**/extranet.papajohns.com/**', { timeout: 120000 });
    await page.waitForTimeout(3000);
    await context.storageState({ path: './extranet-session.json' });
    await browser.close();
    
    return Response.json({ 
      success: true, 
      message: 'Session saved successfully. You can now use the scraper without MFA.' 
    });
  } catch (error: any) {
    await browser.close();
    
    if (error.message.includes('timeout')) {
      return Response.json({ 
        success: false, 
        error: 'Login timeout - please try again and complete MFA within 120 seconds' 
      }, { status: 408 });
    }
    
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}


