import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

const STORE_NUMBERS = ['002021', '002081', '002259', '002292', '002481', '003011'];

// Initialize Supabase client if env vars are available
function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.warn('⚠️  Supabase env vars not found - data will not be saved to DB');
    return null;
  }
  return createClient(url, serviceKey);
}

// Check if page is already on Current Period
async function isCurrentPeriod(page) {
  const result = await page.evaluate(() => {
    // Check if "Current Period" is selected in the dropdown
    const select = document.querySelector('#rbDateRangeSEL');
    if (select) {
      const selectedOption = select.options[select.selectedIndex];
      if (selectedOption && selectedOption.text.toLowerCase().trim().includes('current period')) {
        return true;
      }
    }
    // Fallback: check page text for current period indicators
    const bodyText = document.body.innerText.toLowerCase();
    // Look for "Current Period" text or date ranges that suggest current period
    if (bodyText.includes('current period')) {
      return true;
    }
    return false;
  });
  return result;
}

// Ensure Current Period is selected using defensive/optional logic
async function ensureCurrentPeriod(page) {
  // Check current period shown on page first
  const currentPeriodText = await page.evaluate(() => {
    const el = document.querySelector('.dateRange, .date-range, [class*="date"]');
    return el?.innerText?.trim() || document.body.innerText.match(/\d+\/\d+\/\d+ - \d+\/\d+\/\d+/)?.[0] || '';
  });
  console.log('Current period on page:', currentPeriodText);

  // Only open Change Dates modal if needed
  const needsDateChange = await page.$('text=Change Dates').catch(() => null);
  if (needsDateChange) {
    await page.evaluate(() => {
      const el = Array.from(document.querySelectorAll('*'))
        .find(e => e.childElementCount === 0 && e.innerText?.trim() === 'Change Dates');
      if (el) el.click();
    });
    console.log('✅ Clicked Change Dates');

    await page.waitForSelector('text=Timeframe', { timeout: 10000 });
    await page.waitForTimeout(1500);

    // Check if already on Current Period
    const currentVal = await page.$eval('#rbDateRangeSEL', el => el.options[el.selectedIndex].text).catch(() => '');
    console.log('Dropdown currently set to:', currentVal);

    if (!currentVal.includes('Current Period')) {
      await page.evaluate(() => {
        const sel = document.querySelector('#rbDateRangeSEL');
        const opt = Array.from(sel.options).find(o => o.text === 'Current Period');
        if (opt) { sel.value = opt.value; sel.dispatchEvent(new Event('change', { bubbles: true })); }
      });
      console.log('✅ Set to Current Period');
      await page.waitForTimeout(500);

      // Click Build Report using mouse coordinates
      const btn = await page.evaluate(() => {
        const b = Array.from(document.querySelectorAll('.podButton'))
          .find(el => el.textContent.trim() === 'Build Report');
        if (!b) return null;
        const rect = b.getBoundingClientRect();
        return { x: rect.left + rect.width/2, y: rect.top + rect.height/2 };
      });

      if (!btn) throw new Error('Build Report podButton not found');

      await page.mouse.move(btn.x, btn.y);
      await page.mouse.down();
      await page.waitForTimeout(100);
      await page.mouse.up();
      console.log('✅ Clicked Build Report');
      await page.waitForTimeout(4000);
    } else {
      // Already on current period, just close modal
      await page.keyboard.press('Escape');
      console.log('✅ Already on Current Period, skipped Build Report');
    }
  } else {
    console.log('✅ Change Dates button not found - likely already on Current Period');
  }

  // Wait for data to reload
  await page.waitForFunction(() => {
    return (
      (window.jQuery && window.jQuery.active === 0) &&
      document.querySelector('.unitSelectionDD')
    );
  }, { timeout: 15000 }).catch(() => {
    // If wait fails, just continue
    console.log('Waiting for data reload...');
  });
  
  console.log('✅ Period setup complete');
}

// Switch to a specific store
async function switchStore(page, storeId) {
  console.log(`Switching to store ${storeId}...`);
  
  await page.evaluate((storeId) => {
    const select = document.querySelector('.unitSelectionDD');
    if (!select) throw new Error('Store selector not found');
    const option = Array.from(select.options).find(o => o.text.trim() === storeId);
    if (!option) throw new Error(`Store ${storeId} not found`);
    select.value = option.value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    
    // Trigger chosen.js update if available
    if (window.jQuery) {
      window.jQuery(select).trigger('chosen:updated');
    }
  }, storeId);

  // Wait for store number to appear in body text (mandatory)
  await page.waitForFunction((storeId) =>
    document.body.innerText.includes(storeId),
    storeId,
    { timeout: 15000 }
  );
  console.log(`✅ Store ${storeId} visible in body text`);
  
  // Mandatory 30 second hard wait after store switch
  console.log('Waiting 30 seconds for all widgets and comparisons to load...');
  await page.waitForTimeout(30000);
  console.log(`✅ Store ${storeId} fully loaded`);
}

// Parse a value, treating 0.0%*, N/A, ** as null
function parseValue(value) {
  if (!value || value === 'N/A' || value === '**' || value === '0.0%*' || value === '0.0%') {
    return null;
  }
  // Remove * and % and parse
  const cleaned = String(value).replace(/[*%]/g, '').trim();
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? null : parsed;
}

// Scrape data from the current page
async function scrapeStoreData(page, storeId) {
  const storeNum = storeId.replace(/^0+/, '');
  
  // Scrape only the Ranking table - widgets lie/lag, table is truth
  const tableData = await page.evaluate((storeId) => {
    const cleanPct = (v) => {
      if (!v || v === '**' || v === 'N/A') return null;
      const parsed = parseFloat(v.replace('%','').replace('*',''));
      return isNaN(parsed) ? null : parsed;
    };

    const rows = Array.from(document.querySelectorAll('table tr'));

    const getRow = (label) =>
      rows.find(r => r.children[0]?.innerText.trim() === label);

    const parse = (row) => {
      if (!row) return null;
      const c = Array.from(row.children).map(td => td.innerText.trim());
      const respVal = parseInt(c[1]);
      return {
        responses: isNaN(respVal) ? null : respVal,
        osat: cleanPct(c[2]),
        accuracy_of_order: cleanPct(c[4]),
        wait_time: cleanPct(c[5]),
      };
    };

    return {
      store: parse(getRow(storeId)),
      papa_johns: parse(getRow("Papa John's"))
    };
  }, storeId);

  // If store row not found with full ID, try without leading zeros
  if (!tableData.store) {
    const tableDataAlt = await page.evaluate((storeNum) => {
      const cleanPct = (v) => {
        if (!v || v === '**' || v === 'N/A') return null;
        return parseFloat(v.replace('%','').replace('*',''));
      };

      const rows = Array.from(document.querySelectorAll('table tr'));

      const getRow = (label) =>
        rows.find(r => r.children[0]?.innerText.trim() === label);

      const parse = (row) => {
        if (!row) return null;
        const c = Array.from(row.children).map(td => td.innerText.trim());
        return {
          responses: parseInt(c[1]) || null,
          osat: cleanPct(c[2]),
          accuracy_of_order: cleanPct(c[4]),
          wait_time: cleanPct(c[5]),
        };
      };

      return {
        store: parse(getRow(storeNum)),
        papa_johns: parse(getRow("Papa John's"))
      };
    }, storeNum);
    
    if (tableDataAlt.store) {
      tableData.store = tableDataAlt.store;
    }
    if (tableDataAlt.papa_johns) {
      tableData.papa_johns = tableDataAlt.papa_johns;
    }
  }

  // Extract period dates and comparison data
  const data = await page.evaluate(() => {
    const result = {
      period_start_date: null,
      period_end_date: null,
      osat_vs_last_period: null,
      accuracy_vs_last_period: null,
      wait_time_vs_last_period: null,
      osat_vs_papa_johns: null,
      accuracy_vs_papa_johns: null,
      wait_time_vs_papa_johns: null,
    };

    // Extract period dates from page
    const dateRangeMatch = document.body.innerText.match(/(\d{1,2}\/\d{1,2}\/\d{4})\s*[-–]\s*(\d{1,2}\/\d{1,2}\/\d{4})/);
    if (dateRangeMatch) {
      // Parse M/D/YYYY to YYYY-MM-DD
      const parseDate = (dateStr) => {
        const [month, day, year] = dateStr.split('/');
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      };
      result.period_start_date = parseDate(dateRangeMatch[1]);
      result.period_end_date = parseDate(dateRangeMatch[2]);
    }

    // Extract "How are we doing?" table - OSAT, Accuracy, Wait Time comparisons
    const parseComparisonRow = (searchTerms) => {
      const allRows = Array.from(document.querySelectorAll('tr, div[class*="row"], div[class*="Row"]'));
      
      for (const row of allRows) {
        const rowText = (row.textContent || '').toLowerCase();
        const matches = searchTerms.some(term => rowText.includes(term.toLowerCase()));
        
        if (matches) {
          const cells = Array.from(row.querySelectorAll('td, th, div[class*="cell"], div[class*="column"], span[class*="value"]'));
          const values = [];
          
          for (const cell of cells) {
            const cellText = (cell.textContent || '').trim();
            const style = window.getComputedStyle(cell);
            
            // Check for percentage score
            const pctMatch = cellText.match(/([\d.]+)%/);
            if (pctMatch) {
              values.push({ type: 'score', value: pctMatch[1] });
              continue;
            }
            
            // Check for delta number (not a percentage)
            const numMatch = cellText.match(/([+-]?[\d.]+)/);
            if (numMatch && !cellText.includes('%')) {
              const num = numMatch[1];
              let isPositive = false;
              
              if (cellText.includes('↑') || cellText.includes('▲') || cellText.startsWith('+')) {
                isPositive = true;
              } else if (cellText.includes('↓') || cellText.includes('▼') || cellText.startsWith('-')) {
                isPositive = false;
              } else {
                const color = style.color;
                const rgb = color.match(/\d+/g);
                if (rgb && rgb.length >= 3) {
                  const g = parseInt(rgb[1]);
                  const r = parseInt(rgb[0]);
                  isPositive = g > 100 && g > r;
                }
              }
              
              values.push({ type: 'delta', value: num, isPositive });
            }
          }
          
          const deltas = values.filter(v => v.type === 'delta');
          
          if (deltas.length >= 2) {
            return {
              vsLastPeriod: (deltas[0].isPositive ? '+' : '-') + deltas[0].value,
              vsPapaJohns: (deltas[1].isPositive ? '+' : '-') + deltas[1].value
            };
          }
        }
      }
      return null;
    };

    // Parse OSAT from "How are we doing?" table
    const osatComp = parseComparisonRow(['overall satisfaction', 'osat']);
    if (osatComp) {
      result.osat_vs_last_period = osatComp.vsLastPeriod;
      result.osat_vs_papa_johns = osatComp.vsPapaJohns;
    }

    // Parse Accuracy from "How are we doing?" table
    const accuracyComp = parseComparisonRow(['accuracy of order', 'accuracy']);
    if (accuracyComp) {
      result.accuracy_vs_last_period = accuracyComp.vsLastPeriod;
      result.accuracy_vs_papa_johns = accuracyComp.vsPapaJohns;
    }

    // Parse Wait Time from "How are we doing?" table
    const waitTimeComp = parseComparisonRow(['wait time', 'wait']);
    if (waitTimeComp) {
      result.wait_time_vs_last_period = waitTimeComp.vsLastPeriod;
      result.wait_time_vs_papa_johns = waitTimeComp.vsPapaJohns;
    }

    return result;
  });

  // Map table data to expected structure
  // Table values are already parsed (numbers or null) from cleanPct/parseInt
  // Comparison values still need parsing
  return {
    period_start_date: data.period_start_date,
    period_end_date: data.period_end_date,
    responses: tableData.store?.responses ?? null,
    osat: tableData.store?.osat ?? null,
    accuracy_of_order: tableData.store?.accuracy_of_order ?? null,
    wait_time: tableData.store?.wait_time ?? null,
    pj_osat: tableData.papa_johns?.osat ?? null,
    pj_accuracy: tableData.papa_johns?.accuracy_of_order ?? null,
    pj_wait_time: tableData.papa_johns?.wait_time ?? null,
    osat_vs_last_period: data.osat_vs_last_period ? parseValue(data.osat_vs_last_period) : null,
    accuracy_vs_last_period: data.accuracy_vs_last_period ? parseValue(data.accuracy_vs_last_period) : null,
    wait_time_vs_last_period: data.wait_time_vs_last_period ? parseValue(data.wait_time_vs_last_period) : null,
    osat_vs_papa_johns: data.osat_vs_papa_johns ? parseValue(data.osat_vs_papa_johns) : null,
    accuracy_vs_papa_johns: data.accuracy_vs_papa_johns ? parseValue(data.accuracy_vs_papa_johns) : null,
    wait_time_vs_papa_johns: data.wait_time_vs_papa_johns ? parseValue(data.wait_time_vs_papa_johns) : null,
  };
}

// Save data to database
async function saveToDatabase(supabase, storeId, scrapedData) {
  if (!supabase) {
    console.log('⚠️  Skipping DB save - Supabase not configured');
    return;
  }

  const storeNum = storeId.replace(/^0+/, '');
  
  const { error } = await supabase
    .from('smg_scores')
    .upsert({
      store_number: storeNum,
      period: 'current',
      date: new Date().toISOString().split('T')[0],
      period_start_date: scrapedData.period_start_date,
      period_end_date: scrapedData.period_end_date,
      osat: scrapedData.osat,
      accuracy_of_order: scrapedData.accuracy_of_order,
      wait_time: scrapedData.wait_time,
      pj_osat: scrapedData.pj_osat,
      pj_accuracy: scrapedData.pj_accuracy,
      pj_wait_time: scrapedData.pj_wait_time,
      responses: scrapedData.responses,
      osat_vs_last_period: scrapedData.osat_vs_last_period,
      accuracy_vs_last_period: scrapedData.accuracy_vs_last_period,
      wait_time_vs_last_period: scrapedData.wait_time_vs_last_period,
      osat_vs_papa_johns: scrapedData.osat_vs_papa_johns,
      accuracy_vs_papa_johns: scrapedData.accuracy_vs_papa_johns,
      wait_time_vs_papa_johns: scrapedData.wait_time_vs_papa_johns,
      scraped_at: new Date().toISOString(),
    }, {
      onConflict: 'store_number,period'
    });

  if (error) {
    console.error(`❌ Error saving store ${storeId}:`, error.message);
    throw error;
  }
  
  console.log(`✅ Data saved for store ${storeId}`);
}

(async () => {
  const browser = await chromium.launch({ headless: false });

  // Load saved cookies but start with clean storage (no remembered store/date state)
  const context = await browser.newContext({
    storageState: undefined  // don't load any saved storage state
  });

  // Add only the cookies (login session), not localStorage/sessionStorage
  const session = JSON.parse(readFileSync('./smg-session.json', 'utf8'));
  const cookies = session.cookies || session;
  await context.addCookies(cookies);

  const page = await context.newPage();

  // Stub NREUM before page loads to prevent tracking errors
  await page.addInitScript(() => {
    window.NREUM = window.NREUM || {};
    window.NREUM.inlineHit = () => true;
    window.NREUM.noticeError = () => {};
    window.NREUM.interaction = () => ({ save: () => {}, end: () => {} });
  });

  await page.goto('https://reporting.smg.com/dashboard.aspx?id=5', {
    waitUntil: 'domcontentloaded',
    timeout: 30000
  });
  await page.waitForTimeout(3000);

  // Check for Change Dates and run Current Period setup if visible
  const changeDates = await page.$('text=Change Dates').catch(() => null);
  if (changeDates) {
    console.log('✅ Change Dates visible, running Current Period setup');
    await ensureCurrentPeriod(page);
  } else {
    console.log('✅ Change Dates not visible, likely already on Current Period');
  }

  // Step 3: Loop stores
  const stores = ['002021', '002081', '002259', '002292', '002481', '003011'];
  const allData = {};

  for (const storeId of stores) {
    try {
      console.log(`\n🔄 Switching to store ${storeId}...`);
      
      await page.evaluate((id) => {
        const select = document.querySelector('.unitSelectionDD');
        const option = Array.from(select.options).find(o => o.text.trim() === id);
        if (!option) throw new Error(`Store ${id} not found`);
        select.value = option.value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }, storeId);

      await page.waitForFunction((id) =>
        document.body.innerText.includes(`My Store - #${id}`),
        storeId, { timeout: 15000 }
      );

      console.log(`✅ Switched to ${storeId}, waiting 30s for data...`);
      await page.waitForTimeout(30000);

      // Scrape data for this store
      const data = await page.evaluate((storeId) => {
        function parsePct(v) {
          if (!v) return null;
          const cleaned = v.replace('%', '').replace(/\*/g, '').trim();
          if (cleaned === '' || cleaned === 'N/A' || cleaned === '**') return null;
          const num = parseFloat(cleaned);
          return isNaN(num) ? null : num;
        }
        function parseNum(v) {
          if (!v) return null;
          const num = parseInt(v.replace(/,/g, '').trim());
          return isNaN(num) ? null : num;
        }

        const focus = {};
        const doing = {};
        const ranking = { store: null, papa_johns: null };

        const allTables = Array.from(document.querySelectorAll('table'));

        // ── SECTION 1: focus ─────────────────────────────────────────────
        allTables.forEach(table => {
          const rows = Array.from(table.querySelectorAll('tr'));
          rows.forEach((row, i) => {
            const cells = Array.from(row.querySelectorAll('th, td')).map(c => c.innerText.trim());
            // Header row has metric name + Current + Vs. Previous
            if (cells.length >= 3 && cells[1] === 'Current' && cells[2].includes('Previous')) {
              const metric = cells[0]; // "Accuracy of Order" or "Wait Time"
              const dataRow = rows[i + 1];
              if (!dataRow) return;
              const dataCells = Array.from(dataRow.querySelectorAll('td')).map(c => c.innerText.trim());
              if (dataCells[0] !== storeId) return;
              if (metric.includes('Accuracy')) {
                focus.accuracy_current = parsePct(dataCells[1]);
                focus.accuracy_vs_previous = parsePct(dataCells[2]);
              } else if (metric.includes('Wait')) {
                focus.wait_time_current = parsePct(dataCells[1]);
                focus.wait_time_vs_previous = parsePct(dataCells[2]);
              }
            }
          });
        });

        // ── SECTION 2: doing ─────────────────────────────────────────────
        const metricMap = {
          'Overall Satisfaction': 'osat',
          'Accuracy of Order': 'accuracy',
          'CSC': 'csc',
          'Comp Orders': 'comp_orders',
          'Comp Sales': 'comp_sales'
        };
        Array.from(document.querySelectorAll('tr')).forEach(row => {
          const cells = Array.from(row.querySelectorAll('td')).map(c => c.innerText.trim());
          if (cells.length < 2) return;
          const key = metricMap[cells[0]];
          if (!key) return;
          doing[key] = {
            my_score: parsePct(cells[1]),
            vs_last_period: parsePct(cells[2]),
            pj_score: parsePct(cells[3]),
            my_score_vs_pj: parsePct(cells[4])
          };
        });

        // ── SECTION 3: ranking ───────────────────────────────────────────
        const parseRankRow = (row) => {
          if (!row) return null;
          const cells = Array.from(row.querySelectorAll('td')).map(c => c.innerText.trim());
          return {
            responses: parseNum(cells[1]),
            osat: parsePct(cells[2]),
            taste_of_food: parsePct(cells[3]),
            accuracy_of_order: parsePct(cells[4]),
            wait_time: parsePct(cells[5]),
            friendliness_of_delivery_driver: parsePct(cells[6])
          };
        };

        // Papa John's and F-W rows use fixedScrollingCell
        Array.from(document.querySelectorAll('tr')).filter(row =>
          row.querySelector('td.fixedScrollingCell')
        ).forEach(row => {
          const label = row.querySelector('td.fixedScrollingCell.label')?.innerText.trim();
          if (label === "Papa John's") ranking.papa_johns = parseRankRow(row);
        });

        // Store row uses canSort class
        const storeRankRow = Array.from(document.querySelectorAll('tr.canSort')).find(row =>
          row.querySelector('td.label')?.innerText.trim() === storeId
        );
        if (storeRankRow) ranking.store = parseRankRow(storeRankRow);

        return { focus, doing, ranking };
      }, storeId);

      allData[storeId] = data;
      console.log(`✅ Scraped ${storeId}:`, JSON.stringify(data, null, 2));
      
    } catch (error) {
      console.error(`❌ Error processing store ${storeId}:`, error.message);
      // Continue with next store - do not throw
    }
  }

  console.log('\n=== ALL STORES DATA ===');
  console.log(JSON.stringify(allData, null, 2));
  await browser.close();
})();
