import { expect, test } from '@playwright/test';

/**
 * Responsive checks. The "iphone" project emulates a 390×844 viewport with
 * touch input; desktop-only assertions are skipped there and vice versa.
 */

test.describe('mobile layout (iPhone viewport)', () => {
  test.skip(({ isMobile }) => !isMobile, 'mobile-only checks');

  test('uses the bottom navigation and never overflows horizontally', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('result-quantity')).toBeVisible();

    // Bottom nav is the primary navigation on phones.
    await expect(page.getByTestId('mobile-nav-position')).toBeVisible();
    await expect(page.getByTestId('nav-position')).toBeHidden(); // sidebar is hidden

    // No horizontal scrolling at any point of the main flow.
    const overflow = await page.evaluate(() => {
      const doc = document.documentElement;
      return doc.scrollWidth - doc.clientWidth;
    });
    expect(overflow).toBeLessThanOrEqual(1);

    // The fixed bottom bar sits inside the viewport and has tappable targets.
    const box = await page.getByTestId('mobile-nav-position').boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(40);
    const viewport = page.viewportSize()!;
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height + 1);

    // Header X link stays visible on a phone.
    await expect(page.getByTestId('x-link-top')).toBeVisible();
  });

  test('every page fits the phone viewport', async ({ page }) => {
    await page.goto('/');
    const pages = ['position', 'riskReward', 'takeProfit', 'fees', 'history', 'settings'];
    for (const key of pages) {
      await page.getByTestId(`mobile-nav-${key}`).click();
      await page.waitForTimeout(120);
      const overflow = await page.evaluate(() => {
        const doc = document.documentElement;
        return doc.scrollWidth - doc.clientWidth;
      });
      expect(overflow, `page ${key} overflows horizontally`).toBeLessThanOrEqual(1);
    }
  });

  test('inputs are usable with the on-screen keyboard (16px+ text, numeric keypad)', async ({
    page,
  }) => {
    await page.goto('/');
    const input = page.getByTestId('input-account');
    await expect(input).toBeVisible();
    const fontSize = await input.evaluate((el) => Number(getComputedStyle(el).fontSize.replace('px', '')));
    // iOS zooms the page when a focused input is smaller than 16px.
    expect(fontSize).toBeGreaterThanOrEqual(16);
    await expect(input).toHaveAttribute('inputmode', 'decimal');
  });
});

test.describe('desktop layout', () => {
  test.skip(({ isMobile }) => !!isMobile, 'desktop-only checks');

  test('shows the sidebar and hides the bottom navigation', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('nav-position')).toBeVisible();
    await expect(page.getByTestId('mobile-nav-position')).toBeHidden();
  });

  test('keeps the results column beside the inputs on a wide screen', async ({ page }) => {
    await page.goto('/');
    const inputs = await page.getByTestId('input-account').boundingBox();
    const results = await page.getByTestId('result-quantity').boundingBox();
    expect(inputs).not.toBeNull();
    expect(results).not.toBeNull();
    expect(results!.x).toBeGreaterThan(inputs!.x + inputs!.width);
  });

  test('supports deep links through the URL hash', async ({ page }) => {
    await page.goto('/#/fees');
    await expect(page.getByTestId('fee-entry')).toBeVisible();
    await page.getByTestId('nav-settings').click();
    await expect(page).toHaveURL(/#\/settings$/);
  });
});
