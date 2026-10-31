/**
 * Captures the README screenshots from the real production build.
 *
 * Usage:  node scripts/capture-screenshots.mjs http://127.0.0.1:4173/
 */
import { chromium, devices } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const base = process.argv[2] ?? 'http://127.0.0.1:4173/';
const outDir = 'docs/screenshots';
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();

async function shot(name, opts, prepare) {
  const context = await browser.newContext(opts);
  const page = await context.newPage();
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  if (prepare) await prepare(page);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${outDir}/${name}.png`, fullPage: false });
  await context.close();
  console.log('captured', name);
}

const desktop = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 };

await shot('position-dark', desktop, async (page) => {
  await page.getByTestId('input-entry').fill('67500');
  await page.getByTestId('input-stop').fill('66200');
  await page.getByTestId('input-account').fill('25000');
  await page.getByTestId('input-risk').fill('1');
});

await shot('take-profit-dark', desktop, async (page) => {
  await page.getByTestId('nav-takeProfit').click();
  await page.getByTestId('tp-entry').fill('67500');
  await page.getByTestId('tp-stop').fill('66200');
  await page.getByTestId('tp-price').fill('70800');
});

await shot('fees-dark', desktop, async (page) => {
  await page.getByTestId('nav-fees').click();
  await page.getByTestId('fee-entry').fill('67500');
  await page.getByTestId('fee-exit').fill('70800');
});

await shot('risk-reward-dark', desktop, async (page) => {
  await page.getByTestId('nav-riskReward').click();
  await page.getByTestId('rr-entry').fill('67500');
  await page.getByTestId('rr-stop').fill('66200');
  await page.getByTestId('rr-tp').fill('70800');
});

await shot('settings-dark', desktop, async (page) => {
  await page.getByTestId('nav-settings').click();
});

await shot('position-light', desktop, async (page) => {
  await page.getByTestId('theme-toggle').click();
  await page.getByTestId('input-entry').fill('67500');
  await page.getByTestId('input-stop').fill('66200');
  await page.getByTestId('input-account').fill('25000');
});

// iPhone 15 Pro logical viewport.
const iphone = {
  ...devices['iPhone 15 Pro'],
  viewport: { width: 393, height: 852 },
  deviceScaleFactor: 3,
};

await shot('mobile-position', iphone, async (page) => {
  await page.getByTestId('input-entry').fill('67500');
  await page.getByTestId('input-stop').fill('66200');
  await page.getByTestId('input-account').fill('25000');
});

await shot('mobile-take-profit', iphone, async (page) => {
  await page.getByTestId('mobile-nav-takeProfit').click();
  await page.getByTestId('tp-entry').fill('67500');
  await page.getByTestId('tp-stop').fill('66200');
});

await shot('mobile-history', iphone, async (page) => {
  await page.getByTestId('save-position').click();
  await page.getByTestId('mobile-nav-history').click();
});

await shot('mobile-settings', iphone, async (page) => {
  await page.getByTestId('mobile-nav-settings').click();
});

await browser.close();
console.log('done');
