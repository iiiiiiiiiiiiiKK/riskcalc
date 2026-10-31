import { expect, test, type Page } from '@playwright/test';

/**
 * Position-sizing flows against the production build.
 * Numbers are read from the DOM and compared numerically so the assertions stay
 * meaningful while display precision can change.
 */

async function quantity(page: Page): Promise<number> {
  const text = (await page.getByTestId('result-quantity').textContent()) ?? '';
  return Number(text.replace(/,/g, ''));
}

async function money(page: Page, testId: string): Promise<number> {
  const text = (await page.getByTestId(testId).textContent()) ?? '';
  return Number(text.replace(/,/g, ''));
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('result-quantity')).toBeVisible();
});

test('renders the default long position with a sized result', async ({ page }) => {
  // account 10,000 · risk 1% · entry 105,000 · stop 103,500 → risk 100, distance 1,500
  // quantity ≈ 0.0623 with taker fees included
  const qty = await quantity(page);
  expect(qty).toBeGreaterThan(0.06);
  expect(qty).toBeLessThan(0.065);
  expect(await money(page, 'result-risk')).toBeCloseTo(100, 2);
  expect(await money(page, 'result-notional')).toBeCloseTo(qty * 105000, 0);
});

test('switching to short validates the stop direction', async ({ page }) => {
  await page.getByTestId('side-short').click();
  // stop 103,500 is below the entry → invalid for a short
  await expect(page.getByTestId('result-quantity')).toHaveCount(0);
  await expect(page.locator('[role="alert"]').first()).toBeVisible();

  const stop = page.getByTestId('input-stop');
  await stop.fill('106500');
  await expect(page.getByTestId('result-quantity')).toBeVisible();
  expect(await quantity(page)).toBeGreaterThan(0.06);
});

test('recalculates live when the account balance changes', async ({ page }) => {
  const before = await quantity(page);
  await page.getByTestId('input-account').fill('20000');
  await expect(page.getByTestId('result-quantity')).not.toHaveText('');
  const after = await quantity(page);
  expect(after / before).toBeCloseTo(2, 2);
  expect(await money(page, 'result-risk')).toBeCloseTo(200, 2);
});

test('recalculates live when the risk percentage changes', async ({ page }) => {
  const before = await quantity(page);
  await page.getByTestId('risk-template-2').click();
  await expect(page.getByTestId('input-risk')).toHaveValue('2');
  const after = await quantity(page);
  expect(after / before).toBeCloseTo(2, 2);
  expect(await money(page, 'result-risk')).toBeCloseTo(200, 2);
});

test('recalculates live when entry and stop prices change', async ({ page }) => {
  await page.getByTestId('input-entry').fill('50000');
  await page.getByTestId('input-stop').fill('49000');
  // risk 100 / (distance 1000 + 49.5 of fees) ≈ 0.0953
  await expect(page.getByTestId('result-quantity')).toBeVisible();
  const qty = await quantity(page);
  expect(qty).toBeGreaterThan(0.095);
  expect(qty).toBeLessThan(0.096);
});

test('shows a specific error instead of a bogus position for a wrong-side stop', async ({ page }) => {
  await page.getByTestId('input-stop').fill('110000');
  await expect(page.getByTestId('result-quantity')).toHaveCount(0);
  const alert = page.locator('[role="alert"]').first();
  await expect(alert).toBeVisible();
  await expect(alert).toContainText(/止损价格必须低于入场价格|stop must be below/);
});

test('rejects an empty required field', async ({ page }) => {
  await page.getByTestId('input-account').fill('');
  await expect(page.getByTestId('result-quantity')).toHaveCount(0);
  await expect(page.locator('[role="alert"]').first()).toBeVisible();
});

test('leverage changes the margin but not the position size', async ({ page }) => {
  const before = await quantity(page);
  const margin10 = await money(page, 'result-margin');
  await page.getByTestId('leverage-preset-20').click();
  const margin20 = await money(page, 'result-margin');
  const after = await quantity(page);
  expect(after).toBeCloseTo(before, 6);
  expect(margin20).toBeCloseTo(margin10 / 2, 0);
});

test('excluding fees increases the position size', async ({ page }) => {
  const withFees = await quantity(page);
  await page.getByTestId('fee-include').click();
  const withoutFees = await quantity(page);
  expect(withoutFees).toBeGreaterThan(withFees);
  // 100 / 1500 = 0.0666…
  expect(withoutFees).toBeCloseTo(0.0667, 3);
});

test('custom fee rates feed through to the position size', async ({ page }) => {
  await page.getByTestId('fee-mode-custom').click();
  const zeroQtyBefore = await quantity(page);
  await page.getByTestId('fee-open').fill('1');
  await page.getByTestId('fee-close').fill('1');
  await expect(page.getByTestId('result-quantity')).toBeVisible();
  const highFeeQty = await quantity(page);
  expect(highFeeQty).toBeLessThan(zeroQtyBefore);
});

test('copy results puts a summary on the clipboard', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.getByTestId('copy-results').click();
  const clipboard = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboard).toContain('RiskCalc');
  expect(clipboard).toContain('105,000');
  await expect(page.locator('text=/已复制|Copied/').first()).toBeVisible();
});

test('reset restores the default draft', async ({ page }) => {
  await page.getByTestId('input-account').fill('777');
  await expect(page.getByTestId('input-account')).toHaveValue('777');
  await page.getByTestId('reset-position').click();
  await expect(page.getByTestId('input-account')).toHaveValue('10000');
});

test('exposes the author X link in the header', async ({ page }) => {
  const link = page.getByTestId('x-link-top');
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute('href', 'https://x.com/0xkillcoin');
  await expect(link).toHaveAttribute('target', '_blank');
});
