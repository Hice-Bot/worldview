import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

// Navigate to the app
await page.goto('http://localhost:5173', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(5000);

// Take screenshot
await page.screenshot({ path: '/mnt/c/Users/turke/worldview/.test-screenshot-1.png', fullPage: false });

// Check console errors
const consoleErrors = [];
page.on('console', msg => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
});

// Check health endpoint via fetch in browser context
const healthResponse = await page.evaluate(async () => {
  try {
    const res = await fetch('/api/health');
    return { status: res.status, body: await res.json() };
  } catch (e) {
    return { error: e.message };
  }
});

// Check earthquakes endpoint
const eqResponse = await page.evaluate(async () => {
  try {
    const res = await fetch('/api/earthquakes');
    const data = await res.json();
    return {
      status: res.status,
      type: data.type,
      featureCount: data.features?.length,
      firstFeature: data.features?.[0]?.properties?.place
    };
  } catch (e) {
    return { error: e.message };
  }
});

// Take another screenshot after loading
await page.waitForTimeout(3000);
await page.screenshot({ path: '/mnt/c/Users/turke/worldview/.test-screenshot-2.png', fullPage: false });

// Output results
const results = {
  healthEndpoint: healthResponse,
  earthquakeEndpoint: eqResponse,
  consoleErrors: consoleErrors
};

process.stdout.write(JSON.stringify(results, null, 2));

await browser.close();
