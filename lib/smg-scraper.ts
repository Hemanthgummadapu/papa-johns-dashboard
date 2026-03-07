import { Page } from 'playwright';
import { SMGStoreData } from '@/types/smg';

const STORE_IDS = ['002021', '002081', '002259', '002292', '002481', '003011'];

/**
 * Set up period selection and return date range
 */
export async function setupPeriodSelection(
  page: Page,
  period: 'previous' | 'current'
): Promise<{ periodStartDate: string | null; periodEndDate: string | null }> {
  const periodLabel = period === 'previous' ? 'Previous Period' : 'Current Period';

  await page.goto('https://reporting.smg.com/dashboard.aspx?id=5', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(3000);

  // Check for session expiry
  const isLoginPage = await page.evaluate(() => 
    document.title.includes('Client Access') || 
    (document.body.innerText.includes('Username') && document.body.innerText.includes('Password'))
  );
  if (isLoginPage) {
    throw new Error('SMG_SESSION_EXPIRED');
  }

  // Verify we're on the right page
  const isOnDashboard = await page.evaluate(() => 
    window.location.href.includes('reporting.smg.com')
  );
  if (!isOnDashboard) {
    throw new Error('SMG_SESSION_EXPIRED');
  }

  // 2. Click Change Dates via JS
  await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('span'))
      .find(s => s.textContent?.trim() === 'Change Dates');
    if (!el) throw new Error('Change Dates not found');
    (el as HTMLElement).click();
  });
  await page.waitForTimeout(2000);

  // 3. Select period in #rbDateRangeSEL by label text
  await page.evaluate((label: string) => {
    const select = document.getElementById('rbDateRangeSEL') as HTMLSelectElement;
    if (!select) throw new Error('rbDateRangeSEL not found');
    const option = Array.from(select.options).find(o => o.text.trim() === label);
    if (!option) throw new Error(`Option "${label}" not found`);
    select.value = option.value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  }, periodLabel);
  await page.waitForTimeout(500);

  // 4. Click Build Report via JS
  await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('div, button'))
      .find(e => e.textContent?.trim() === 'Build Report');
    if (!el) throw new Error('Build Report not found');
    (el as HTMLElement).click();
  });

  // 5. Wait for jQuery AJAX to complete
  await page.evaluate(() => {
    return new Promise<void>(resolve => {
      const deadline = Date.now() + 10000;
      const check = () => {
        if ((window as any).jQuery && (window as any).jQuery.active === 0) resolve();
        else if (Date.now() > deadline) resolve();
        else setTimeout(check, 100);
      };
      check();
    });
  });
  await page.waitForTimeout(2000);

  // Extract and parse date range from the page
  const dateRangeText = await page.evaluate(() => {
    // Look for date range specifically under "Where should I focus?" heading
    const focusSection = Array.from(document.querySelectorAll('*')).find(
      el => el.textContent?.trim() === 'Where should I focus?'
    );
    if (focusSection) {
      // Look for date range in nearby elements
      const parent = focusSection.closest('section, div, .panel') as HTMLElement | null;
      const dateText = parent?.innerText?.match(/\d{1,2}\/\d{1,2}\/\d{4}\s*[-–]\s*\d{1,2}\/\d{1,2}\/\d{4}/)?.[0];
      if (dateText) return dateText;
    }
    // Fallback — get all date ranges on page and return the first one
    const allDates = document.body.innerText.match(/\d{1,2}\/\d{1,2}\/\d{4}\s*[-–]\s*\d{1,2}\/\d{1,2}\/\d{4}/g);
    return allDates?.[0] || null;
  });

  let periodStartDate: string | null = null;
  let periodEndDate: string | null = null;

  // Parse date range into start and end dates
  if (dateRangeText) {
    const [startStr, endStr] = dateRangeText.split(/\s*[-–]\s*/);
    if (startStr && endStr) {
      // Parse M/D/YYYY format to YYYY-MM-DD
      const parseDate = (dateStr: string): string | null => {
        try {
          const [month, day, year] = dateStr.split('/');
          return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        } catch {
          return null;
        }
      };
      
      periodStartDate = parseDate(startStr);
      periodEndDate = parseDate(endStr);
    }
  }

  // 6. Wait for store dropdown to reappear
  await page.waitForFunction(() => {
    return document.querySelector('.unitSelectionDD') !== null;
  }, { timeout: 15000 });

  return { periodStartDate, periodEndDate };
}

/**
 * Scrape a single store - used for sequential scraping
 */
export async function scrapeSingleStore(
  page: Page,
  storeId: string,
  period: 'previous' | 'current',
  periodStartDate: string | null,
  periodEndDate: string | null
): Promise<SMGStoreData> {
  const storeNum = storeId.replace(/^0+/, '');

  // Wait for dropdown options to be loaded before switching
  await page.waitForFunction(() => {
    const select = document.querySelector('.unitSelectionDD') as HTMLSelectElement;
    return select && select.options.length > 1;
  }, { timeout: 15000 });

  // Switch store via jQuery / chosen.js
  const result = await page.evaluate((targetStore: string) => {
    const $ = (window as any).jQuery;
    const select = document.querySelector('.unitSelectionDD') as HTMLSelectElement;
    if (!select) return 'no select';

    const match = Array.from(select.options)
      .find(o => o.text.trim() === targetStore);

    if (!match) return 'no option';

    select.value = match.value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    $(select).trigger('chosen:updated');

    return 'switched to ' + match.value;
  }, storeId);

  // Wait for the specific response after store switch
  await page.waitForResponse(
    res => res.url().includes('OperatorLoyaltyScoresControl.ashx') && res.status() === 200,
    { timeout: 15000 }
  );
  await page.waitForTimeout(1000);

  // Scrape with retry logic for context destruction
  let parsed: any;
  const scrapeEvaluate = () => page.evaluate(({ storeId, storeNum }) => {
    const result: any = {
      store_number: storeNum,
      date: new Date().toISOString().split('T')[0],
      responses: null,
      osat: null,
      taste_of_food: null,
      accuracy_of_order: null,
      wait_time: null,
      driver_friendliness: null,
      pj_osat: null,
      pj_taste: null,
      pj_accuracy: null,
      pj_wait_time: null,
      pj_driver: null,
      osat_vs_last_period: null,
      osat_vs_papa_johns: null,
      accuracy_vs_last_period: null,
      accuracy_vs_papa_johns: null,
      taste_vs_papa_johns: null,
      wait_time_vs_papa_johns: null,
      driver_vs_papa_johns: null,
    };

    // Find the ranking table - look for table with rows containing store IDs and "Papa John's"
    const allText = document.body.innerText;
    const lines = allText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    
    // Find store row in ranking table
    let storeRowFound = false;
    let papaJohnsRowFound = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].replace(/\s+/g, ' ');
      
      // Match store row: starts with store ID, has Resp column, then percentages
      if ((line.startsWith(storeId + ' ') || line.startsWith(storeNum + ' ')) && !storeRowFound) {
        const match = line.match(/^(\d+)\s+(\d+)\s+([\d.]+)%\*?\s+([\d.]+)%\*?\s+([\d.]+)%\*?\s+([\d.]+)%\*?\s+([\d.]+)%\*?/);
        if (match) {
          result.responses = parseInt(match[2]);
          result.osat = parseFloat(match[3]);
          result.taste_of_food = parseFloat(match[4]);
          result.accuracy_of_order = parseFloat(match[5]);
          result.wait_time = parseFloat(match[6]);
          result.driver_friendliness = parseFloat(match[7]);
          storeRowFound = true;
        }
      }
      
      // Match Papa John's row: contains "Papa John's" or "Papa John" and has percentages
      if ((line.includes('Papa John') || line.includes('Papa John\'s')) && !papaJohnsRowFound) {
        const match = line.match(/([\d.]+)%\*?\s+([\d.]+)%\*?\s+([\d.]+)%\*?\s+([\d.]+)%\*?\s+([\d.]+)%\*?/);
        if (match) {
          result.pj_osat = parseFloat(match[1]);
          result.pj_taste = parseFloat(match[2]);
          result.pj_accuracy = parseFloat(match[3]);
          result.pj_wait_time = parseFloat(match[4]);
          result.pj_driver = parseFloat(match[5]);
          papaJohnsRowFound = true;
        }
      }
      
      if (storeRowFound && papaJohnsRowFound) break;
    }

    // Extract "How are we doing?" table - only OSAT and Accuracy appear here
    const parseComparisonRow = (searchTerms: string[]) => {
      const allRows = Array.from(document.querySelectorAll('tr, div[class*="row"], div[class*="Row"]'));
      
      for (const row of allRows) {
        const rowText = (row.textContent || '').toLowerCase();
        const matches = searchTerms.some(term => rowText.includes(term.toLowerCase()));
        
        if (matches) {
          const cells = Array.from(row.querySelectorAll('td, th, div[class*="cell"], div[class*="column"], span[class*="value"]'));
          const values: Array<{type: 'score' | 'delta', value: number, isPositive?: boolean}> = [];
          
          for (const cell of cells) {
            const cellText = (cell.textContent || '').trim();
            const style = window.getComputedStyle(cell);
            
            // Check for percentage score
            const pctMatch = cellText.match(/([\d.]+)%/);
            if (pctMatch) {
              values.push({ type: 'score', value: parseFloat(pctMatch[1]) });
              continue;
            }
            
            // Check for delta number (not a percentage)
            const numMatch = cellText.match(/([\d.]+)/);
            if (numMatch && !cellText.includes('%')) {
              const num = parseFloat(numMatch[1]);
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
          
          const scores = values.filter(v => v.type === 'score').map(v => v.value);
          const deltas = values.filter(v => v.type === 'delta');
          
          if (scores.length >= 2 && deltas.length >= 2) {
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
      result.osat_vs_last_period = parseFloat(osatComp.vsLastPeriod);
      result.osat_vs_papa_johns = parseFloat(osatComp.vsPapaJohns);
    }

    // Parse Accuracy from "How are we doing?" table
    const accuracyComp = parseComparisonRow(['accuracy of order', 'accuracy']);
    if (accuracyComp) {
      result.accuracy_vs_last_period = parseFloat(accuracyComp.vsLastPeriod);
      result.accuracy_vs_papa_johns = parseFloat(accuracyComp.vsPapaJohns);
    }

    // Compute derived fields
    if (result.taste_of_food !== null && result.pj_taste !== null) {
      result.taste_vs_papa_johns = result.taste_of_food - result.pj_taste;
    }
    if (result.wait_time !== null && result.pj_wait_time !== null) {
      result.wait_time_vs_papa_johns = result.wait_time - result.pj_wait_time;
    }
    if (result.driver_friendliness !== null && result.pj_driver !== null) {
      result.driver_vs_papa_johns = result.driver_friendliness - result.pj_driver;
    }

    return result;
  }, { storeId, storeNum });

  try {
    parsed = await scrapeEvaluate();
  } catch (_err: any) {
    await page.waitForTimeout(3000);
    parsed = await scrapeEvaluate();
  }

  // Add period, date range, and timestamp
  return {
    ...parsed,
    period: period,
    period_start_date: periodStartDate,
    period_end_date: periodEndDate,
    scraped_at: new Date().toISOString()
  };
}

/**
 * Pure scraping logic - accepts an already-authenticated page
 * Navigates to SMG dashboard, selects period, and scrapes all stores
 */
export async function scrapeSMG(
  page: Page, 
  period: 'previous' | 'current' = 'previous'
): Promise<{ data: SMGStoreData[]; periodStartDate: string | null; periodEndDate: string | null }> {
  // Define period dates at function level so they're available throughout
  let periodStartDate: string | null = null;
  let periodEndDate: string | null = null;

  const periodLabel = period === 'previous' ? 'Previous Period' : 'Current Period';

  await page.goto('https://reporting.smg.com/dashboard.aspx?id=5', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(3000);

  const isLoginPage = await page.evaluate(() => 
    document.title.includes('Client Access') || 
    (document.body.innerText.includes('Username') && document.body.innerText.includes('Password'))
  );
  if (isLoginPage) {
    throw new Error('SMG_SESSION_EXPIRED');
  }

  const isOnDashboard = await page.evaluate(() => 
    window.location.href.includes('reporting.smg.com')
  );
  if (!isOnDashboard) {
    throw new Error('SMG_SESSION_EXPIRED');
  }

  await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('span'))
      .find(s => s.textContent?.trim() === 'Change Dates');
    if (!el) throw new Error('Change Dates not found');
    (el as HTMLElement).click();
  });
  await page.waitForTimeout(2000);

  await page.evaluate((label: string) => {
    const select = document.getElementById('rbDateRangeSEL') as HTMLSelectElement;
    if (!select) throw new Error('rbDateRangeSEL not found');
    const option = Array.from(select.options).find(o => o.text.trim() === label);
    if (!option) throw new Error(`Option "${label}" not found`);
    select.value = option.value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  }, periodLabel);
  await page.waitForTimeout(500);

  await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('div, button'))
      .find(e => e.textContent?.trim() === 'Build Report');
    if (!el) throw new Error('Build Report not found');
    (el as HTMLElement).click();
  });

  await page.evaluate(() => {
    return new Promise<void>(resolve => {
      const deadline = Date.now() + 10000;
      const check = () => {
        if ((window as any).jQuery && (window as any).jQuery.active === 0) resolve();
        else if (Date.now() > deadline) resolve();
        else setTimeout(check, 100);
      };
      check();
    });
  });
  await page.waitForTimeout(2000);

  const dateRangeText = await page.evaluate(() => {
    const focusSection = Array.from(document.querySelectorAll('*')).find(
      el => el.textContent?.trim() === 'Where should I focus?'
    );
    if (focusSection) {
      const parent = focusSection.closest('section, div, .panel') as HTMLElement | null;
      const dateText = parent?.innerText?.match(/\d{1,2}\/\d{1,2}\/\d{4}\s*[-–]\s*\d{1,2}\/\d{1,2}\/\d{4}/)?.[0];
      if (dateText) return dateText;
    }
    const allDates = document.body.innerText.match(/\d{1,2}\/\d{1,2}\/\d{4}\s*[-–]\s*\d{1,2}\/\d{1,2}\/\d{4}/g);
    return allDates?.[0] || null;
  });

  // Parse date range into start and end dates
  if (dateRangeText) {
    const [startStr, endStr] = dateRangeText.split(/\s*[-–]\s*/);
    if (startStr && endStr) {
      // Parse M/D/YYYY format to YYYY-MM-DD
      const parseDate = (dateStr: string): string | null => {
        try {
          const [month, day, year] = dateStr.split('/');
          return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        } catch {
          return null;
        }
      };
      
      periodStartDate = parseDate(startStr);
      periodEndDate = parseDate(endStr);
    }
  }

  // 6. Wait for store dropdown to reappear
  await page.waitForFunction(() => {
    return document.querySelector('.unitSelectionDD') !== null;
  }, { timeout: 15000 });

  const allStoreData: SMGStoreData[] = [];

  // 7. Store loop - fresh query every time
  for (const storeId of STORE_IDS) {
    // Calculate storeNum (without leading zeros) for use in parsing
    const storeNum = storeId.replace(/^0+/, '');

    try {
      // Wait for dropdown options to be loaded before switching
      await page.waitForFunction(() => {
        const select = document.querySelector('.unitSelectionDD') as HTMLSelectElement;
        return select && select.options.length > 1;
      }, { timeout: 15000 });

      // Switch store via jQuery / chosen.js
      const result = await page.evaluate((targetStore: string) => {
        const $ = (window as any).jQuery;
        const select = document.querySelector('.unitSelectionDD') as HTMLSelectElement;
        if (!select) return 'no select';

        const match = Array.from(select.options)
          .find(o => o.text.trim() === targetStore);

        if (!match) return 'no option';

        select.value = match.value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
        $(select).trigger('chosen:updated');

        return 'switched to ' + match.value;
      }, storeId);

      // Wait after switch
      await page.waitForFunction(() => {
        return (
          (window as any).jQuery &&
          (window as any).jQuery.active === 0 &&
          document.querySelector('.unitSelectionDD')
        );
      }, { timeout: 15000 }).catch(() => { /* timeout ok, continue */ });

      // Scrape immediately (nulls are valid)
      // Extract data - ONLY ranking table and "How are we doing?" table
      const parsed = await page.evaluate(({ storeId, storeNum }) => {
        const result: any = {
          store_number: storeNum,
          date: new Date().toISOString().split('T')[0],
          responses: null,
          osat: null,
          taste_of_food: null,
          accuracy_of_order: null,
          wait_time: null,
          driver_friendliness: null,
          pj_osat: null,
          pj_taste: null,
          pj_accuracy: null,
          pj_wait_time: null,
          pj_driver: null,
          osat_vs_last_period: null,
          osat_vs_papa_johns: null,
          accuracy_vs_last_period: null,
          accuracy_vs_papa_johns: null,
          taste_vs_papa_johns: null,
          wait_time_vs_papa_johns: null,
          driver_vs_papa_johns: null,
        };

        // Find the ranking table - look for table with rows containing store IDs and "Papa John's"
        const allText = document.body.innerText;
        const lines = allText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        
        // Find store row in ranking table
        let storeRowFound = false;
        let papaJohnsRowFound = false;
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].replace(/\s+/g, ' ');
          
          // Match store row: starts with store ID, has Resp column, then percentages
          if ((line.startsWith(storeId + ' ') || line.startsWith(storeNum + ' ')) && !storeRowFound) {
            const match = line.match(/^(\d+)\s+(\d+)\s+([\d.]+)%\*?\s+([\d.]+)%\*?\s+([\d.]+)%\*?\s+([\d.]+)%\*?\s+([\d.]+)%\*?/);
            if (match) {
              result.responses = parseInt(match[2]);
              result.osat = parseFloat(match[3]);
              result.taste_of_food = parseFloat(match[4]);
              result.accuracy_of_order = parseFloat(match[5]);
              result.wait_time = parseFloat(match[6]);
              result.driver_friendliness = parseFloat(match[7]);
              storeRowFound = true;
            }
          }
          
          // Match Papa John's row: contains "Papa John's" or "Papa John" and has percentages
          if ((line.includes('Papa John') || line.includes('Papa John\'s')) && !papaJohnsRowFound) {
            const match = line.match(/([\d.]+)%\*?\s+([\d.]+)%\*?\s+([\d.]+)%\*?\s+([\d.]+)%\*?\s+([\d.]+)%\*?/);
            if (match) {
              result.pj_osat = parseFloat(match[1]);
              result.pj_taste = parseFloat(match[2]);
              result.pj_accuracy = parseFloat(match[3]);
              result.pj_wait_time = parseFloat(match[4]);
              result.pj_driver = parseFloat(match[5]);
              papaJohnsRowFound = true;
            }
          }
          
          if (storeRowFound && papaJohnsRowFound) break;
        }

        // Extract "How are we doing?" table - only OSAT and Accuracy appear here
        const parseComparisonRow = (searchTerms: string[]) => {
          const allRows = Array.from(document.querySelectorAll('tr, div[class*="row"], div[class*="Row"]'));
          
          for (const row of allRows) {
            const rowText = (row.textContent || '').toLowerCase();
            const matches = searchTerms.some(term => rowText.includes(term.toLowerCase()));
            
            if (matches) {
              const cells = Array.from(row.querySelectorAll('td, th, div[class*="cell"], div[class*="column"], span[class*="value"]'));
              const values: Array<{type: 'score' | 'delta', value: number, isPositive?: boolean}> = [];
              
              for (const cell of cells) {
                const cellText = (cell.textContent || '').trim();
                const style = window.getComputedStyle(cell);
                
                // Check for percentage score
                const pctMatch = cellText.match(/([\d.]+)%/);
                if (pctMatch) {
                  values.push({ type: 'score', value: parseFloat(pctMatch[1]) });
                  continue;
                }
                
                // Check for delta number (not a percentage)
                const numMatch = cellText.match(/([\d.]+)/);
                if (numMatch && !cellText.includes('%')) {
                  const num = parseFloat(numMatch[1]);
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
              
              const scores = values.filter(v => v.type === 'score').map(v => v.value);
              const deltas = values.filter(v => v.type === 'delta');
              
              if (scores.length >= 2 && deltas.length >= 2) {
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
          result.osat_vs_last_period = parseFloat(osatComp.vsLastPeriod);
          result.osat_vs_papa_johns = parseFloat(osatComp.vsPapaJohns);
        }

        // Parse Accuracy from "How are we doing?" table
        const accuracyComp = parseComparisonRow(['accuracy of order', 'accuracy']);
        if (accuracyComp) {
          result.accuracy_vs_last_period = parseFloat(accuracyComp.vsLastPeriod);
          result.accuracy_vs_papa_johns = parseFloat(accuracyComp.vsPapaJohns);
        }

        // Compute derived fields
        if (result.taste_of_food !== null && result.pj_taste !== null) {
          result.taste_vs_papa_johns = result.taste_of_food - result.pj_taste;
        }
        if (result.wait_time !== null && result.pj_wait_time !== null) {
          result.wait_time_vs_papa_johns = result.wait_time - result.pj_wait_time;
        }
        if (result.driver_friendliness !== null && result.pj_driver !== null) {
          result.driver_vs_papa_johns = result.driver_friendliness - result.pj_driver;
        }

        return result;
      }, { storeId, storeNum });

      // Add period, date range, and timestamp
      const storeData: SMGStoreData = {
        ...parsed,
        period: period,
        period_start_date: periodStartDate,
        period_end_date: periodEndDate,
        scraped_at: new Date().toISOString()
      };
      
      allStoreData.push(storeData);

    } catch (_error: any) {
      
      // Return minimal error data
      allStoreData.push({
        store_number: storeNum,
        period: period,
        date: new Date().toISOString().split('T')[0],
        period_start_date: periodStartDate,
        period_end_date: periodEndDate,
        responses: null,
        osat: null,
        taste_of_food: null,
        accuracy_of_order: null,
        wait_time: null,
        driver_friendliness: null,
        pj_osat: null,
        pj_taste: null,
        pj_accuracy: null,
        pj_wait_time: null,
        pj_driver: null,
        osat_vs_last_period: null,
        osat_vs_papa_johns: null,
        accuracy_vs_last_period: null,
        accuracy_vs_papa_johns: null,
        taste_vs_papa_johns: null,
        wait_time_vs_papa_johns: null,
        driver_vs_papa_johns: null,
        scraped_at: new Date().toISOString()
      });
    }
  }

  return { data: allStoreData, periodStartDate, periodEndDate };
}
