import { test, expect } from '@playwright/test';

test.use({
  storageState: 'smg-session.json'
});

test('test', async ({ page }) => {
  await page.goto('https://extranet.papajohns.com/GatewayMenu/#/GATEWAY');
  await page.getByRole('link', { name: 'App Icon PIE - Powered by SMG' }).click();
  await page.goto('https://reporting.smg.com/dashboard.aspx?id=5');
  await page.getByText('Change Dates').click();
  await page.locator('#rbDateRangeSEL').selectOption('2/23/2026|3/29/2026|5');
  await page.getByText('Build Report').click();
  await page.locator('a').filter({ hasText: '002021' }).click();
  await page.getByRole('listitem').filter({ hasText: '002081' }).click();
  await page.locator('a').filter({ hasText: '002081' }).click();
  await page.getByRole('listitem').filter({ hasText: '002259' }).click();
  await page.locator('a').filter({ hasText: '002259' }).click();
  await page.getByRole('listitem').filter({ hasText: '002292' }).click();
  await page.locator('a').filter({ hasText: '002292' }).click();
  await page.getByRole('listitem').filter({ hasText: '002481' }).click();
  await page.locator('a').filter({ hasText: '002481' }).click();
  await page.getByRole('listitem').filter({ hasText: '003011' }).click();
  await page.getByText('My Store - #003011View:').click();
  await page.locator('#aspnetForm').click();
});