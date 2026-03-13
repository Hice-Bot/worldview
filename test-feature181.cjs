const fs = require('fs');
const http = require('http');

function fetchEndpoint(url) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const elapsed = Date.now() - start;
        resolve({ status: res.statusCode, data, elapsed });
      });
    }).on('error', reject);
  });
}

async function main() {
  console.log('=== Feature #181: All 6 layers fetch simultaneously ===\n');

  const endpoints = [
    { name: 'flights', url: 'http://localhost:3001/api/flights' },
    { name: 'satellites', url: 'http://localhost:3001/api/satellites' },
    { name: 'earthquakes', url: 'http://localhost:3001/api/earthquakes' },
    { name: 'traffic', url: 'http://localhost:3001/api/traffic/roads?south=-33.88&west=151.19&north=-33.85&east=151.22' },
    { name: 'ships', url: 'http://localhost:3001/api/ships' },
    { name: 'cctv', url: 'http://localhost:3001/api/cctv' },
  ];

  console.log('Step 1: Fire all 6 requests simultaneously...');
  const startAll = Date.now();

  const results = await Promise.all(
    endpoints.map(ep => fetchEndpoint(ep.url).then(r => ({ ...r, name: ep.name })))
  );

  const totalElapsed = Date.now() - startAll;
  console.log(`All 6 completed in ${totalElapsed}ms\n`);

  let allPassed = true;

  results.forEach(r => {
    const statusOk = r.status === 200;
    let parsed;
    let count;
    try {
      parsed = JSON.parse(r.data);
      count = Array.isArray(parsed) ? parsed.length : (typeof parsed === 'string' ? 'TLE text' : Object.keys(parsed).length + ' keys');
    } catch (e) {
      count = 'PARSE ERROR';
      allPassed = false;
    }

    if (!statusOk) allPassed = false;

    console.log(`  ${statusOk ? 'PASS' : 'FAIL'} ${r.name}: HTTP ${r.status}, ${count} items, ${r.elapsed}ms, ${r.data.length} bytes`);
  });

  console.log('\nStep 2: Verify no state corruption - fire all 6 again...');
  const startAll2 = Date.now();

  const results2 = await Promise.all(
    endpoints.map(ep => fetchEndpoint(ep.url).then(r => ({ ...r, name: ep.name })))
  );

  const totalElapsed2 = Date.now() - startAll2;
  console.log(`Second batch completed in ${totalElapsed2}ms\n`);

  results2.forEach(r => {
    const statusOk = r.status === 200;
    let parsed;
    let count;
    try {
      parsed = JSON.parse(r.data);
      count = Array.isArray(parsed) ? parsed.length : (typeof parsed === 'string' ? 'TLE text' : Object.keys(parsed).length + ' keys');
    } catch (e) {
      count = 'PARSE ERROR';
      allPassed = false;
    }

    if (!statusOk) allPassed = false;

    console.log(`  ${statusOk ? 'PASS' : 'FAIL'} ${r.name}: HTTP ${r.status}, ${count} items, ${r.elapsed}ms, ${r.data.length} bytes`);
  });

  console.log('\nStep 3: Verify server health after concurrent load...');
  const health = await fetchEndpoint('http://localhost:3001/api/health');
  const healthData = JSON.parse(health.data);
  console.log(`  Server status: ${healthData.status}`);
  console.log(`  Uptime: ${Math.round(healthData.uptime)}s`);
  console.log(`  Cache keys: ${healthData.cache.keys}`);
  console.log(`  Cache hits: ${healthData.cache.stats.hits}`);

  if (healthData.status !== 'ok') allPassed = false;

  console.log(`\n=== RESULT: ${allPassed ? 'ALL PASS' : 'SOME FAILED'} ===`);
  process.exit(allPassed ? 0 : 1);
}

main().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
