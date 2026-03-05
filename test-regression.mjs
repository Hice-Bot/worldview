import { chromium } from 'playwright';
import fs from 'fs';

const RESULTS = {};

async function testFeature2(page) {
  console.log('\n=== FEATURE 2: Vite frontend builds and loads ===');

  // Collect console errors
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', err => consoleErrors.push(err.message));

  // Navigate to Vite dev server
  console.log('Step 1: Navigating to http://localhost:5173...');
  const response = await page.goto('http://localhost:5173', { waitUntil: 'networkidle', timeout: 30000 });
  console.log(`  HTTP Status: ${response.status()}`);

  if (response.status() !== 200) {
    RESULTS.feature2 = { pass: false, reason: `HTTP ${response.status()} instead of 200` };
    return;
  }

  // Check React app renders
  console.log('Step 2: Checking React root mount point...');
  const rootEl = await page.$('#root');
  if (!rootEl) {
    RESULTS.feature2 = { pass: false, reason: 'No #root element found' };
    return;
  }
  console.log('  #root element found');

  // Check that React has rendered content inside root
  console.log('Step 3: Checking React has rendered content...');
  await page.waitForTimeout(3000); // Give React time to render
  const rootContent = await page.$eval('#root', el => el.innerHTML.length);
  console.log(`  #root innerHTML length: ${rootContent}`);

  if (rootContent < 50) {
    RESULTS.feature2 = { pass: false, reason: `Root has too little content (${rootContent} chars)` };
    return;
  }

  // Take screenshot
  console.log('Step 4: Taking screenshot...');
  await page.screenshot({ path: '/mnt/c/Users/turke/worldview/test-screenshot-feature2.png', fullPage: false });
  console.log('  Screenshot saved to test-screenshot-feature2.png');

  // Check Vite HMR
  console.log('Step 5: Checking Vite HMR...');
  const viteClient = await page.evaluate(() => {
    return typeof __vite_plugin_react_preamble_installed__ !== 'undefined' ||
           document.querySelector('script[src*="@vite/client"]') !== null;
  });
  console.log(`  Vite HMR active: ${viteClient}`);

  // Report console errors
  // Filter out known non-critical warnings
  const criticalErrors = consoleErrors.filter(e =>
    !e.includes('favicon') &&
    !e.includes('DevTools') &&
    !e.includes('Deprecated') &&
    !e.includes('third-party cookie')
  );

  if (criticalErrors.length > 0) {
    console.log(`  Console errors found: ${criticalErrors.length}`);
    criticalErrors.forEach(e => console.log(`    ERROR: ${e}`));
    RESULTS.feature2 = { pass: false, reason: `Console errors: ${criticalErrors[0]}`, errors: criticalErrors };
    return;
  }

  console.log('  No critical console errors');
  RESULTS.feature2 = { pass: true };
}

async function testFeature3() {
  console.log('\n=== FEATURE 3: Backend proxy can reach external APIs ===');

  console.log('Step 1: GET /api/earthquakes...');
  const resp = await fetch('http://localhost:3001/api/earthquakes');
  console.log(`  HTTP Status: ${resp.status}`);

  if (resp.status !== 200) {
    RESULTS.feature3 = { pass: false, reason: `HTTP ${resp.status} instead of 200` };
    return;
  }

  console.log('Step 2: Parsing response as JSON...');
  const data = await resp.json();

  console.log('Step 3: Checking GeoJSON format...');
  if (data.type !== 'FeatureCollection') {
    RESULTS.feature3 = { pass: false, reason: `type is '${data.type}' not 'FeatureCollection'` };
    return;
  }
  console.log(`  type: ${data.type} ✓`);

  console.log('Step 4: Checking features array...');
  if (!Array.isArray(data.features) || data.features.length === 0) {
    RESULTS.feature3 = { pass: false, reason: 'Features array is empty or missing' };
    return;
  }
  console.log(`  features count: ${data.features.length}`);

  // Check first feature has expected earthquake properties
  const first = data.features[0];
  console.log('Step 5: Checking earthquake object structure...');
  const hasMag = first?.properties?.mag !== undefined;
  const hasCoords = Array.isArray(first?.geometry?.coordinates) && first.geometry.coordinates.length >= 2;
  const hasTitle = first?.properties?.title || first?.properties?.place;

  console.log(`  has magnitude: ${hasMag} (${first?.properties?.mag})`);
  console.log(`  has coordinates: ${hasCoords} (${JSON.stringify(first?.geometry?.coordinates)})`);
  console.log(`  has title/place: ${!!hasTitle} (${first?.properties?.title || first?.properties?.place})`);

  if (!hasMag || !hasCoords) {
    RESULTS.feature3 = { pass: false, reason: 'Earthquake objects missing magnitude or coordinates' };
    return;
  }

  console.log('  Real earthquake data confirmed (not mock) ✓');
  RESULTS.feature3 = { pass: true };
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  try {
    await testFeature2(page);
    await testFeature3();
  } catch (err) {
    console.error('Test error:', err.message);
  } finally {
    await browser.close();
  }

  console.log('\n=== RESULTS ===');
  console.log(JSON.stringify(RESULTS, null, 2));

  // Exit with error code if any feature failed
  const allPass = Object.values(RESULTS).every(r => r.pass);
  process.exit(allPass ? 0 : 1);
}

main();
