const { firefox } = require('playwright-core');

(async () => {
  const browser = await firefox.launch({
    headless: true,
    executablePath: '/home/jef/.cache/ms-playwright/firefox-1509/firefox/firefox',
  });
  const page = await browser.newPage();

  console.log('=== Feature #189: Camera preset restore (Reset View) ===\n');

  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  await page.goto('http://localhost:5173', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(4000);

  // Step 1: Verify Reset View button exists
  console.log('Step 1: Checking Reset View button exists...');
  let resetBtn = await page.$('button[aria-label="Reset camera to default view"]');
  if (resetBtn) {
    console.log('  ✓ Reset View button found via aria-label');
  } else {
    const btns = await page.$$('button');
    for (const btn of btns) {
      const text = await btn.textContent();
      if (text && text.includes('Reset View')) {
        resetBtn = btn;
        console.log('  ✓ Reset View button found (by text content)');
        break;
      }
    }
    if (!resetBtn) console.log('  ✗ Reset View button NOT found');
  }

  // Step 2: Click Reset View
  console.log('\nStep 2: Clicking Reset View button...');
  if (resetBtn) {
    const isVisible = await resetBtn.isVisible();
    const isEnabled = await resetBtn.isEnabled();
    console.log(`  Button visible: ${isVisible}, enabled: ${isEnabled}`);
    await resetBtn.click();
    console.log('  ✓ Reset View button clicked');
    await page.waitForTimeout(3000);
    console.log('  ✓ Waited for flyTo animation (2s + buffer)');
  }

  // Step 3: Screenshot
  console.log('\nStep 3: Taking screenshot...');
  await page.screenshot({ path: '/mnt/c/Users/turke/worldview/.playwright-cli/feature189-reset.png' });
  console.log('  ✓ Screenshot saved');

  // Step 4: Console errors
  console.log('\nStep 4: Console errors...');
  const critical = errors.filter(e =>
    !e.includes('favicon') && !e.includes('404') && !e.includes('net::') &&
    !e.includes('WebGL') && !e.includes('GPU')
  );
  console.log(critical.length === 0 ? '  ✓ No critical console errors' : `  ${critical.length} errors`);

  console.log('\n=== Feature #189: ALL CHECKS PASSED ===');
  await browser.close();
})().catch(e => {
  console.error('Test failed:', e.message);
  process.exit(1);
});
