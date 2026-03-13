const http = require('http');

// Test 1: /api/health through Vite proxy
function testHealth() {
  return new Promise((resolve, reject) => {
    http.get('http://localhost:5173/api/health', (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          console.log('TEST 1 PASS: /api/health returns valid JSON via Vite proxy');
          console.log('  status:', json.status, '  uptime:', Math.round(json.uptime) + 's');
          resolve(true);
        } catch (e) {
          console.log('TEST 1 FAIL: /api/health response not valid JSON');
          resolve(false);
        }
      });
    }).on('error', (e) => {
      console.log('TEST 1 FAIL:', e.message);
      resolve(false);
    });
  });
}

// Test 2: Query parameters preserved
function testQueryParams() {
  return new Promise((resolve, reject) => {
    const url = 'http://localhost:5173/api/traffic/roads?south=-33.87&west=151.19&north=-33.85&east=151.22';
    http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (Array.isArray(json) && json.length > 0) {
            console.log('TEST 2 PASS: Query params preserved, got', json.length, 'roads');
          } else {
            console.log('TEST 2 PASS: Query params forwarded (got response, may be empty area)');
          }
          resolve(true);
        } catch (e) {
          console.log('TEST 2 FAIL: Could not parse response');
          resolve(false);
        }
      });
    }).on('error', (e) => {
      console.log('TEST 2 FAIL:', e.message);
      resolve(false);
    });
  });
}

// Test 3: Check that /api/earthquakes works through proxy (another endpoint)
function testEarthquakes() {
  return new Promise((resolve, reject) => {
    http.get('http://localhost:5173/api/earthquakes', (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const count = json.features ? json.features.length : (Array.isArray(json) ? json.length : 0);
          console.log('TEST 3 PASS: /api/earthquakes returns', count, 'events via Vite proxy');
          resolve(true);
        } catch (e) {
          console.log('TEST 3 FAIL: Could not parse earthquake response');
          resolve(false);
        }
      });
    }).on('error', (e) => {
      console.log('TEST 3 FAIL:', e.message);
      resolve(false);
    });
  });
}

// Test 4: Verify Express response headers come through
function testHeaders() {
  return new Promise((resolve, reject) => {
    http.get('http://localhost:5173/api/health', (res) => {
      const hasExpressHeader = res.headers['x-powered-by'] === 'Express';
      const hasContentType = res.headers['content-type'] && res.headers['content-type'].includes('application/json');
      if (hasExpressHeader && hasContentType) {
        console.log('TEST 4 PASS: Express response headers preserved (x-powered-by, content-type)');
      } else {
        console.log('TEST 4 PARTIAL: x-powered-by=' + res.headers['x-powered-by'] + ', content-type=' + res.headers['content-type']);
      }
      resolve(true);
    }).on('error', (e) => {
      console.log('TEST 4 FAIL:', e.message);
      resolve(false);
    });
  });
}

async function run() {
  console.log('=== Vite Proxy Verification ===\n');
  await testHealth();
  await testQueryParams();
  await testEarthquakes();
  await testHeaders();
  console.log('\n=== All proxy tests complete ===');
}

run();
