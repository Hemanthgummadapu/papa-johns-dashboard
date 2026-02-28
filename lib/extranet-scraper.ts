import { chromium } from 'playwright';
import { existsSync, unlinkSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const STORE_IDS = ['2021', '2081', '2259', '2292', '2481', '3011'];
const SESSION_FILE = './extranet-session.json';

// Parse function for individual store
function parseStoreData(storeId: string, text: string) {
  const extract = (label: string) => {
    const regex = new RegExp(label + '\\s*\\t?\\s*([\\$-]?[\\d,]+\\.?\\d*%?)');
    const match = text.match(regex);
    return match ? match[1].replace(/[$,]/g, '') : null;
  };

  const timeRegex = (label: string) => {
    const regex = new RegExp(label + '\\s+([\\d]+:[\\d]+)');
    const match = text.match(regex);
    return match ? match[1] : null;
  };

  return {
    store_number: storeId,
    date: new Date().toISOString().split('T')[0],
    total_net_sales: parseFloat(extract('Total Store Net Sales') || '0'),
    ly_net_sales: parseFloat(extract('LY Net Sales') || '0'),
    comp_pct: extract('Comp %'),
    online_net_sales: parseFloat(extract('Online Net Sales') || '0'),
    ly_online_net_sales: parseFloat(extract('LY Online Net Sales') || '0'),
    online_comp_pct: extract('Online Comp %'),
    total_orders: parseInt(extract('Total Orders') || '0'),
    psa_sales: parseFloat(extract('PSA Sales') || '0'),
    ticket_average: parseFloat(extract('Ticket Average') || '0'),
    target_food_cost: parseFloat(extract('Target Food Cost') || '0'),
    target_food_pct: parseFloat(extract('Target Food Cost %') || extract('Target Food %') || '0'),
    delivery_orders: parseInt(extract('Delivery Orders') || '0'),
    avg_make_time: timeRegex('Avg Make Time'),
    avg_rack_time: timeRegex('Avg Rack Time'),
    otd_time: timeRegex('OTD Time'),
    carryout_pct: extract('Carryout %'),
    labor_dollars: parseFloat(extract('Labor Dollars') || '0'),
    labor_pct: parseFloat(extract('Labor %') || '0'),
    orders_to_deliver: parseInt(extract('Orders to Deliver') || '0'),
    product_to_make: parseInt(extract('Product to Make') || '0'),
    scraped_at: new Date().toISOString()
  };
}

async function performLogin(page: any) {
  console.log('=== Performing fresh login ===');
  
  // Go to extranet - will redirect to Microsoft login
  await page.goto('https://extranet.papajohns.com/GatewayMenu/');
  
  // Microsoft login page
  await page.waitForSelector('input[type="email"]', { timeout: 10000 });
  await page.fill('input[type="email"]', process.env.PAPAJOHNS_EXTRANET_USER!);
  await page.click('input[type="submit"]');
  
  // Password field
  await page.waitForSelector('input[type="password"]', { timeout: 10000 });
  await page.fill('input[type="password"]', process.env.PAPAJOHNS_EXTRANET_PASSWORD!);
  await page.click('input[type="submit"]');
  
  // Wait for "Stay signed in?" prompt and click Yes if it appears (wait up to 8 seconds)
  try {
    await page.waitForSelector('#idSIButton9', { timeout: 8000 }); // Yes button
    await page.click('#idSIButton9'); // Click "Yes"
    console.log('=== Clicked "Yes" on Stay signed in prompt ===');
  } catch(e) {
    console.log('=== No "Stay signed in?" prompt found ===');
  }
  
  // Wait for the page to fully leave Microsoft domain and redirect back to extranet
  await page.waitForURL('**/extranet.papajohns.com/**', { timeout: 30000 });
  await page.waitForTimeout(3000);
  console.log('=== Redirected back to extranet.papajohns.com ===');
  
  // Save session after successful login and redirect
  await page.context().storageState({ path: SESSION_FILE });
  console.log('=== Session saved ===');
}

export async function scrapeExtranet() {
  const browser = await chromium.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });
  
  try {
    let context;
    let page;
    
    // Try loading session
    if (existsSync(SESSION_FILE)) {
      try {
        console.log('=== Loading existing session ===');
        context = await browser.newContext({ storageState: SESSION_FILE });
        page = await context.newPage();
        await page.goto('https://extranet.papajohns.com/kpi/#/realtime', 
          { waitUntil: 'domcontentloaded', timeout: 15000 });
        await page.waitForTimeout(3000);
        
        // Check if still logged in - must contain extranet.papajohns.com
        const currentUrl = page.url();
        const isLoggedIn = currentUrl.includes('extranet.papajohns.com');
        
        if (!isLoggedIn) {
          // Session expired, delete and re-login
          console.log('=== Session expired, re-logging in ===');
          if (existsSync(SESSION_FILE)) {
            unlinkSync(SESSION_FILE);
          }
          await performLogin(page);
        } else {
          console.log('=== Session is valid ===');
        }
      } catch (error) {
        console.log('=== Error loading session, re-logging in ===');
        if (existsSync(SESSION_FILE)) {
          unlinkSync(SESSION_FILE);
        }
        context = await browser.newContext();
        page = await context.newPage();
        await performLogin(page);
      }
    } else {
      console.log('=== No session file found, performing login ===');
      context = await browser.newContext();
      page = await context.newPage();
      await performLogin(page);
    }
    
    // Skip all menu navigation - go directly to each store URL
    const storeData = [];

    for (const storeId of STORE_IDS) {
      console.log(`=== Scraping store ${storeId}... ===`);

      await page.goto(
        `https://extranet.papajohns.com/kpi/#/realtime?type=STORE_ID&id=${storeId}&view=summary`,
        { waitUntil: 'domcontentloaded', timeout: 30000 }
      );
      await page.waitForTimeout(5000);

      const currentUrl = page.url();
      console.log(`Current URL for store ${storeId}: ${currentUrl}`);

      if (currentUrl.includes('login.microsoftonline.com')) {
        console.log('=== Session expired, deleting session file ===');
        if (existsSync(SESSION_FILE)) {
          unlinkSync(SESSION_FILE);
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
          }).eq('id', 'live_kpi');
        } catch (statusError) {
          console.error('Failed to update scraper status:', statusError);
        }
        
        throw new Error('SESSION_EXPIRED');
      }

      const pageText = await page.evaluate(() => document.body.innerText);

      if (storeId === '2081') {
        console.log(`=== Store ${storeId} full page text ===`);
        console.log(pageText);
      }

      const parsed = parseStoreData(storeId, pageText);
      storeData.push(parsed);
      console.log(`✓ Store ${storeId} scraped successfully`);
    }

    return storeData;
  } finally {
    // Always close browser, even if there's an error
    await browser.close();
  }
}
