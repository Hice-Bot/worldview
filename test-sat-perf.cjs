const { chromium } = require('playwright');

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Collect console messages
  const consoleMsgs = [];
  page.on('console', msg => consoleMsgs.push(msg.text()));
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));

  console.log('Navigating to app...');
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle', timeout: 30000 });

  // Wait for globe to load
  await page.waitForTimeout(5000);

  // Check for satellite layer satellites toggle
  const satToggle = await page.$('text=SATS');
  if (satToggle) {
    console.log('SATS toggle found');
  } else {
    console.log('SATS toggle NOT found');
  }

  // Check page title and that it loaded
  const title = await page.title();
  console.log('Page title:', title);

  // Check for JS errors
  if (errors.length > 0) {
    console.log('JS ERRORS:', errors.length);
    errors.forEach(e => console.log('  ERROR:', e.substring(0, 200)));
  } else {
    console.log('No JS errors');
  }

  // Check for satellite entity counts in status bar
  const statusBar = await page.$('.status-bar, [class*=StatusBar], [class*=statusBar]');
  if (statusBar) {
    const text = await statusBar.textContent();
    console.log('StatusBar:', text.substring(0, 300));
  }

  // Take screenshot
  await page.screenshot({ path: '/mnt/c/Users/turke/worldview/.playwright-cli/sat-perf-test.png', fullPage: false });
  console.log('Screenshot saved');

  // Test satellite API endpoint performance
  const start = Date.now();
  const response = await page.evaluate(async () => {
    const t0 = performance.now();
    const res = await fetch('/api/satellites');
    const data = await res.json();
    const t1 = performance.now();
    return { count: data.length, timeMs: Math.round(t1 - t0) };
  });
  console.log('Satellite API:', response.count, 'satellites in', response.timeMs, 'ms');

  // Wait more for satellite propagation to run
  await page.waitForTimeout(3000);

  // Check console for any propagation-related issues
  const satMessages = consoleMsgs.filter(m =>
    m.toLowerCase().includes('satellite') ||
    m.toLowerCase().includes('propagat') ||
    m.toLowerCase().includes('sgp4')
  );
  if (satMessages.length > 0) {
    console.log('Satellite console messages:');
    satMessages.forEach(m => console.log('  ', m.substring(0, 200)));
  }

  await browser.close();
  console.log('Test complete');
}

main().catch(e => console.error('Test failed:', e.message));
