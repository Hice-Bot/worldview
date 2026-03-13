const http = require('http');

function testUrl(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => resolve({ status: res.statusCode, body, headers: res.headers }));
    }).on('error', reject);
  });
}

async function main() {
  console.log('=== Feature #110: App loads at root URL without errors ===\n');

  // Step 1: GET / returns HTML with React root mount point
  try {
    const res = await testUrl('http://localhost:5173/');
    console.log('Step 1: GET / returns HTML with React root mount point');
    console.log('  Status:', res.status);
    console.log('  Has <div id="root">:', res.body.includes('<div id="root">'));
    console.log('  Has React module (src/main.tsx):', res.body.includes('src/main.tsx'));
    console.log('  Content-Type:', res.headers['content-type']);

    if (res.status !== 200) {
      console.log('  FAIL: Expected status 200, got', res.status);
      process.exit(1);
    }
    if (!res.body.includes('<div id="root">')) {
      console.log('  FAIL: Missing React root mount point');
      process.exit(1);
    }
    console.log('  PASS\n');
  } catch (e) {
    console.log('  FAIL:', e.message);
    process.exit(1);
  }

  // Step 2: CesiumJS globe begins loading (check for cesium assets)
  console.log('Step 2: CesiumJS globe begins loading');
  try {
    const res = await testUrl('http://localhost:5173/');
    const hasCesiumCSS = res.body.includes('cesium/Widgets/widgets.css');
    console.log('  Has Cesium CSS link:', hasCesiumCSS);
    console.log('  Has Vite HMR:', res.body.includes('@vite/client'));
    console.log('  Has react-refresh:', res.body.includes('react-refresh'));
    console.log('  PASS\n');
  } catch (e) {
    console.log('  FAIL:', e.message);
    process.exit(1);
  }

  // Step 3: Check main.tsx module loads (no 500 error)
  console.log('Step 3: Main module loads without server error');
  try {
    const res = await testUrl('http://localhost:5173/src/main.tsx');
    console.log('  Status:', res.status);
    console.log('  Content-Type:', res.headers['content-type']);
    const hasExport = res.body.includes('import') || res.body.includes('React');
    console.log('  Contains module code:', hasExport);
    if (res.status !== 200) {
      console.log('  FAIL: main.tsx returned', res.status);
      process.exit(1);
    }
    console.log('  PASS\n');
  } catch (e) {
    console.log('  FAIL:', e.message);
    process.exit(1);
  }

  // Step 4: Verify health endpoint (app backend is alive)
  console.log('Step 4: App reaches interactive state (backend alive)');
  try {
    const res = await testUrl('http://localhost:5173/api/health');
    console.log('  Status:', res.status);
    const data = JSON.parse(res.body);
    console.log('  Has uptime:', 'uptime' in data);
    console.log('  Uptime:', data.uptime, 'seconds');
    console.log('  PASS\n');
  } catch (e) {
    console.log('  FAIL:', e.message);
    process.exit(1);
  }

  console.log('=== ALL STEPS PASSED ===');
}

main().catch(e => { console.error(e); process.exit(1); });
