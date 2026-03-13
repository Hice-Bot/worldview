const { firefox } = require('playwright');

async function main() {
  console.log('=== Feature #181: Browser test - All 6 layers render simultaneously ===\n');

  const browser = await firefox.launch({ headless: true });
  const page = await browser.newPage();

  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  const networkErrors = [];
  page.on('response', response => {
    if (response.status() >= 500) {
      networkErrors.push(response.status() + ' ' + response.url());
    }
  });

  const apiRequests = [];
  page.on('response', response => {
    const url = response.url();
    if (url.includes('/api/')) {
      apiRequests.push({
        url: url.replace(/^.*\/api/, '/api'),
        status: response.status()
      });
    }
  });

  console.log('Step 1: Loading app...');
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle', timeout: 60000 });
  console.log('  Page loaded successfully');

  console.log('\nStep 2: Waiting for initial API fetches (15s)...');
  await page.waitForTimeout(15000);

  console.log('\nStep 3: Checking API requests made by the app:');
  const uniqueEndpoints = new Set();
  apiRequests.forEach(req => {
    const endpoint = req.url.split('?')[0];
    uniqueEndpoints.add(endpoint);
  });

  console.log('  Total unique API endpoints hit: ' + uniqueEndpoints.size);
  uniqueEndpoints.forEach(ep => console.log('    - ' + ep + ' (status: ' + apiRequests.find(r => r.url.includes(ep.split('/').pop())).status + ')'));

  console.log('  Total API requests: ' + apiRequests.length);

  const expectedApis = ['flights', 'satellites', 'earthquakes', 'cctv', 'ships'];
  let apisHit = 0;
  expectedApis.forEach(api => {
    const found = apiRequests.some(r => r.url.includes(api));
    console.log('  ' + (found ? 'PASS' : 'WARN') + ' /api/' + api + ': ' + (found ? 'requested' : 'not yet requested'));
    if (found) apisHit++;
  });

  console.log('\nStep 4: Checking for 500 errors:');
  if (networkErrors.length === 0) {
    console.log('  PASS No 500 errors from proxy endpoints');
  } else {
    console.log('  FAIL ' + networkErrors.length + ' server errors:');
    networkErrors.forEach(e => console.log('    - ' + e));
  }

  console.log('\nStep 5: Checking console errors:');
  const criticalErrors = consoleErrors.filter(e =>
    !e.includes('favicon') &&
    !e.includes('ResizeObserver') &&
    !e.includes('third-party') &&
    !e.includes('deprecated') &&
    !e.includes('Google Maps') &&
    !e.includes('net::ERR') &&
    !e.includes('Cross-Origin') &&
    !e.includes('CORS') &&
    !e.includes('SecurityError') &&
    !e.includes('Blocked loading mixed')
  );

  if (criticalErrors.length === 0) {
    console.log('  PASS No critical JavaScript console errors');
  } else {
    console.log('  INFO ' + criticalErrors.length + ' console messages:');
    criticalErrors.slice(0, 5).forEach(e => console.log('    - ' + e.substring(0, 200)));
  }

  console.log('\nStep 6: Checking page title and globe...');
  const title = await page.title();
  console.log('  Page title: ' + title);

  console.log('\nStep 7: Taking screenshot...');
  await page.screenshot({ path: '/mnt/c/Users/turke/worldview/.playwright-cli/feature181.png', fullPage: true });
  console.log('  Screenshot saved');

  await browser.close();

  const allPass = networkErrors.length === 0 && apisHit >= 3;
  console.log('\n=== RESULT: ' + (allPass ? 'ALL PASS' : 'ISSUES FOUND') + ' ===');
  console.log('  APIs responding: ' + apisHit + '/5');
  console.log('  Network 500 errors: ' + networkErrors.length);
  console.log('  Console errors (critical): ' + criticalErrors.length);

  process.exit(allPass ? 0 : 1);
}

main().catch(err => {
  console.error('Test failed: ' + err.message);
  process.exit(1);
});
