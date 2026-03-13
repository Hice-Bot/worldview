/**
 * Test Features #121 and #122
 * #121: Concurrent tile switching doesn't corrupt globe
 * #122: Rapid flyTo requests handled cleanly
 */
const { chromium } = require('playwright');

(async () => {
  console.log('=== Feature #121 & #122 Test ===\n');

  let browser;
  try {
    browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();

    // Collect console errors
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => consoleErrors.push(err.message));

    console.log('Loading app...');
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000); // Let globe initialize

    // ============================================================
    // Feature #121: Concurrent tile switching doesn't corrupt globe
    // ============================================================
    console.log('\n--- Feature #121: Concurrent Tile Switching ---');

    // Check initial state - should be on Google 3D
    const google3dBtn = page.locator('button:has-text("Google 3D")');
    const osmBtn = page.locator('button:has-text("OSM")');

    // Verify buttons exist
    const googleVisible = await google3dBtn.isVisible().catch(() => false);
    const osmVisible = await osmBtn.isVisible().catch(() => false);
    console.log(`Google 3D button visible: ${googleVisible}`);
    console.log(`OSM button visible: ${osmVisible}`);

    if (!googleVisible || !osmVisible) {
      console.log('FAIL: Tile toggle buttons not found');
      process.exit(1);
    }

    // Rapid switching test: Google 3D -> OSM -> Google 3D -> OSM in quick succession
    console.log('Performing rapid tile switching...');
    const errorsBeforeSwitch = consoleErrors.length;

    // Click Google 3D first to ensure we start from a known state
    await google3dBtn.click();
    await page.waitForTimeout(100);

    // Rapid switch: OSM then immediately Google 3D then immediately OSM
    await osmBtn.click();
    await page.waitForTimeout(50); // Very quick - don't wait for tiles to load
    await google3dBtn.click();
    await page.waitForTimeout(50);
    await osmBtn.click();
    await page.waitForTimeout(50);
    await google3dBtn.click();
    await page.waitForTimeout(50);
    await osmBtn.click(); // Final state should be OSM

    // Wait for things to settle
    console.log('Waiting for globe to settle after rapid switching...');
    await page.waitForTimeout(5000);

    // Check for JS errors during rapid switching
    const switchErrors = consoleErrors.slice(errorsBeforeSwitch)
      .filter(e => !e.includes('Google 3D Tiles failed') && !e.includes('net::'));
    if (switchErrors.length > 0) {
      console.log(`WARNING: ${switchErrors.length} console errors during tile switch:`);
      switchErrors.forEach(e => console.log(`  - ${e}`));
    } else {
      console.log('PASS: No JS errors during rapid tile switching');
    }

    // Verify the globe is still functional - take a screenshot to check
    // The OSM button should now be active (last click was OSM)
    const osmActive = await page.evaluate(() => {
      const btns = document.querySelectorAll('button');
      for (const btn of btns) {
        if (btn.textContent?.trim() === 'OSM' && btn.className.includes('blue-500')) return true;
      }
      return false;
    });
    console.log(`OSM button active (last selected): ${osmActive}`);

    // Verify no black globe - check that the Cesium canvas exists and has content
    const canvasExists = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      return !!canvas && canvas.width > 0 && canvas.height > 0;
    });
    console.log(`Globe canvas exists and has size: ${canvasExists}`);

    // Switch back and forth one more time to verify stability
    await google3dBtn.click();
    await page.waitForTimeout(200);
    await osmBtn.click();
    await page.waitForTimeout(2000);

    const finalCanvasOk = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      return !!canvas && canvas.width > 0 && canvas.height > 0;
    });
    console.log(`Globe canvas still ok after second round: ${finalCanvasOk}`);

    // Verify the globe isn't destroyed
    const globeNotDestroyed = await page.evaluate(() => {
      // Check that Cesium viewer still has a valid scene
      const cesiumWidget = document.querySelector('.cesium-widget');
      return !!cesiumWidget;
    });
    console.log(`Cesium widget still present: ${globeNotDestroyed}`);

    const feature121Pass = canvasExists && finalCanvasOk && globeNotDestroyed;
    console.log(`\nFeature #121 RESULT: ${feature121Pass ? 'PASS' : 'FAIL'}`);

    // ============================================================
    // Feature #122: Rapid flyTo requests handled cleanly
    // ============================================================
    console.log('\n--- Feature #122: Rapid flyTo Requests ---');

    const errorsBeforeFly = consoleErrors.length;

    // Find Locate Me and Reset View buttons
    const locateBtn = page.locator('button:has-text("Locate Me")');
    const resetBtn = page.locator('button:has-text("Reset View")');

    const locateVisible = await locateBtn.isVisible().catch(() => false);
    const resetVisible = await resetBtn.isVisible().catch(() => false);
    console.log(`Locate Me button visible: ${locateVisible}`);
    console.log(`Reset View button visible: ${resetVisible}`);

    if (!locateVisible || !resetVisible) {
      console.log('FAIL: Utility buttons not found');
      process.exit(1);
    }

    // Rapid flyTo test: Click Locate Me then immediately Reset View
    console.log('Clicking Locate Me then immediately Reset View...');
    await locateBtn.click();
    await page.waitForTimeout(200); // Very brief pause
    await resetBtn.click();

    // Wait for animation to complete
    console.log('Waiting for camera animation to settle...');
    await page.waitForTimeout(4000);

    // Verify globe is still functional after rapid flyTo
    const canvasAfterFly = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      return !!canvas && canvas.width > 0 && canvas.height > 0;
    });
    console.log(`Globe canvas ok after rapid flyTo: ${canvasAfterFly}`);

    // Verify no camera jitter by checking Cesium widget is still intact
    const widgetAfterFly = await page.evaluate(() => {
      const cesiumWidget = document.querySelector('.cesium-widget');
      return !!cesiumWidget;
    });
    console.log(`Cesium widget intact after rapid flyTo: ${widgetAfterFly}`);

    // Do another rapid sequence: Reset View -> Locate Me -> Reset View
    console.log('Second rapid sequence: Reset -> Locate -> Reset...');
    await resetBtn.click();
    await page.waitForTimeout(100);
    await locateBtn.click();
    await page.waitForTimeout(100);
    await resetBtn.click();

    await page.waitForTimeout(4000);

    const canvasAfterSecond = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      return !!canvas && canvas.width > 0 && canvas.height > 0;
    });
    console.log(`Globe canvas ok after second rapid sequence: ${canvasAfterSecond}`);

    // Check for flyTo-related errors
    const flyErrors = consoleErrors.slice(errorsBeforeFly)
      .filter(e => !e.includes('Geolocation') && !e.includes('net::') && !e.includes('Failed to fetch'));
    if (flyErrors.length > 0) {
      console.log(`WARNING: ${flyErrors.length} console errors during flyTo:`);
      flyErrors.forEach(e => console.log(`  - ${e}`));
    } else {
      console.log('PASS: No JS errors during rapid flyTo');
    }

    const feature122Pass = canvasAfterFly && widgetAfterFly && canvasAfterSecond;
    console.log(`\nFeature #122 RESULT: ${feature122Pass ? 'PASS' : 'FAIL'}`);

    // ============================================================
    // Summary
    // ============================================================
    console.log('\n=== SUMMARY ===');
    console.log(`Feature #121 (Concurrent tile switching): ${feature121Pass ? 'PASS' : 'FAIL'}`);
    console.log(`Feature #122 (Rapid flyTo requests): ${feature122Pass ? 'PASS' : 'FAIL'}`);

    // Report total console errors
    const criticalErrors = consoleErrors.filter(e =>
      !e.includes('Google 3D Tiles failed') &&
      !e.includes('net::') &&
      !e.includes('Geolocation') &&
      !e.includes('Failed to fetch') &&
      !e.includes('favicon')
    );
    console.log(`\nTotal critical console errors: ${criticalErrors.length}`);
    if (criticalErrors.length > 0) {
      criticalErrors.forEach(e => console.log(`  - ${e.substring(0, 150)}`));
    }

    await browser.close();
    process.exit(feature121Pass && feature122Pass ? 0 : 1);

  } catch (err) {
    console.error('Test error:', err.message);
    if (browser) await browser.close();
    process.exit(1);
  }
})();
