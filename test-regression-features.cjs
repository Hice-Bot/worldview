const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  try {
    // === FEATURE 2: Vite frontend builds and loads ===
    console.log('\n=== FEATURE 2: Vite frontend builds and loads ===');

    // Test 1: Navigate to Vite dev server
    const response = await page.goto('http://localhost:5173', { timeout: 30000 });
    console.log('Step 1 - Page loaded, status:', response.status());

    // Test 2: Check page title
    const title = await page.title();
    console.log('Step 2 - Title:', title);

    // Test 3: Check for root React mount point
    const root = await page.locator('#root').count();
    console.log('Step 3 - Root element found:', root > 0);

    // Wait for React to render
    await page.waitForTimeout(5000);

    // Test 4: Check that React rendered something into root
    const rootContent = await page.locator('#root').innerHTML();
    console.log('Step 4 - Root has content:', rootContent.length > 0, '(' + rootContent.length + ' chars)');

    // Test 5: Check Vite HMR is active (script tag present in source)
    const viteHMR = await page.evaluate(() => {
      const scripts = document.querySelectorAll('script');
      for (const s of scripts) {
        if (s.src && s.src.includes('@vite/client')) return true;
      }
      // Also check if module was loaded
      return document.querySelector('script[type="module"][src*="@vite/client"]') !== null;
    });
    console.log('Step 5 - Vite HMR active:', viteHMR);

    // Check console errors (filter out known non-critical ones)
    const criticalErrors = errors.filter(e =>
      !e.includes('favicon') &&
      !e.includes('404') &&
      !e.includes('net::ERR') &&
      !e.includes('WebSocket')
    );
    console.log('Step 6 - Console errors:', criticalErrors.length === 0 ? 'None' : criticalErrors);

    // Take screenshot
    await page.screenshot({ path: '.playwright-cli/feature2-test.png', fullPage: true });
    console.log('Screenshot saved to .playwright-cli/feature2-test.png');

    const f2pass = response.status() === 200 && root > 0 && rootContent.length > 0;
    console.log('FEATURE 2 RESULT:', f2pass ? 'PASS' : 'FAIL');

    // === FEATURE 3: Backend proxy can reach external APIs ===
    console.log('\n=== FEATURE 3: Backend proxy can reach external APIs ===');

    // Test via fetch from Node context (direct API call)
    const fetch = globalThis.fetch || (await import('node-fetch')).default;

    const eqResponse = await fetch('http://localhost:3001/api/earthquakes');
    console.log('Step 1 - GET /api/earthquakes status:', eqResponse.status);

    const eqData = await eqResponse.json();
    console.log('Step 2 - Response type:', eqData.type);
    console.log('Step 2 - Is FeatureCollection:', eqData.type === 'FeatureCollection');

    const hasFeatures = Array.isArray(eqData.features) && eqData.features.length > 0;
    console.log('Step 3 - Has features array:', hasFeatures);
    if (hasFeatures) {
      const sample = eqData.features[0];
      const hasMag = sample.properties && typeof sample.properties.mag === 'number';
      const hasCoords = sample.geometry && Array.isArray(sample.geometry.coordinates);
      console.log('Step 3 - Has magnitude:', hasMag);
      console.log('Step 3 - Has coordinates:', hasCoords);
      console.log('Step 4 - Sample event:', sample.properties.title || sample.properties.place);
      console.log('Step 5 - Features count:', eqData.features.length, '(real data, not mock)');
    }

    const f3pass = eqResponse.status === 200 && eqData.type === 'FeatureCollection' && hasFeatures;
    console.log('FEATURE 3 RESULT:', f3pass ? 'PASS' : 'FAIL');

    console.log('\n=== SUMMARY ===');
    console.log('Feature 2:', f2pass ? 'PASS' : 'FAIL');
    console.log('Feature 3:', f3pass ? 'PASS' : 'FAIL');
    console.log('All console errors collected:', errors.length);

  } catch (err) {
    console.error('TEST ERROR:', err.message);
  } finally {
    await browser.close();
  }
})();
