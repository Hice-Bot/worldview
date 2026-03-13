// Test Feature 2: Vite frontend builds and loads
const { chromium } = require('playwright');

(async () => {
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    // Step 1: Navigate to Vite dev server
    console.log('Step 1: Opening http://localhost:5173...');
    const response = await page.goto('http://localhost:5173', { waitUntil: 'networkidle', timeout: 30000 });
    const status = response.status();
    console.log('HTTP status:', status);
    if (status !== 200) {
      console.log('FAIL: Expected 200, got ' + status);
      process.exit(1);
    }
    console.log('PASS: Vite dev server responds with 200');

    // Step 2: Check for root React mount point
    console.log('\nStep 2: Checking for React root mount point...');
    const rootEl = await page.$('#root');
    if (!rootEl) {
      console.log('FAIL: No #root element found');
      process.exit(1);
    }
    console.log('PASS: #root element exists');

    // Step 3: Wait for React to render content
    console.log('\nStep 3: Waiting for React to render...');
    await page.waitForTimeout(5000); // Give React time to mount

    const rootContent = await page.$eval('#root', el => el.innerHTML.length);
    console.log('Root innerHTML length:', rootContent);
    if (rootContent < 10) {
      console.log('FAIL: React app did not render (root is empty)');
      process.exit(1);
    }
    console.log('PASS: React app rendered content');

    // Step 4: Check for console errors
    console.log('\nStep 4: Checking for console errors...');
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    // Reload to capture errors
    await page.reload({ waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);

    if (errors.length > 0) {
      console.log('Console errors found:');
      errors.forEach(e => console.log('  ERROR:', e));
      // Don't fail on console errors that are from external APIs
      const criticalErrors = errors.filter(e =>
        !e.includes('net::') &&
        !e.includes('CORS') &&
        !e.includes('404') &&
        !e.includes('Failed to fetch')
      );
      if (criticalErrors.length > 0) {
        console.log('FAIL: Critical console errors found');
        process.exit(1);
      }
      console.log('WARN: Non-critical errors found (network/CORS), ignoring');
    } else {
      console.log('PASS: No console errors');
    }

    // Step 5: Check Vite HMR
    console.log('\nStep 5: Checking Vite HMR...');
    const viteClientScript = await page.$('script[src*="@vite/client"]');
    const pageHTML = await page.content();
    const hasViteClient = pageHTML.includes('@vite/client');
    const hasReactRefresh = pageHTML.includes('@react-refresh') || pageHTML.includes('react-refresh');
    console.log('Vite client present:', hasViteClient);
    console.log('React refresh present:', hasReactRefresh);
    if (!hasViteClient) {
      console.log('FAIL: Vite HMR client not found');
      process.exit(1);
    }
    console.log('PASS: Vite HMR is active');

    // Take screenshot
    console.log('\nTaking screenshot...');
    await page.screenshot({ path: '/mnt/c/Users/turke/worldview/.playwright-cli/feature2-test.png', fullPage: false });
    console.log('Screenshot saved to .playwright-cli/feature2-test.png');

    console.log('\n=== ALL CHECKS PASSED for Feature 2 ===');
    process.exit(0);
  } catch (err) {
    console.log('ERROR:', err.message);
    process.exit(1);
  } finally {
    if (browser) await browser.close();
  }
})();
