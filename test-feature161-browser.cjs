// Browser test for Feature #161: Mobile CCTVPanel
// Uses Playwright headless to test mobile viewport behavior

const { chromium } = require('playwright');

(async () => {
  let browser;
  try {
    browser = await chromium.launch({ headless: true });

    // Test 1: Desktop viewport - no mobile button visible
    const desktopPage = await browser.newPage();
    await desktopPage.setViewportSize({ width: 1280, height: 800 });
    await desktopPage.goto('http://localhost:5173', { waitUntil: 'networkidle', timeout: 30000 });
    await desktopPage.waitForTimeout(3000);

    // Desktop: the mobile badge button should be hidden (lg:hidden)
    const mobileBtnDesktop = await desktopPage.$('button.lg\\:hidden');
    const mobileBtnVisible = mobileBtnDesktop ? await mobileBtnDesktop.isVisible() : false;
    console.log('Desktop: mobile badge button hidden:', !mobileBtnVisible ? 'PASS' : 'FAIL');

    // Desktop: the fixed panel should be visible (hidden lg:flex)
    const desktopPanel = await desktopPage.$('.hidden.lg\\:flex');
    const panelVisible = desktopPanel ? await desktopPanel.isVisible() : false;
    console.log('Desktop: CCTV panel visible:', panelVisible ? 'PASS' : 'FAIL');

    await desktopPage.close();

    // Test 2: Mobile viewport
    const mobilePage = await browser.newPage();
    await mobilePage.setViewportSize({ width: 375, height: 812 }); // iPhone-like
    await mobilePage.goto('http://localhost:5173', { waitUntil: 'networkidle', timeout: 30000 });
    await mobilePage.waitForTimeout(3000);

    // Mobile: badge button should be visible
    const mobileBtnMobile = await mobilePage.$('button.lg\\:hidden');
    const mobileBtnVisibleMobile = mobileBtnMobile ? await mobileBtnMobile.isVisible() : false;
    console.log('Mobile: badge button visible:', mobileBtnVisibleMobile ? 'PASS' : 'FAIL');

    // Mobile: desktop panel should be hidden
    const desktopPanelMobile = await mobilePage.$('.hidden.lg\\:flex');
    const panelVisibleMobile = desktopPanelMobile ? await desktopPanelMobile.isVisible() : false;
    console.log('Mobile: desktop panel hidden:', !panelVisibleMobile ? 'PASS' : 'FAIL');

    // Click badge button to open modal
    if (mobileBtnVisibleMobile) {
      await mobileBtnMobile.click();
      await mobilePage.waitForTimeout(500);

      // Check modal appeared
      const modal = await mobilePage.$('.fixed.inset-0');
      const modalVisible = modal ? await modal.isVisible() : false;
      console.log('Mobile: modal opens on tap:', modalVisible ? 'PASS' : 'FAIL');

      // Check 2-column grid in modal
      const grid2col = await mobilePage.$('.grid.grid-cols-2');
      const grid2visible = grid2col ? await grid2col.isVisible() : false;
      console.log('Mobile: 2-column grid in modal:', grid2visible ? 'PASS' : 'FAIL');

      // Check close button
      const closeBtn = await mobilePage.$('.fixed.inset-0 button');
      if (closeBtn) {
        await closeBtn.click();
        await mobilePage.waitForTimeout(300);
        const modalAfterClose = await mobilePage.$('.fixed.inset-0.lg\\:hidden');
        const stillVisible = modalAfterClose ? await modalAfterClose.isVisible() : false;
        console.log('Mobile: modal dismissible:', !stillVisible ? 'PASS' : 'FAIL');
      }
    }

    // Check console errors
    const errors = [];
    mobilePage.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await mobilePage.waitForTimeout(1000);
    console.log('Console errors:', errors.length === 0 ? 'NONE (PASS)' : errors.length + ' errors');

    await mobilePage.close();
    console.log('\nBROWSER TESTS COMPLETE');
  } catch(e) {
    console.log('Browser test error:', e.message);
  } finally {
    if (browser) await browser.close();
  }
})();
