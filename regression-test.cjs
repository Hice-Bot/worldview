const { chromium } = require('playwright');

async function testFeature2() {
  console.log('=== FEATURE 2: Vite frontend builds and loads ===');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  const consoleErrors = [];
  const consoleWarnings = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
    if (msg.type() === 'warning') consoleWarnings.push(msg.text());
  });

  page.on('pageerror', err => {
    consoleErrors.push('PAGE ERROR: ' + err.message);
  });

  try {
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle', timeout: 30000 });

    // Check 1: Page loads
    const title = await page.title();
    console.log('Title:', title);

    // Check 2: Root mount point exists
    const root = await page.$('#root');
    console.log('Root element exists:', !!root);

    // Check 3: Check if React rendered content inside root
    const rootHTML = await page.$eval('#root', el => el.innerHTML.substring(0, 500));
    console.log('Root has content:', rootHTML.length > 0);
    console.log('Root HTML preview:', rootHTML.substring(0, 200));

    // Check 4: Vite HMR active (check for vite client script)
    const viteClient = await page.$('script[src="/@vite/client"]');
    console.log('Vite HMR script present:', !!viteClient);

    // Wait a bit for any async errors
    await page.waitForTimeout(3000);

    // Check 5: Console errors
    console.log('\nConsole errors:', consoleErrors.length);
    if (consoleErrors.length > 0) {
      consoleErrors.forEach(e => console.log('  ERROR:', e));
    }
    console.log('Console warnings:', consoleWarnings.length);
    if (consoleWarnings.length > 0) {
      consoleWarnings.forEach(w => console.log('  WARN:', w));
    }

    // Take screenshot
    await page.screenshot({ path: '/mnt/c/Users/turke/worldview/regression-screenshot-f2.png', fullPage: false });
    console.log('Screenshot saved: regression-screenshot-f2.png');

    // Verdict
    const criticalErrors = consoleErrors.filter(e => !e.includes('favicon') && !e.includes('404'));
    const pass = !!root && rootHTML.length > 0 && criticalErrors.length === 0;
    console.log('\n=== FEATURE 2 RESULT:', pass ? 'PASS' : 'FAIL', '===');

  } catch (err) {
    console.log('ERROR:', err.message);
    console.log('=== FEATURE 2 RESULT: FAIL ===');
  } finally {
    await browser.close();
  }
}

testFeature2().catch(console.error);
