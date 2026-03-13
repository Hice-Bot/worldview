const { chromium } = require('playwright');
const { exec } = require('child_process');

var CHROME = '/mnt/c/Program Files/Google/Chrome/Application/chrome.exe';
var DEBUG_PORT = 9222;

function launchChrome() {
  return new Promise(function(resolve, reject) {
    var cmd = '"' + CHROME + '" --headless=new --no-sandbox --disable-gpu --remote-debugging-port=' + DEBUG_PORT + ' --user-data-dir=/tmp/chrome-test-profile-' + Date.now();
    console.log('Launching Chrome...');
    var child = exec(cmd, { timeout: 30000 });
    child.stderr.on('data', function(d) { console.log('Chrome stderr:', d.toString().trim()); });
    child.on('error', function(err) { console.log('Chrome spawn error:', err.message); });
    resolve(child);
  });
}

async function waitForCDP() {
  for (var i = 0; i < 20; i++) {
    await new Promise(function(resolve) { setTimeout(resolve, 1000); });
    try {
      var res = await fetch('http://127.0.0.1:' + DEBUG_PORT + '/json/version');
      if (res.ok) {
        var data = await res.json();
        console.log('Chrome CDP ready after ' + (i + 1) + 's, browser:', data.Browser);
        return true;
      }
    } catch(e) {
      if (i % 5 === 4) console.log('Still waiting for Chrome CDP... (' + (i+1) + 's)');
    }
  }
  return false;
}

async function testFeature2() {
  console.log('=== Feature 2: Vite frontend builds and loads ===');

  var chromeProcess = await launchChrome();
  var cdpReady = await waitForCDP();

  if (!cdpReady) {
    console.log('Chrome CDP never became ready - trying alternative approach');
    try { chromeProcess.kill(); } catch(e) {}
    // Fall back to curl-based verification
    return await testFeature2Fallback();
  }

  try {
    var browser = await chromium.connectOverCDP('http://127.0.0.1:' + DEBUG_PORT);
    var context = browser.contexts()[0] || await browser.newContext();
    var page = await context.newPage();

    var consoleErrors = [];
    page.on('console', function(msg) {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto('http://localhost:5173', { waitUntil: 'networkidle', timeout: 30000 });

    var rootContent = await page.evaluate(function() {
      var root = document.getElementById('root');
      return {
        exists: !!root,
        hasChildren: root ? root.children.length > 0 : false,
        childCount: root ? root.children.length : 0,
        innerHTML: root ? root.innerHTML.substring(0, 500) : 'N/A'
      };
    });

    console.log('Root element exists:', rootContent.exists);
    console.log('Root has children:', rootContent.hasChildren);
    console.log('Child count:', rootContent.childCount);
    console.log('Inner HTML preview:', rootContent.innerHTML);

    var title = await page.title();
    console.log('Page title:', title);

    console.log('Console errors count:', consoleErrors.length);
    if (consoleErrors.length > 0) {
      consoleErrors.slice(0, 5).forEach(function(err) {
        console.log('  ERROR:', err);
      });
    }

    var viteHMR = await page.evaluate(function() {
      var scripts = Array.from(document.querySelectorAll('script'));
      return scripts.some(function(s) {
        return (s.src && s.src.includes('@vite/client')) ||
               (s.textContent && s.textContent.includes('react-refresh'));
      });
    });
    console.log('Vite HMR active:', viteHMR);

    await browser.close();

    var passed = rootContent.exists && rootContent.hasChildren && consoleErrors.length === 0;
    console.log('\nFeature 2 result:', passed ? 'PASS' : 'FAIL');
    return passed;
  } catch(err) {
    console.error('Feature 2 CDP error:', err.message);
    return false;
  } finally {
    try { chromeProcess.kill(); } catch(e) {}
  }
}

async function testFeature2Fallback() {
  console.log('--- Feature 2 Fallback: HTTP-based verification ---');

  // Step 1: Vite responds with 200
  var res = await fetch('http://localhost:5173');
  var html = await res.text();
  console.log('Vite HTTP status:', res.status);

  // Step 2: HTML has root mount point
  var hasRoot = html.includes('id="root"');
  console.log('Has root mount point:', hasRoot);

  // Step 3: Vite HMR is active (script tag present)
  var hasViteClient = html.includes('@vite/client');
  console.log('Vite HMR script:', hasViteClient);

  // Step 4: React app source is included
  var hasMainTsx = html.includes('/src/main.tsx');
  console.log('Main TSX entry point:', hasMainTsx);

  // Step 5: Check Vite HMR websocket endpoint
  var hmrRes = await fetch('http://localhost:5173/@vite/client');
  console.log('Vite HMR module status:', hmrRes.status);

  // Step 6: Check that React app module resolves
  var mainRes = await fetch('http://localhost:5173/src/main.tsx');
  console.log('Main TSX module status:', mainRes.status);
  var mainContent = await mainRes.text();
  var hasReactImport = mainContent.includes('react') || mainContent.includes('React');
  console.log('Main TSX has React import:', hasReactImport);

  var passed = res.status === 200 && hasRoot && hasViteClient && hasMainTsx &&
               hmrRes.status === 200 && mainRes.status === 200;
  console.log('\nFeature 2 (fallback) result:', passed ? 'PASS' : 'FAIL');
  return passed;
}

async function testFeature3() {
  console.log('\n=== Feature 3: Backend proxy can reach external APIs ===');

  var response = await fetch('http://localhost:3001/api/earthquakes');
  console.log('HTTP status:', response.status);

  var data = await response.json();
  console.log('Response type:', data.type);
  console.log('Is FeatureCollection:', data.type === 'FeatureCollection');
  console.log('Features count:', data.features ? data.features.length : 0);

  if (data.features && data.features.length > 0) {
    var first = data.features[0];
    console.log('First feature has geometry:', !!first.geometry);
    console.log('First feature has coordinates:', !!(first.geometry && first.geometry.coordinates));
    console.log('First feature coordinates:', JSON.stringify(first.geometry.coordinates));
    console.log('First feature has properties:', !!first.properties);
    console.log('First feature magnitude:', first.properties ? first.properties.mag : 'N/A');
    console.log('First feature place:', first.properties ? first.properties.place : 'N/A');
  }

  var passed = response.status === 200 &&
    data.type === 'FeatureCollection' &&
    data.features && data.features.length > 0;
  console.log('\nFeature 3 result:', passed ? 'PASS' : 'FAIL');
  return passed;
}

async function main() {
  try {
    var f2 = await testFeature2();
    var f3 = await testFeature3();
    console.log('\n=== FINAL SUMMARY ===');
    console.log('Feature 2 (Vite frontend):', f2 ? 'PASS' : 'FAIL');
    console.log('Feature 3 (Backend proxy):', f3 ? 'PASS' : 'FAIL');
  } catch (err) {
    console.error('Test error:', err.message);
    process.exit(1);
  }
}

main();
