import { chromium } from 'playwright';
import { readFileSync } from 'fs';

(async () => {
  const session = JSON.parse(readFileSync('./smg-session.json', 'utf8'));
  const cookies = session.cookies || session;

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  await context.addCookies(cookies);
  const page = await context.newPage();

  // Stub NREUM before page loads to prevent tracking errors
  await page.addInitScript(() => {
    window.NREUM = window.NREUM || {};
    window.NREUM.inlineHit = () => true;
    window.NREUM.noticeError = () => {};
    window.NREUM.interaction = () => ({ save: () => {}, end: () => {} });
  });

  // Go to the dashboard
  await page.goto('https://reporting.smg.com/dashboard.aspx?id=5', {
    waitUntil: 'domcontentloaded',
    timeout: 30000
  });

  // Wait for page to fully initialize
  await page.waitForTimeout(3000);

  // Optional safety: check if already on Current Period
  const alreadyCurrent = await page.evaluate(() =>
    document.body.innerText.includes('2/23/2026 - 3/29/2026')
  );

  if (alreadyCurrent) {
    console.log('Already on Current Period — skipping Change Dates');
  } else {
    // Click "Change Dates" to open the modal
    await page.waitForSelector('text=Change Dates', { state: 'attached' });
    await page.evaluate(() => {
      const el = [...document.querySelectorAll('span')]
        .find(s => s.textContent?.trim() === 'Change Dates');
      el?.click();
    });
    console.log('✅ Clicked Change Dates');

    // Wait for modal - look for the Timeframe heading
    await page.waitForSelector('text=Timeframe', { timeout: 10000 });
    await page.waitForTimeout(1500);

    // Debug: dump all select options in the modal
    const dropdownInfo = await page.evaluate(() => {
      const selects = document.querySelectorAll('select');
      return Array.from(selects).map(s => ({
        id: s.id,
        name: s.name,
        className: s.className,
        options: Array.from(s.options).map(o => ({ value: o.value, text: o.text.trim() }))
      }));
    });
    console.log('Dropdowns found:', JSON.stringify(dropdownInfo, null, 2));

    // Find and set the period dropdown - try multiple approaches
    const periodSet = await page.evaluate(() => {
      // Try by ID first
      let select = document.querySelector('#rbDateRangeSEL');
      
      // Try by finding select inside modal/dialog
      if (!select) {
        const modal = document.querySelector('.modal, [role="dialog"], .modal-dialog, .smg-modal');
        if (modal) select = modal.querySelector('select');
      }
      
      // Try any visible select
      if (!select) {
        const selects = Array.from(document.querySelectorAll('select'));
        select = selects.find(s => {
          const opts = Array.from(s.options).map(o => o.text.toLowerCase());
          return opts.some(t => t.includes('period') || t.includes('current') || t.includes('last'));
        });
      }

      if (!select) return { found: false };

      // Log current value and options
      const options = Array.from(select.options).map(o => ({ v: o.value, t: o.text.trim() }));
      
      // Find "Current Period" option
      const currentOpt = Array.from(select.options).find(o => 
        o.text.toLowerCase().includes('current period')
      );
      
      if (currentOpt) {
        select.value = currentOpt.value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
        return { found: true, id: select.id, selected: currentOpt.text, options };
      }

      // Just select first option if no "current period" found
      select.selectedIndex = 0;
      select.dispatchEvent(new Event('change', { bubbles: true }));
      return { found: true, id: select.id, selected: select.options[0]?.text, options };
    });

    console.log('Period dropdown result:', JSON.stringify(periodSet, null, 2));
    await page.waitForTimeout(500);

    // 1. Wait for the modal to fully settle (this is critical)
    await page.waitForTimeout(2000);

    // 2. Find the Build Report element visually
    const buildReport = await page.locator('.podButton', {
      hasText: 'Build Report'
    }).first();

    // 3. Ensure it is visible
    await buildReport.waitFor({ state: 'visible', timeout: 10000 });

    // 4. Get exact screen position
    const box = await buildReport.boundingBox();
    if (!box) throw new Error('Build Report bounding box not found');

    // 5. Click like a human (center of the element)
    await page.mouse.move(
      box.x + box.width / 2,
      box.y + box.height / 2
    );
    await page.mouse.down();
    await page.mouse.up();

    console.log('✅ Human-like click on Build Report');

    // 6. Give SMG time to process
    await page.waitForTimeout(4000);
  }

  // Switch to store 002021
  await page.evaluate((storeId) => {
    const select = document.querySelector('.unitSelectionDD');
    if (!select) throw new Error('Store selector not found');
    const option = Array.from(select.options).find(o => o.text.trim() === storeId);
    if (!option) throw new Error(`Store ${storeId} not found`);
    select.value = option.value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  }, '002021');

  await page.waitForFunction(() =>
    document.body.innerText.includes('My Store - #002021'),
    { timeout: 15000 }
  );

  const text = await page.evaluate(() => document.body.innerText);
  console.log('PAGE TEXT:', text.substring(0, 2000));
  await page.screenshot({ path: 'test-store-002021.png' });
  console.log('✅ Screenshot saved');

  await browser.close();
})();
