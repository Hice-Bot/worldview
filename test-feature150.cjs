const { chromium } = require('playwright');

async function testFeature150() {
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle', timeout: 30000 });

    // Wait for boot sequence + flight data to load
    console.log('Waiting for app boot and flight data...');
    await page.waitForTimeout(8000);

    // Check for ACFT events in the Intel Feed
    const acftEvents = await page.evaluate(() => {
      const spans = Array.from(document.querySelectorAll('span'));
      const acftBadges = spans.filter(s => s.textContent && s.textContent.includes('[ACFT]'));
      return acftBadges.map(s => {
        const parent = s.closest('div');
        return parent ? parent.textContent : '';
      });
    });

    console.log('ACFT events found after initial load:', acftEvents.length);
    acftEvents.forEach((e, i) => console.log('  ACFT event ' + i + ':', e));

    // Wait for more flight data refreshes (to trigger count changes)
    console.log('\nWaiting 25s for flight data refresh cycles...');
    await page.waitForTimeout(25000);

    const acftEventsAfter = await page.evaluate(() => {
      const spans = Array.from(document.querySelectorAll('span'));
      const acftBadges = spans.filter(s => s.textContent && s.textContent.includes('[ACFT]'));
      return acftBadges.map(s => {
        const parent = s.closest('div');
        return parent ? parent.textContent : '';
      });
    });

    console.log('ACFT events after refresh:', acftEventsAfter.length);
    acftEventsAfter.forEach((e, i) => console.log('  ACFT event ' + i + ':', e));

    // Verify format: HH:MM:SS | [ACFT] | message
    const formatOk = acftEventsAfter.some(e => {
      // Check for time | [ACFT] | message format
      const match = e.match(/\d{2}:\d{2}:\d{2}\s*\|\s*\[ACFT\]\s*\|/);
      return match !== null;
    });
    console.log('\nFormat HH:MM:SS | [ACFT] | message:', formatOk ? 'PASS' : 'FAIL');

    // Verify event shows aircraft count
    const hasCount = acftEventsAfter.some(e => /\d+.*AIRCRAFT/.test(e));
    console.log('Event shows aircraft count:', hasCount ? 'PASS' : 'FAIL');

    // Verify initial tracking event exists
    const hasTracking = acftEventsAfter.some(e => /TRACKING.*AIRCRAFT/.test(e));
    console.log('Initial TRACKING event exists:', hasTracking ? 'PASS' : 'FAIL');

    // Take screenshot
    await page.screenshot({ path: '.playwright-cli/feature150-test.png', fullPage: false });
    console.log('\nScreenshot saved to .playwright-cli/feature150-test.png');

    // Overall verdict
    const pass = acftEventsAfter.length > 0 && formatOk && hasCount;
    console.log('\n=== Feature #150 Overall:', pass ? 'PASS' : 'NEEDS MORE VERIFICATION');

    await browser.close();
  } catch (err) {
    console.error('Test error:', err.message);
    if (browser) await browser.close();
  }
}

testFeature150();
