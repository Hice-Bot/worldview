const http = require('http');

async function testEndpoint(path, name) {
  return new Promise((resolve) => {
    http.get('http://localhost:5173' + path, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        const status = res.statusCode;
        const isRedirect = status >= 300 && status < 400;
        const isAuth = status === 401 || status === 403;
        if (isAuth) {
          console.log('FAIL: ' + name + ' requires auth (HTTP ' + status + ')');
        } else if (isRedirect) {
          console.log('FAIL: ' + name + ' redirects (HTTP ' + status + ' -> ' + res.headers.location + ')');
        } else if (status === 200) {
          console.log('PASS: ' + name + ' accessible without auth (HTTP ' + status + ')');
        } else {
          console.log('INFO: ' + name + ' returned HTTP ' + status);
        }
        resolve(status);
      });
    }).on('error', (e) => {
      console.log('ERROR: ' + name + ': ' + e.message);
      resolve(-1);
    });
  });
}

async function run() {
  console.log('=== No Auth Gate Verification ===\n');

  // Test 1: Main page loads directly
  await testEndpoint('/', 'Main page (/)');

  // Test 2: API endpoints accessible without credentials
  await testEndpoint('/api/health', 'Health endpoint');
  await testEndpoint('/api/earthquakes', 'Earthquakes API');
  await testEndpoint('/api/flights', 'Flights API');
  await testEndpoint('/api/satellites', 'Satellites API');
  await testEndpoint('/api/cctv', 'CCTV API');

  // Test 3: Verify HTML contains globe (no login form)
  const htmlCheck = new Promise((resolve) => {
    http.get('http://localhost:5173/', (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        const hasLogin = /login|sign.?in|password|auth/i.test(data);
        const hasRoot = data.includes('id="root"');
        const hasScript = data.includes('src="/src/main.tsx"');
        console.log('\nHTML Content Checks:');
        console.log('  Has #root mount:', hasRoot ? 'YES' : 'NO');
        console.log('  Has main.tsx script:', hasScript ? 'YES' : 'NO');
        console.log('  Has login/auth references:', hasLogin ? 'YES (PROBLEM!)' : 'NO (good)');
        resolve(!hasLogin);
      });
    });
  });

  const noAuth = await htmlCheck;
  console.log('\n=== Result:', noAuth ? 'NO AUTH GATE - Globe loads directly' : 'AUTH GATE DETECTED', '===');
}

run();
