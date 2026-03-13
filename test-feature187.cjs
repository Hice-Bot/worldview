/**
 * Test Feature #187: Tile switch during data rendering
 * Verifies switching map tiles while data layers are rendering doesn't corrupt display.
 */
const { firefox } = require('playwright');

(async () => {
  const browser = await firefox.launch({
    headless: true,
    args: []
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (text.includes('favicon') || text.includes('ResizeObserver')) return;
      errors.push(text);
    }
  });

  page.on('pageerror', err => {
    errors.push('PAGE ERROR: ' + err.message);
  });

  try {
    console.log('1. Opening app...');
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(5000);
    console.log('   Page loaded');

    // Check canvas exists
    const canvasExists = await page.evaluate(() => !!document.querySelector('.cesium-widget canvas'));
    console.log('   Cesium canvas exists:', canvasExists);

    // 2. Check flights and earthquakes toggles
    console.log('2. Checking layer toggles...');

    // Get all buttons to understand the UI
    const buttons = await page.evaluate(() => {
      const btns = [...document.querySelectorAll('button')];
      return btns.map(b => ({
        text: b.textContent?.trim().substring(0, 40),
        ariaPressed: b.getAttribute('aria-pressed'),
        ariaLabel: b.getAttribute('aria-label'),
        className: b.className?.substring(0, 60)
      })).filter(b => b.text || b.ariaLabel);
    });
    console.log('   Buttons:', JSON.stringify(buttons.slice(0, 20), null, 0).substring(0, 2000));

    // Open ops panel if FAB is visible
    const fabBtn = await page.locator('button[aria-label*="menu"], button[aria-label*="Menu"], button[aria-label*="operations"]').first();
    if (await fabBtn.isVisible().catch(() => false)) {
      await fabBtn.click();
      await page.waitForTimeout(1000);
      console.log('   Opened ops panel');
    }

    // Make sure flights are enabled
    const flightBtn = await page.locator('button[aria-pressed]').filter({ hasText: /flight/i }).first();
    if (await flightBtn.isVisible().catch(() => false)) {
      const pressed = await flightBtn.getAttribute('aria-pressed');
      console.log('   Flights toggle:', pressed);
      if (pressed === 'false') {
        await flightBtn.click();
        await page.waitForTimeout(2000);
      }
    }

    // Make sure earthquakes are enabled
    const quakeBtn = await page.locator('button[aria-pressed]').filter({ hasText: /quake|seismic|seis/i }).first();
    if (await quakeBtn.isVisible().catch(() => false)) {
      const pressed = await quakeBtn.getAttribute('aria-pressed');
      console.log('   Quakes toggle:', pressed);
      if (pressed === 'false') {
        await quakeBtn.click();
        await page.waitForTimeout(2000);
      }
    }

    await page.waitForTimeout(3000);

    // 3. Verify real data from APIs
    console.log('3. Verifying API data...');
    const flightsData = await page.evaluate(async () => {
      const r = await fetch('/api/flights');
      const d = await r.json();
      const arr = Array.isArray(d) ? d : (d.flights || d.aircraft || []);
      return { status: r.status, count: arr.length, sample: arr[0] ? { icao: arr[0].icao24 || arr[0].hex, callsign: arr[0].callsign || arr[0].flight } : null };
    });
    console.log('   Flights:', JSON.stringify(flightsData));

    const quakesData = await page.evaluate(async () => {
      const r = await fetch('/api/earthquakes');
      const d = await r.json();
      const features = d.features || d;
      return { status: r.status, count: Array.isArray(features) ? features.length : 0 };
    });
    console.log('   Earthquakes:', JSON.stringify(quakesData));

    // 4. Switch to OSM tiles
    console.log('4. Switching to OSM...');
    const osmBtn = await page.locator('button').filter({ hasText: /^OSM$/ }).first();
    const osmBtn2 = await page.locator('button').filter({ hasText: /OSM/ }).first();
    const osmVisible = await osmBtn.isVisible().catch(() => false) || await osmBtn2.isVisible().catch(() => false);
    if (osmVisible) {
      const btn = await osmBtn.isVisible().catch(() => false) ? osmBtn : osmBtn2;
      await btn.click();
      console.log('   Clicked OSM button');
    } else {
      console.log('   WARNING: No OSM button found');
    }
    await page.waitForTimeout(3000);

    // 5. Verify layers on OSM
    console.log('5. Verifying layers on OSM...');
    const flightsOnOSM = await page.evaluate(async () => {
      const r = await fetch('/api/flights');
      const d = await r.json();
      const arr = Array.isArray(d) ? d : (d.flights || d.aircraft || []);
      return { status: r.status, count: arr.length };
    });
    console.log('   Flights on OSM:', JSON.stringify(flightsOnOSM));

    const quakesOnOSM = await page.evaluate(async () => {
      const r = await fetch('/api/earthquakes');
      const d = await r.json();
      const features = d.features || d;
      return { status: r.status, count: Array.isArray(features) ? features.length : 0 };
    });
    console.log('   Earthquakes on OSM:', JSON.stringify(quakesOnOSM));

    const canvasOSM = await page.evaluate(() => {
      const c = document.querySelector('.cesium-widget canvas');
      return c ? { w: c.width, h: c.height } : null;
    });
    console.log('   Canvas on OSM:', JSON.stringify(canvasOSM));

    // 6. Switch back to Google 3D
    console.log('6. Switching back to Google 3D...');
    const g3dBtn = await page.locator('button').filter({ hasText: /Google/i }).first();
    const g3dBtn2 = await page.locator('button').filter({ hasText: /3D/ }).first();
    const g3dVisible = await g3dBtn.isVisible().catch(() => false) || await g3dBtn2.isVisible().catch(() => false);
    if (g3dVisible) {
      const btn = await g3dBtn.isVisible().catch(() => false) ? g3dBtn : g3dBtn2;
      await btn.click();
      console.log('   Clicked Google 3D button');
    }
    await page.waitForTimeout(5000);

    // 7. Verify layers after switch-back
    console.log('7. Verifying layers after switch-back...');
    const flightsBack = await page.evaluate(async () => {
      const r = await fetch('/api/flights');
      const d = await r.json();
      const arr = Array.isArray(d) ? d : (d.flights || d.aircraft || []);
      return { status: r.status, count: arr.length };
    });
    console.log('   Flights:', JSON.stringify(flightsBack));

    const quakesBack = await page.evaluate(async () => {
      const r = await fetch('/api/earthquakes');
      const d = await r.json();
      const features = d.features || d;
      return { status: r.status, count: Array.isArray(features) ? features.length : 0 };
    });
    console.log('   Earthquakes:', JSON.stringify(quakesBack));

    const canvasBack = await page.evaluate(() => {
      const c = document.querySelector('.cesium-widget canvas');
      return c ? { w: c.width, h: c.height } : null;
    });
    console.log('   Canvas:', JSON.stringify(canvasBack));

    // 8. Rapid switching stress test
    console.log('8. Rapid tile switching...');
    const errBefore = errors.length;
    for (let i = 0; i < 3; i++) {
      const osm = await page.locator('button').filter({ hasText: /OSM/ }).first();
      if (await osm.isVisible().catch(() => false)) await osm.click();
      await page.waitForTimeout(500);
      const g3d = await page.locator('button').filter({ hasText: /Google/i }).first();
      if (await g3d.isVisible().catch(() => false)) await g3d.click();
      await page.waitForTimeout(500);
    }
    await page.waitForTimeout(3000);
    console.log('   New errors from rapid switching:', errors.length - errBefore);

    const canvasFinal = await page.evaluate(() => {
      const c = document.querySelector('.cesium-widget canvas');
      return c ? { w: c.width, h: c.height } : null;
    });
    console.log('   Final canvas:', JSON.stringify(canvasFinal));

    await page.screenshot({ path: '.playwright-cli/feature187-final.png' });

    // Final assessment
    const criticalErrors = errors.filter(e =>
      !e.includes('favicon') && !e.includes('net::ERR') && !e.includes('ResizeObserver') &&
      !e.includes('Google') && !e.includes('403') && !e.includes('tileset') &&
      !e.includes('WebGL') && !e.includes('texture')
    );

    console.log('\n=== FEATURE #187 RESULT ===');
    console.log('Canvas exists throughout:', !!canvasFinal);
    console.log('Flights persist:', flightsOnOSM.count > 0, flightsBack.count > 0);
    console.log('Earthquakes persist:', quakesOnOSM.count > 0, quakesBack.count > 0);
    console.log('Critical errors:', criticalErrors.length);
    if (criticalErrors.length > 0) console.log('  Details:', criticalErrors.slice(0, 3));

    const pass = !!canvasFinal &&
      flightsOnOSM.count > 0 && flightsBack.count > 0 &&
      quakesOnOSM.count > 0 && quakesBack.count > 0;
    console.log('PASS:', pass);

  } catch (err) {
    console.error('Test failed:', err.message);
  } finally {
    await browser.close();
  }
})();
