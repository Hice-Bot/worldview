const { chromium } = require('playwright');

async function main() {
  try {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    const errors = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });

    await page.goto('http://localhost:5173', { timeout: 15000 });
    const title = await page.title();
    console.log('Page title:', title);

    await page.waitForTimeout(5000);

    await page.screenshot({ path: '/mnt/c/Users/turke/worldview/.playwright-cli/dr-test.png' });
    console.log('Screenshot saved to .playwright-cli/dr-test.png');
    console.log('Console errors:', errors.length);
    if (errors.length > 0) {
      errors.slice(0, 5).forEach(e => console.log('  ERROR:', e.substring(0, 200)));
    }

    await browser.close();
    console.log('Browser test complete');
  } catch (e) {
    console.error('Error:', e.message);
  }
}

main();
