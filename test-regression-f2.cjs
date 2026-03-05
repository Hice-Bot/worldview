const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  console.log('Navigating to http://localhost:5173...');
  await page.goto('http://localhost:5173', { timeout: 30000 });
  await page.waitForTimeout(5000);

  // Check title
  const title = await page.title();
  console.log('Title:', title);

  // Check for root element
  const root = await page.locator('#root').count();
  console.log('Root element found:', root > 0);

  // Check if React rendered content inside root
  const rootContent = await page.locator('#root').innerHTML();
  console.log('Root has content:', rootContent.length > 0);
  console.log('Root content length:', rootContent.length);

  // Take screenshot
  await page.screenshot({ path: '/mnt/c/Users/turke/worldview/test-screenshot-feature2.png', fullPage: true });
  console.log('Screenshot saved to test-screenshot-feature2.png');

  // Report console errors
  console.log('Console errors:', errors.length);
  if (errors.length > 0) {
    errors.forEach(e => console.log('  ERROR:', e));
  }

  // Check for Vite HMR
  const viteClient = await page.evaluate(() => {
    return typeof __vite_plugin_react_preamble_installed__ !== 'undefined' ||
           document.querySelector('script[src*="@vite/client"]') !== null;
  });
  console.log('Vite HMR active:', viteClient);

  await browser.close();
  console.log('Done - all checks complete');
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
