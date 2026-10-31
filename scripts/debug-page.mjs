import { chromium } from '@playwright/test';

const url = process.argv[2] ?? 'http://127.0.0.1:4174/';
const browser = await chromium.launch();
const page = await browser.newPage();
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}\n${e.stack ?? ''}`));
await page.goto(url, { waitUntil: 'load' });
await page.waitForTimeout(1200);
const html = await page.evaluate(() => document.getElementById('root')?.innerHTML?.slice(0, 400) ?? 'NO ROOT');
console.log('--- console ---');
console.log(logs.join('\n') || '(none)');
console.log('--- root html ---');
console.log(html);
await browser.close();
