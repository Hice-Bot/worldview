const { chromium } = require('playwright');

async function testFeature2() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Collect console errors
  const consoleErrors = [];
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });

  await page.goto('http://localhost:5173', { waitUntil: 'networkidle', timeout: 30000 });

  // Check title
  const title = await page.title();
  console.log('Title:', title);

  // Check if root div has content (React mounted)
  const rootContent = await page.evaluate(() => {
    const root = document.getElementById('root');
    return {
      exists: !!root,
      childCount: root ? root.children.length : 0,
      innerHTML: root ? root.innerHTML.substring(0, 500) : 'N/A'
    };
  });
  console.log('Root element exists:', rootContent.exists);
  console.log('Root child count:', rootContent.childCount);
  console.log('Root innerHTML preview:', rootContent.innerHTML);

  // Check Vite HMR
  const hasViteClient = await page.evaluate(() => {
    const scripts = Array.from(document.querySelectorAll('script'));
    return scripts.some(s => s.src && s.src.includes('@vite/client'));
  });
  console.log('Vite HMR active:', hasViteClient);

  // Wait a bit more for any late errors
  await page.waitForTimeout(3000);

  // Take screenshot
  await page.screenshot({ path: '/mnt/c/Users/turke/worldview/.playwright-cli/feature2-test.png', fullPage: true });
  console.log('Screenshot saved to .playwright-cli/feature2-test.png');

  console.log('Console errors:', consoleErrors.length > 0 ? JSON.stringify(consoleErrors, null, 2) : 'None');

  await browser.close();

  // Determine pass/fail
  const pass = rootContent.exists && rootContent.childCount > 0;
  console.log('\nFEATURE 2 RESULT:', pass ? 'PASS' : 'FAIL');
  process.exit(pass ? 0 : 1);
}

testFeature2().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
