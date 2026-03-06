const { chromium } = require('playwright');

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle', timeout: 30000 });

  // Check page title and content
  const title = await page.title();
  console.log('Page title:', title);

  // Look for login/auth elements
  const loginElements = await page.locator('input[type=password], form[action*=login], [class*=login], [id*=login], [class*=auth], [id*=auth]').count();
  console.log('Login/auth elements found:', loginElements);

  // Check for any modal/overlay that might be a login
  const modals = await page.locator('[role=dialog], .modal, [class*=modal]').count();
  console.log('Modal elements found:', modals);

  // Get visible text to check for login prompts
  const bodyText = await page.locator('body').innerText();
  const hasLoginText = /login|sign in|sign up|password|username|register|authenticate/i.test(bodyText);
  console.log('Login-related text found:', hasLoginText);

  // Check that the app content is visible (WorldView or globe elements)
  const hasAppContent = await page.locator('#root').count();
  console.log('React root element:', hasAppContent > 0 ? 'present' : 'missing');

  // Check for WorldView UI elements (OperationsPanel, StatusBar, etc)
  const hasWorldView = bodyText.includes('WorldView') || bodyText.includes('WORLDVIEW');
  console.log('WorldView branding found:', hasWorldView);

  // Take a screenshot
  await page.screenshot({ path: '.playwright-cli/feature12-no-login.png' });
  console.log('Screenshot saved to .playwright-cli/feature12-no-login.png');

  await browser.close();

  const pass = loginElements === 0 && !hasLoginText;
  console.log('RESULT: App loads without login screen -', pass ? 'PASS' : 'FAIL');
  process.exit(pass ? 0 : 1);
}

main().catch(e => { console.error(e.message); process.exit(1); });
