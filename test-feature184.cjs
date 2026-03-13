const { firefox } = require('playwright');

async function test() {
  const browser = await firefox.launch({ headless: true });
  const page = await browser.newPage();

  // Track JS errors
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  // Track network requests for flights
  let flightRequestCount = 0;
  let flightResponseCount = 0;
  let abortedRequests = 0;

  page.on('request', req => {
    if (req.url().includes('/api/flights') && !req.url().includes('/live')) {
      flightRequestCount++;
    }
  });
  page.on('requestfinished', req => {
    if (req.url().includes('/api/flights') && !req.url().includes('/live')) {
      flightResponseCount++;
    }
  });
  page.on('requestfailed', req => {
    if (req.url().includes('/api/flights') && !req.url().includes('/live')) {
      const failure = req.failure();
      if (failure && failure.errorText.includes('aborted')) {
        abortedRequests++;
        console.log('Request properly aborted:', req.url());
      }
    }
  });

  // Navigate to the app
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle', timeout: 30000 });
  console.log('Page loaded');

  // Wait for initial render and first flight fetch
  await page.waitForTimeout(3000);
  console.log('Initial flight requests:', flightRequestCount, 'responses:', flightResponseCount);

  // Find the ACFT toggle button
  const findToggle = async () => {
    // Try various selectors
    let toggle = page.locator('button:has-text("ACFT")').first();
    if (await toggle.count() > 0) return toggle;
    toggle = page.locator('[data-layer="flights"]').first();
    if (await toggle.count() > 0) return toggle;
    toggle = page.locator('text=ACFT').first();
    if (await toggle.count() > 0) return toggle;
    // List all buttons for debugging
    const allButtons = await page.locator('button').allTextContents();
    console.log('Available buttons:', allButtons.filter(b => b.trim().length > 0 && b.length < 30).join(', '));
    return null;
  };

  const toggle = await findToggle();
  if (!toggle) {
    console.log('WARN: Could not find flights toggle button');
    await browser.close();
    return;
  }

  // TEST 1: Disable flights (may catch mid-fetch)
  console.log('\n--- TEST 1: Disable flights layer ---');
  await toggle.click();
  console.log('Flights disabled');
  await page.waitForTimeout(2000);

  const errorsAfterDisable = errors.filter(e => !e.includes('favicon') && !e.includes('404'));
  console.log('JS errors after disable:', errorsAfterDisable.length);
  if (errorsAfterDisable.length > 0) console.log('Errors:', errorsAfterDisable);

  // TEST 2: Re-enable and quickly disable to catch mid-fetch
  console.log('\n--- TEST 2: Enable then immediately disable (race condition test) ---');
  await toggle.click(); // Enable
  console.log('Flights enabled - fetch starting...');
  // Immediately disable to catch the fetch in-flight
  await page.waitForTimeout(100); // Small delay to ensure fetch starts
  await toggle.click(); // Disable during fetch
  console.log('Flights disabled during fetch');
  await page.waitForTimeout(3000);

  const errorsAfterRace = errors.filter(e => !e.includes('favicon') && !e.includes('404'));
  console.log('JS errors after race condition:', errorsAfterRace.length);
  if (errorsAfterRace.length > 0) console.log('Errors:', errorsAfterRace);

  // TEST 3: Rapid toggle (stress test)
  console.log('\n--- TEST 3: Rapid toggle stress test ---');
  for (let i = 0; i < 5; i++) {
    await toggle.click(); // Toggle
    await page.waitForTimeout(50);
  }
  await page.waitForTimeout(3000);

  const errorsAfterStress = errors.filter(e => !e.includes('favicon') && !e.includes('404'));
  console.log('JS errors after stress test:', errorsAfterStress.length);
  if (errorsAfterStress.length > 0) console.log('Errors:', errorsAfterStress);

  // Final stats
  console.log('\n--- RESULTS ---');
  console.log('Network stats: requests=' + flightRequestCount + ', responses=' + flightResponseCount + ', aborted=' + abortedRequests);

  const allErrors = errors.filter(e => !e.includes('favicon') && !e.includes('404'));
  const passed = allErrors.length === 0;
  console.log(passed ? 'TEST PASSED: No errors during layer toggle race conditions' : 'TEST FAILED: Errors detected');

  await page.screenshot({ path: '/tmp/test-184-final.png' });
  await browser.close();
  process.exit(passed ? 0 : 1);
}

test().catch(e => {
  console.error('Test error:', e.message);
  process.exit(1);
});
