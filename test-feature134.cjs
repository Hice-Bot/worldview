/**
 * Test Feature #134: Satellite category filters default state
 * Verifies ISS and Other satellite categories start enabled
 */
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: '/home/jef/.cache/ms-playwright/chromium-1212/chrome-linux64/chrome',
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  try {
    console.log('=== Feature #134: Satellite category filters default state ===\n');

    // Navigate to app
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);

    // Step 1: Check that the OperationsPanel exists
    const panel = await page.$('.fixed.left-0.top-0');
    console.log('1. OperationsPanel found:', !!panel);

    // Step 2: Enable satellites layer by clicking the Satellites toggle button
    const satButton = await page.locator('button:has-text("Satellites")').first();
    console.log('2. Satellites toggle found:', await satButton.count() > 0);
    await satButton.click();
    await page.waitForTimeout(1000);

    // Step 3: Check satellite filter section appears
    const filterSection = await page.locator('text=Satellite Filters').first();
    console.log('3. Satellite Filters section visible:', await filterSection.isVisible());

    // Step 4: Check ISS button - should be active (highlighted) by default
    const issButton = await page.locator('button:has-text("ISS")').first();
    const issClasses = await issButton.getAttribute('class');
    const issActive = issClasses.includes('yellow-500') || issClasses.includes('yellow-400');
    console.log('4. ISS filter enabled by default:', issActive);
    console.log('   ISS button classes (first 120):', issClasses.substring(0, 120));

    // Step 5: Check Other button - should be active (highlighted) by default
    const otherButton = await page.locator('button:has-text("Other")').first();
    const otherClasses = await otherButton.getAttribute('class');
    const otherActive = otherClasses.includes('green-500') || otherClasses.includes('green-400');
    console.log('5. Other filter enabled by default:', otherActive);
    console.log('   Other button classes (first 120):', otherClasses.substring(0, 120));

    // Step 6: Take screenshot
    await page.screenshot({ path: '.playwright-cli/feature134.png' });
    console.log('6. Screenshot saved to .playwright-cli/feature134.png');

    // Step 7: Verify all three substeps
    const allPassing = issActive && otherActive;
    console.log('\n=== RESULT ===');
    console.log('ISS category enabled by default:', issActive ? 'PASS' : 'FAIL');
    console.log('Other category enabled by default:', otherActive ? 'PASS' : 'FAIL');
    console.log('All satellite types visible on load:', allPassing ? 'PASS' : 'FAIL');
    console.log('Overall:', allPassing ? 'PASS' : 'FAIL');

  } catch (err) {
    console.error('Test error:', err.message);
  } finally {
    await browser.close();
  }
})();
