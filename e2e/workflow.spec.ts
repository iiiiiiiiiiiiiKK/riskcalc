import { expect, test } from '@playwright/test';

/** Navigation, take-profit planning, fee pages, history and settings. */

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('result-quantity')).toBeVisible();
});

test('navigates between every page', async ({ page, isMobile }) => {
  const go = async (key: string) => {
    const id = isMobile ? `mobile-nav-${key}` : `nav-${key}`;
    await page.getByTestId(id).click();
  };

  await go('riskReward');
  await expect(page.getByTestId('rr-entry')).toBeVisible();

  await go('takeProfit');
  await expect(page.getByTestId('tp-price')).toBeVisible();

  await go('fees');
  await expect(page.getByTestId('fee-entry')).toBeVisible();

  await go('history');
  await expect(page.getByTestId('export-history')).toBeVisible();

  await go('settings');
  await expect(page.getByTestId('theme-toggle')).toBeVisible();

  await go('position');
  await expect(page.getByTestId('result-quantity')).toBeVisible();
});

test('risk/reward page derives a 1:2 target from the preset chip', async ({ page, isMobile }) => {
  await page.getByTestId(isMobile ? 'mobile-nav-riskReward' : 'nav-riskReward').click();
  await page.getByTestId('rr-entry').fill('100');
  await page.getByTestId('rr-stop').fill('95');
  await page.getByTestId('rr-preset-2').click();
  await expect(page.getByTestId('rr-tp')).toHaveValue('110.00');
  await expect(page.getByTestId('rr-ratio')).toHaveText('1:2');
});

test('take-profit quick targets update the target price', async ({ page, isMobile }) => {
  await page.getByTestId(isMobile ? 'mobile-nav-takeProfit' : 'nav-takeProfit').click();
  await expect(page.getByTestId('tp-quick-2')).toBeVisible();
  await page.getByTestId('tp-quick-2').click();
  // entry 105,000 / stop 103,500 → risk 1,500 → 2R = 108,000
  await expect(page.getByTestId('tp-price')).toHaveValue('108000.00');
  await expect(page.getByTestId('tp-net')).toBeVisible();
});

test('scale-out ladder is pre-seeded and blocks a >100% ladder', async ({ page, isMobile }) => {
  await page.getByTestId(isMobile ? 'mobile-nav-takeProfit' : 'nav-takeProfit').click();
  await expect(page.getByTestId('target-price-0')).toBeVisible();
  await expect(page.getByTestId('target-price-2')).toBeVisible();
  await expect(page.getByTestId('target-qty-0')).not.toHaveText('—');

  await page.getByTestId('add-target').click();
  await expect(page.getByTestId('target-price-3')).toBeVisible();

  await page.getByTestId('target-pct-0').fill('90');
  await page.getByTestId('target-pct-1').fill('90');
  await expect(page.getByTestId('ladder-net')).toHaveCount(0);
  await expect(page.locator('[role="alert"]').first()).toBeVisible();
});

test('fee page computes open and close fees and a break-even price', async ({ page, isMobile }) => {
  await page.getByTestId(isMobile ? 'mobile-nav-fees' : 'nav-fees').click();
  await page.getByTestId('fee-entry').fill('100');
  await page.getByTestId('fee-exit').fill('110');
  await page.getByTestId('fee-quantity').fill('10');
  await page.getByTestId('fee-mode-custom').click();
  await page.getByTestId('fee-open').fill('0.1');
  await page.getByTestId('fee-close').fill('0.1');

  // open fee = 1000 × 0.1% = 1 ; close fee = 1100 × 0.1% = 1.1
  await expect(page.getByTestId('fee-open-amount')).toHaveText('1.00');
  await expect(page.getByTestId('fee-close-amount')).toHaveText('1.10');
  await expect(page.getByTestId('fee-net')).toHaveText('+97.90');
  await expect(page.getByTestId('fee-breakeven')).toBeVisible();
});

test('saves a calculation to history and restores it', async ({ page, isMobile }) => {
  await page.getByTestId('input-account').fill('12345');
  await page.getByTestId('save-position').click();
  await expect(page.locator('text=/已保存到历史|Saved to history/').first()).toBeVisible();

  await page.getByTestId(isMobile ? 'mobile-nav-history' : 'nav-history').click();
  await expect(page.getByTestId('history-item')).toHaveCount(1);

  // change something so the restore is observable
  await page.getByTestId(isMobile ? 'mobile-nav-position' : 'nav-position').click();
  await page.getByTestId('input-account').fill('1');
  await expect(page.getByTestId('input-account')).toHaveValue('1');

  await page.getByTestId(isMobile ? 'mobile-nav-history' : 'nav-history').click();
  await page.getByTestId('restore-history').first().click();
  await expect(page.getByTestId('input-account')).toHaveValue('12345');
});

test('history supports single delete and a confirmed clear', async ({ page, isMobile }) => {
  await page.getByTestId('save-position').click();
  await page.getByTestId(isMobile ? 'mobile-nav-history' : 'nav-history').click();
  await expect(page.getByTestId('history-item')).toHaveCount(1);

  await page.getByTestId('delete-history').first().click();
  await expect(page.getByTestId('history-item')).toHaveCount(0);

  await page.getByTestId(isMobile ? 'mobile-nav-position' : 'nav-position').click();
  await page.getByTestId('save-position').click();
  await page.getByTestId(isMobile ? 'mobile-nav-history' : 'nav-history').click();
  await page.getByTestId('clear-history').click();
  await page.getByTestId('confirm-clear-history').click();
  await expect(page.getByTestId('history-item')).toHaveCount(0);
});

test('history exports a JSON file', async ({ page, isMobile }) => {
  await page.getByTestId('save-position').click();
  await page.getByTestId(isMobile ? 'mobile-nav-history' : 'nav-history').click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByTestId('export-history').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/riskcalc-history-.*\.json/);
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  const json = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  expect(json.app).toBe('RiskCalc');
  expect(json.count).toBe(1);
  expect(json.calculations[0].account).toBe('10000');
});

test('theme toggle switches to the light palette', async ({ page }) => {
  const html = page.locator('html');
  await expect(html).not.toHaveClass(/light/);
  await page.getByTestId('theme-toggle').click();
  await expect(html).toHaveClass(/light/);
  await page.getByTestId('theme-toggle').click();
  await expect(html).not.toHaveClass(/light/);
});

test('language switch translates the navigation', async ({ page, isMobile }) => {
  await page.getByTestId(isMobile ? 'mobile-nav-settings' : 'nav-settings').click();
  await page.getByTestId('lang-en').click();
  await expect(page.getByTestId(isMobile ? 'mobile-nav-position' : 'nav-position')).toHaveText(
    /Position Size/,
  );
  await expect(page.getByTestId('x-link-top')).toHaveAttribute('href', 'https://x.com/0xkillcoin');
});

test('settings changes persist across a reload', async ({ page, isMobile }) => {
  await page.getByTestId(isMobile ? 'mobile-nav-settings' : 'nav-settings').click();
  await page.getByTestId('settings-decimals').selectOption('4');
  await page.getByTestId(isMobile ? 'mobile-nav-position' : 'nav-position').click();
  await expect(page.getByTestId('result-risk')).toHaveText('100.0000');

  await page.reload();
  await expect(page.getByTestId('result-risk')).toHaveText('100.0000');
});
