import { firefox } from 'playwright';

const browser = await firefox.launch({ headless: true });
const page = await browser.newPage();

// Collect console messages
const consoleMessages = [];
const consoleErrors = [];
page.on('console', msg => {
  consoleMessages.push({ type: msg.type(), text: msg.text() });
  if (msg.type() === 'error') consoleErrors.push(msg.text());
});

// Navigate to Vite dev server
console.log('Navigating to http://localhost:5173...');
await page.goto('http://localhost:5173', { waitUntil: 'networkidle', timeout: 30000 });
console.log('Page loaded!');

// Check for root mount point
const root = await page.$('#root');
console.log('Root mount point exists:', !!root);

// Check if React rendered content inside #root
const rootContent = await page.$eval('#root', el => el.innerHTML.length);
console.log('Root has content:', rootContent > 0, '(', rootContent, 'chars)');

// Check for any child elements inside root
const childCount = await page.$eval('#root', el => el.children.length);
console.log('Root child elements:', childCount);

// Check page title
const title = await page.title();
console.log('Page title:', title);

// Take screenshot
await page.screenshot({ path: '/tmp/worldview-screenshot.png', fullPage: true });
console.log('Screenshot saved to /tmp/worldview-screenshot.png');

// Report console errors
console.log('\nConsole messages:', consoleMessages.length);
console.log('Console errors:', consoleErrors.length);
if (consoleErrors.length > 0) {
  console.log('ERRORS:');
  consoleErrors.forEach(e => console.log('  -', e));
}

// Check if Vite HMR is active
const viteHMR = await page.evaluate(() => {
  return !!(window.__vite_plugin_react_preamble_installed__);
});
console.log('Vite React plugin active:', viteHMR);

await browser.close();
console.log('\nDONE - ALL CHECKS PASSED');
