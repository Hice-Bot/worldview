const { chromium } = require('playwright');

async function main() {
  console.log('=== Feature #110: Browser verification ===\n');

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    // Collect console errors
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Collect page errors (uncaught exceptions)
    const pageErrors = [];
    page.on('pageerror', err => {
      pageErrors.push(err.message);
    });

    console.log('Loading http://localhost:5173/...');
    await page.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 30000 });

    // Wait a bit for React to render
    await page.waitForTimeout(3000);

    // Check React root has content
    const rootContent = await page.evaluate(() => {
      const root = document.getElementById('root');
      return root ? root.innerHTML.length : 0;
    });
    console.log('Root div content length:', rootContent);
    console.log('React rendered:', rootContent > 0 ? 'YES' : 'NO');

    // Check for CesiumJS canvas (globe loading)
    const hasCanvas = await page.evaluate(() => {
      return document.querySelector('canvas') !== null;
    });
    console.log('Has canvas element (CesiumJS):', hasCanvas);

    // Check for Cesium viewer container
    const hasCesiumContainer = await page.evaluate(() => {
      return document.querySelector('.cesium-viewer') !== null ||
             document.querySelector('[class*="cesium"]') !== null;
    });
    console.log('Has Cesium container:', hasCesiumContainer);

    // Filter out known non-critical errors (Cesium tile loading, etc.)
    const criticalErrors = consoleErrors.filter(e => {
      // Filter out known non-critical messages
      if (e.includes('404') && e.includes('favicon')) return false;
      if (e.includes('net::ERR_')) return false; // Network errors from tile loading
      if (e.includes('Failed to load resource') && e.includes('tile')) return false;
      if (e.includes('Cesium') && e.includes('tile')) return false;
      if (e.includes('Google') && e.includes('tile')) return false;
      if (e.includes('photorealistic')) return false;
      if (e.includes('ion.cesium.com')) return false;
      return true;
    });

    console.log('\nConsole errors (total):', consoleErrors.length);
    console.log('Critical console errors:', criticalErrors.length);
    if (criticalErrors.length > 0) {
      console.log('Critical errors:');
      criticalErrors.forEach(e => console.log('  -', e.substring(0, 200)));
    }

    console.log('\nUncaught page errors:', pageErrors.length);
    if (pageErrors.length > 0) {
      pageErrors.forEach(e => console.log('  -', e.substring(0, 200)));
    }

    // Take a screenshot
    await page.screenshot({ path: '.playwright-cli/feature110.png', fullPage: true });
    console.log('\nScreenshot saved to .playwright-cli/feature110.png');

    // Final verdict
    const pass = rootContent > 0 && pageErrors.length === 0;
    console.log('\n=== RESULT:', pass ? 'PASS' : 'FAIL', '===');

    if (!pass) process.exit(1);
  } catch (e) {
    console.error('Browser test failed:', e.message);
    process.exit(1);
  } finally {
    if (browser) await browser.close();
  }
}

main();
