import { chromium } from 'playwright';
import { existsSync, unlinkSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { ensureSession, EXTRANET_SESSION_PATH } from './extranet-session'

dotenv.config({ path: '.env.local' });

const STORE_IDS = ['2021', '2081', '2259', '2292', '2481', '3011'];
const SESSION_FILE = EXTRANET_SESSION_PATH;

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

export async function scrapeExtranet() {
  const browser = await chromium.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });
  
  try {
    const hasSessionFile = existsSync(SESSION_FILE)
    const context = hasSessionFile
      ? await browser.newContext({ storageState: SESSION_FILE })
      : await browser.newContext()
    const page = await context.newPage()
    await ensureSession(page, context)
    
    // Skip all menu navigation - go directly to each store URL
    const storeData = [];

    for (const storeId of STORE_IDS) {
      const url = `https://extranet.papajohns.com/kpi/#/realtime?type=STORE_ID&id=${storeId}&view=summary`;
      let pageText = '';
      for (let attempt = 0; attempt < 3; attempt++) {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(6000);
        pageText = await page.evaluate(() => document.body.innerText);
        if (pageText.includes(storeId)) {
          console.log(`Store ${storeId} loaded on attempt ${attempt + 1}`);
          break;
        }
        console.log(`Store ${storeId} not loaded on attempt ${attempt + 1}, retrying...`);
        await page.waitForTimeout(3000);
      }

      const currentUrl = page.url();

      if (currentUrl.includes('login.microsoftonline.com')) {
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
        } catch (_statusError) {
          // ignore
        }
        throw new Error('SESSION_EXPIRED');
      }

      const parsed = parseStoreData(storeId, pageText);
      storeData.push(parsed);
    }

    return storeData;
  } finally {
    // Always close browser, even if there's an error
    await browser.close();
  }
}
