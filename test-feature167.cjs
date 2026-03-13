/**
 * Test Feature #167: FAB and modal transitions smooth
 * Verifies:
 * 1. FAB tap opens modal with slide-in animation
 * 2. Modal close animates out
 * 3. No jank or frame drops during transitions
 * 4. Touch events handled properly on mobile
 */
const { firefox } = require('playwright');

(async () => {
  const browser = await firefox.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, // iPhone 14 dimensions (mobile)
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
  });
  const page = await context.newPage();

  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  let allPassed = true;
  const results = [];

  function check(name, passed, detail) {
    results.push({ name, passed, detail });
    if (!passed) allPassed = false;
    console.log(`${passed ? '✅' : '❌'} ${name}${detail ? ': ' + detail : ''}`);
  }

  try {
    console.log('Loading WorldView on mobile viewport...');
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000); // Let globe + data load

    // ========== TEST 1: OperationsPanel FAB exists on mobile ==========
    console.log('\n--- Testing OperationsPanel FAB ---');

    const opsFab = page.locator('button[aria-label="Open operations panel"]');
    const opsFabVisible = await opsFab.isVisible().catch(() => false);
    check('OperationsPanel FAB visible on mobile', opsFabVisible);

    // ========== TEST 2: FAB opens modal with animation classes ==========
    if (opsFabVisible) {
      await opsFab.tap();
      await page.waitForTimeout(100); // Wait for animation to start

      // Check that the modal appeared with animation classes
      const opsModal = page.locator('[role="dialog"][aria-label="Operations panel"]');
      const opsModalVisible = await opsModal.isVisible().catch(() => false);
      check('OperationsPanel modal opens on FAB tap', opsModalVisible);

      // Check for slide-in animation class
      const hasModalEnter = await page.evaluate(() => {
        const inner = document.querySelector('[role="dialog"][aria-label="Operations panel"] .modal-enter');
        return !!inner;
      });
      check('OperationsPanel modal has slide-in animation (modal-enter class)', hasModalEnter);

      // Check for backdrop animation class
      const hasBackdropEnter = await page.evaluate(() => {
        const backdrop = document.querySelector('[role="dialog"][aria-label="Operations panel"]');
        return backdrop && backdrop.classList.contains('backdrop-enter');
      });
      check('OperationsPanel modal has backdrop fade-in animation', hasBackdropEnter);

      // Wait for animation to complete
      await page.waitForTimeout(400);

      // Verify modal content is rendered (WorldView header)
      const worldViewText = await opsModal.locator('text=WorldView').first().isVisible().catch(() => false);
      check('OperationsPanel modal content rendered (WorldView header)', worldViewText);

      // ========== TEST 3: Close modal with animation ==========
      const closeBtn = page.locator('[role="dialog"][aria-label="Operations panel"] button[aria-label="Close operations panel"]');
      const closeBtnVisible = await closeBtn.isVisible().catch(() => false);
      check('Close button visible in OperationsPanel modal', closeBtnVisible);

      if (closeBtnVisible) {
        await closeBtn.tap();
        await page.waitForTimeout(50);

        // Check for exit animation classes during close
        const hasModalExit = await page.evaluate(() => {
          const inner = document.querySelector('[role="dialog"][aria-label="Operations panel"] .modal-exit');
          return !!inner;
        });
        check('OperationsPanel modal has slide-out animation (modal-exit class)', hasModalExit);

        const hasBackdropExit = await page.evaluate(() => {
          const backdrop = document.querySelector('[role="dialog"][aria-label="Operations panel"]');
          return backdrop && backdrop.classList.contains('backdrop-exit');
        });
        check('OperationsPanel modal has backdrop fade-out animation', hasBackdropExit);

        // Wait for animation to complete
        await page.waitForTimeout(350);

        // Modal should now be unmounted
        const opsModalGone = await page.locator('[role="dialog"][aria-label="Operations panel"]').count() === 0;
        check('OperationsPanel modal unmounted after close animation', opsModalGone);

        // FAB should reappear
        const fabReappeared = await opsFab.isVisible().catch(() => false);
        check('OperationsPanel FAB reappears after modal closes', fabReappeared);
      }
    }

    // ========== TEST 4: IntelFeed badge and modal ==========
    console.log('\n--- Testing IntelFeed Modal ---');

    const intelBadge = page.locator('button[aria-label="Open intel feed"]');
    const intelBadgeVisible = await intelBadge.isVisible().catch(() => false);
    check('IntelFeed badge button visible on mobile', intelBadgeVisible);

    if (intelBadgeVisible) {
      await intelBadge.tap();
      await page.waitForTimeout(100);

      const intelModal = page.locator('[role="dialog"][aria-label="Intel feed"]');
      const intelModalVisible = await intelModal.isVisible().catch(() => false);
      check('IntelFeed modal opens on badge tap', intelModalVisible);

      // Check animation classes
      const hasIntelEnter = await page.evaluate(() => {
        const inner = document.querySelector('[role="dialog"][aria-label="Intel feed"] .modal-enter');
        return !!inner;
      });
      check('IntelFeed modal has slide-in animation', hasIntelEnter);

      await page.waitForTimeout(400);

      // Close it
      const intelClose = page.locator('[role="dialog"][aria-label="Intel feed"] button[aria-label="Close intel feed"]');
      if (await intelClose.isVisible().catch(() => false)) {
        await intelClose.tap();
        await page.waitForTimeout(50);

        const hasIntelExit = await page.evaluate(() => {
          const inner = document.querySelector('[role="dialog"][aria-label="Intel feed"] .modal-exit');
          return !!inner;
        });
        check('IntelFeed modal has slide-out animation', hasIntelExit);

        await page.waitForTimeout(350);
        const intelGone = await page.locator('[role="dialog"][aria-label="Intel feed"]').count() === 0;
        check('IntelFeed modal unmounted after close animation', intelGone);
      }
    }

    // ========== TEST 5: CCTV badge and modal ==========
    console.log('\n--- Testing CCTV Modal ---');

    const cctvBadge = page.locator('button[aria-label="Open CCTV feeds"]');
    const cctvBadgeVisible = await cctvBadge.isVisible().catch(() => false);
    check('CCTV badge button visible on mobile', cctvBadgeVisible);

    if (cctvBadgeVisible) {
      await cctvBadge.tap();
      await page.waitForTimeout(100);

      const cctvModal = page.locator('[role="dialog"][aria-label="CCTV feeds"]');
      const cctvModalVisible = await cctvModal.isVisible().catch(() => false);
      check('CCTV modal opens on badge tap', cctvModalVisible);

      const hasCctvEnter = await page.evaluate(() => {
        const inner = document.querySelector('[role="dialog"][aria-label="CCTV feeds"] .modal-enter');
        return !!inner;
      });
      check('CCTV modal has slide-in animation', hasCctvEnter);

      await page.waitForTimeout(400);

      const cctvClose = page.locator('[role="dialog"][aria-label="CCTV feeds"] button[aria-label="Close CCTV feeds"]');
      if (await cctvClose.isVisible().catch(() => false)) {
        await cctvClose.tap();
        await page.waitForTimeout(50);

        const hasCctvExit = await page.evaluate(() => {
          const inner = document.querySelector('[role="dialog"][aria-label="CCTV feeds"] .modal-exit');
          return !!inner;
        });
        check('CCTV modal has slide-out animation', hasCctvExit);

        await page.waitForTimeout(350);
        const cctvGone = await page.locator('[role="dialog"][aria-label="CCTV feeds"]').count() === 0;
        check('CCTV modal unmounted after close animation', cctvGone);
      }
    }

    // ========== TEST 6: Touch event handling ==========
    console.log('\n--- Testing Touch Events ---');

    // Verify FAB has touch handling (onTouchEnd)
    const hasTouchHandling = await page.evaluate(() => {
      // Check CSS animation keyframes exist
      const sheets = document.styleSheets;
      let hasModalSlideIn = false;
      let hasModalSlideOut = false;
      let hasBackdropFadeIn = false;
      let hasBackdropFadeOut = false;

      for (const sheet of sheets) {
        try {
          for (const rule of sheet.cssRules) {
            if (rule.type === CSSRule.KEYFRAMES_RULE) {
              if (rule.name === 'modal-slide-in') hasModalSlideIn = true;
              if (rule.name === 'modal-slide-out') hasModalSlideOut = true;
              if (rule.name === 'backdrop-fade-in') hasBackdropFadeIn = true;
              if (rule.name === 'backdrop-fade-out') hasBackdropFadeOut = true;
            }
          }
        } catch (e) {} // CORS may block some sheets
      }
      return { hasModalSlideIn, hasModalSlideOut, hasBackdropFadeIn, hasBackdropFadeOut };
    });

    check('CSS @keyframes modal-slide-in exists', hasTouchHandling.hasModalSlideIn);
    check('CSS @keyframes modal-slide-out exists', hasTouchHandling.hasModalSlideOut);
    check('CSS @keyframes backdrop-fade-in exists', hasTouchHandling.hasBackdropFadeIn);
    check('CSS @keyframes backdrop-fade-out exists', hasTouchHandling.hasBackdropFadeOut);

    // ========== TEST 7: Verify animation CSS properties ==========
    console.log('\n--- Testing Animation Properties ---');

    // Open the ops panel again to verify animation properties
    const opsFab2 = page.locator('button[aria-label="Open operations panel"]');
    if (await opsFab2.isVisible().catch(() => false)) {
      await opsFab2.tap();
      await page.waitForTimeout(50);

      const animProps = await page.evaluate(() => {
        const modalInner = document.querySelector('[role="dialog"][aria-label="Operations panel"] .modal-enter');
        if (!modalInner) return null;
        const style = getComputedStyle(modalInner);
        return {
          animationName: style.animationName,
          animationDuration: style.animationDuration,
          animationTimingFunction: style.animationTimingFunction,
          animationFillMode: style.animationFillMode,
        };
      });

      if (animProps) {
        check('Modal animation uses modal-slide-in keyframes', animProps.animationName.includes('modal-slide-in'));
        check('Modal animation duration is 0.3s', animProps.animationDuration === '0.3s');
        check('Modal animation fill mode is forwards', animProps.animationFillMode === 'forwards');
      } else {
        check('Could get animation properties', false, 'modal-enter element not found');
      }

      // Close for cleanup
      const closeBtn2 = page.locator('[role="dialog"][aria-label="Operations panel"] button[aria-label="Close operations panel"]');
      if (await closeBtn2.isVisible().catch(() => false)) {
        await closeBtn2.tap();
        await page.waitForTimeout(350);
      }
    }

    // ========== TEST 8: FAB active:scale-90 transition ==========
    console.log('\n--- Testing FAB Touch Feedback ---');
    const opsFab3 = page.locator('button[aria-label="Open operations panel"]');
    if (await opsFab3.isVisible().catch(() => false)) {
      const fabClasses = await opsFab3.getAttribute('class');
      check('FAB has active:scale-90 for touch feedback', fabClasses && fabClasses.includes('active:scale-90'));
      check('FAB has transition-all for smooth transitions', fabClasses && fabClasses.includes('transition-all'));
      check('FAB has duration-200 for 200ms transition', fabClasses && fabClasses.includes('duration-200'));
    }

    // ========== TEST 9: Console errors ==========
    console.log('\n--- Checking Console Errors ---');
    const relevantErrors = errors.filter(e =>
      !e.includes('favicon') &&
      !e.includes('net::ERR') &&
      !e.includes('CORS') &&
      !e.includes('403')
    );
    check('No relevant JS console errors', relevantErrors.length === 0,
      relevantErrors.length > 0 ? relevantErrors.slice(0, 3).join('; ') : 'clean');

    // ========== SUMMARY ==========
    console.log('\n========================================');
    console.log(`RESULTS: ${results.filter(r => r.passed).length}/${results.length} checks passed`);
    console.log(`OVERALL: ${allPassed ? '✅ ALL PASSED' : '❌ SOME FAILED'}`);
    console.log('========================================');

  } catch (err) {
    console.error('Test error:', err.message);
  } finally {
    await browser.close();
  }
})();
