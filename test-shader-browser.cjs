const { chromium } = require('playwright');

async function main() {
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    // Collect console errors
    const errors = [];
    page.on('console', msg => { if(msg.type() === 'error') errors.push(msg.text()); });

    await page.goto('http://localhost:5173', { timeout: 20000 });
    console.log('Page loaded, title:', await page.title());

    // Wait for React to render
    await page.waitForTimeout(4000);

    // Take initial screenshot
    await page.screenshot({ path: '/mnt/c/Users/turke/worldview/test-shader-standard.png' });
    console.log('Screenshot: STANDARD mode saved');

    // Check for shader buttons
    const bodyHTML = await page.locator('body').innerHTML();
    console.log('Has CRT button:', bodyHTML.includes('CRT'));
    console.log('Has NVG button:', bodyHTML.includes('NVG'));
    console.log('Has FLIR button:', bodyHTML.includes('FLIR'));
    console.log('Has STANDARD button:', bodyHTML.includes('STANDARD'));

    // Click CRT button
    const crtButton = page.locator('button:has-text("CRT")').first();
    if (await crtButton.isVisible()) {
      await crtButton.click();
      console.log('Clicked CRT button');
      await page.waitForTimeout(2000);
      await page.screenshot({ path: '/mnt/c/Users/turke/worldview/test-shader-crt.png' });
      console.log('Screenshot: CRT mode saved');
    } else {
      console.log('CRT button not visible');
    }

    // Click NVG button
    const nvgButton = page.locator('button:has-text("NVG")').first();
    if (await nvgButton.isVisible()) {
      await nvgButton.click();
      console.log('Clicked NVG button');
      await page.waitForTimeout(2000);
      await page.screenshot({ path: '/mnt/c/Users/turke/worldview/test-shader-nvg.png' });
      console.log('Screenshot: NVG mode saved');
    } else {
      console.log('NVG button not visible');
    }

    // Click FLIR button
    const flirButton = page.locator('button:has-text("FLIR")').first();
    if (await flirButton.isVisible()) {
      await flirButton.click();
      console.log('Clicked FLIR button');
      await page.waitForTimeout(2000);
      await page.screenshot({ path: '/mnt/c/Users/turke/worldview/test-shader-flir.png' });
      console.log('Screenshot: FLIR mode saved');
    } else {
      console.log('FLIR button not visible');
    }

    // Click STANDARD to verify cleanup
    const stdButton = page.locator('button:has-text("STANDARD")').first();
    if (await stdButton.isVisible()) {
      await stdButton.click();
      console.log('Clicked STANDARD button');
      await page.waitForTimeout(2000);
      await page.screenshot({ path: '/mnt/c/Users/turke/worldview/test-shader-back-to-standard.png' });
      console.log('Screenshot: back to STANDARD mode saved');
    }

    // Report console errors
    if (errors.length > 0) {
      console.log('\nConsole errors found:');
      errors.forEach(e => console.log('  ERROR:', e));
    } else {
      console.log('\nNo console errors detected');
    }

    console.log('\nAll shader mode switching tests complete!');
  } catch(err) {
    console.error('Test failed:', err.message);
  } finally {
    if (browser) await browser.close();
  }
}

main();
