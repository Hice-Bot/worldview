var pw = require('playwright');

(async function() {
  var browser = await pw.chromium.launch({ headless: true });
  var page = await browser.newPage();

  // Test Feature 1: Backend health endpoint via browser
  await page.goto('http://localhost:5173', { timeout: 30000, waitUntil: 'networkidle' });

  // Take a screenshot
  await page.screenshot({ path: '/mnt/c/Users/turke/worldview/tmp_screenshot.png', fullPage: true });
  process.stdout.write('Screenshot saved\n');

  // Check for console errors
  var errors = [];
  page.on('console', function(msg) {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  // Reload to capture console errors
  await page.goto('http://localhost:5173', { timeout: 30000, waitUntil: 'networkidle' });
  await page.waitForTimeout(5000);

  // Get page title
  var title = await page.title();
  process.stdout.write('Page title: ' + title + '\n');

  // Check if Cesium viewer is present
  var hasCesium = await page.evaluate(function() {
    return document.querySelector('.cesium-viewer') !== null || document.querySelector('[class*="cesium"]') !== null || document.querySelector('canvas') !== null;
  });
  process.stdout.write('Has Cesium/Canvas: ' + hasCesium + '\n');

  // Check for any visible error messages on the page
  var bodyText = await page.evaluate(function() {
    return document.body.innerText.substring(0, 500);
  });
  process.stdout.write('Page content (first 500 chars): ' + bodyText.substring(0, 300) + '\n');

  // Report console errors
  process.stdout.write('Console errors captured: ' + errors.length + '\n');
  if (errors.length > 0) {
    errors.forEach(function(e) { process.stdout.write('  ERROR: ' + e + '\n'); });
  }

  // Take final screenshot
  await page.screenshot({ path: '/mnt/c/Users/turke/worldview/tmp_screenshot2.png', fullPage: true });
  process.stdout.write('Final screenshot saved\n');

  await browser.close();
})();
