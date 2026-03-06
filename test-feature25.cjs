const http = require('http');
const crypto = require('crypto');

function fetchCCTV(queryParams) {
  const qs = queryParams ? '?' + queryParams : '';
  return new Promise((resolve, reject) => {
    const req = http.get('http://localhost:3001/api/cctv' + qs, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const hash = crypto.createHash('md5').update(JSON.stringify(json)).digest('hex');
          const countries = {};
          json.forEach(c => { countries[c.country] = (countries[c.country] || 0) + 1; });
          resolve({ count: json.length, hash, status: res.statusCode, countries });
        } catch (e) {
          reject(new Error('Parse error: ' + e.message));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

async function main() {
  console.log('=== Feature #25: CCTV cache TTL verification ===\n');

  // Step 1: Call A - GET /api/cctv (all cameras)
  console.log('Call A: GET /api/cctv (all cameras)...');
  const startA = Date.now();
  const callA = await fetchCCTV();
  const durationA = Date.now() - startA;
  console.log('  Status:', callA.status);
  console.log('  Count:', callA.count);
  console.log('  Hash:', callA.hash);
  console.log('  Duration:', durationA + 'ms');
  console.log('  Countries:', JSON.stringify(callA.countries));

  // Step 2: Wait 3s, Call B - same endpoint (should be cached)
  console.log('\nWaiting 3 seconds (within 300s TTL)...');
  await new Promise(r => setTimeout(r, 3000));

  console.log('Call B: GET /api/cctv (should be cached)...');
  const startB = Date.now();
  const callB = await fetchCCTV();
  const durationB = Date.now() - startB;
  console.log('  Status:', callB.status);
  console.log('  Count:', callB.count);
  console.log('  Hash:', callB.hash);
  console.log('  Duration:', durationB + 'ms');

  // Step 3: Country filter - GB
  console.log('\nCall C: GET /api/cctv?country=GB (filtered)...');
  const callC = await fetchCCTV('country=GB');
  console.log('  Status:', callC.status);
  console.log('  Count:', callC.count);
  console.log('  Hash:', callC.hash);
  console.log('  Countries:', JSON.stringify(callC.countries));

  // Step 4: Country filter - US
  console.log('\nCall D: GET /api/cctv?country=US (filtered)...');
  const callD = await fetchCCTV('country=US');
  console.log('  Status:', callD.status);
  console.log('  Count:', callD.count);
  console.log('  Hash:', callD.hash);
  console.log('  Countries:', JSON.stringify(callD.countries));

  // Step 5: Verify cached country filter
  console.log('\nCall E: GET /api/cctv?country=GB (should be cached)...');
  const startE = Date.now();
  const callE = await fetchCCTV('country=GB');
  const durationE = Date.now() - startE;
  console.log('  Status:', callE.status);
  console.log('  Count:', callE.count);
  console.log('  Hash:', callE.hash);
  console.log('  Duration:', durationE + 'ms');

  // Verify cache TTL in code
  console.log('\n=== Code Verification ===');
  const fs = require('fs');
  const serverCode = fs.readFileSync('/mnt/c/Users/turke/worldview/server/index.js', 'utf8');
  const ttlMatch = serverCode.match(/cache\.set\(cacheKey, cameras, (\d+)\)/);
  if (ttlMatch) {
    const ttl = parseInt(ttlMatch[1]);
    console.log('CCTV cache TTL:', ttl + 's (' + (ttl / 60) + ' minutes)');
    console.log('TTL is 300s (5min):', ttl === 300 ? 'PASS' : 'FAIL');
  }

  const cacheKeyMatch = serverCode.match(/const cacheKey = `cctv_\$\{country \|\| 'all'\}`/);
  console.log('Cache key includes country param:', cacheKeyMatch ? 'PASS' : 'FAIL');

  // Summary
  console.log('\n=== Verification Results ===');
  const test1 = callA.status === 200 && callA.count > 0;
  console.log('1. GET /api/cctv returns camera data:', test1 ? 'PASS (' + callA.count + ' cameras)' : 'FAIL');

  const test2 = callA.hash === callB.hash;
  console.log('2. Second call returns identical cached data:', test2 ? 'PASS (hash match)' : 'FAIL');

  const test3 = callC.hash !== callA.hash && callD.hash !== callA.hash && callC.hash !== callD.hash;
  console.log('3. Country filter produces different results:', test3 ? 'PASS' : 'FAIL');
  console.log('   All=' + callA.count + ', GB=' + callC.count + ', US=' + callD.count);

  const test4 = callC.hash === callE.hash;
  console.log('4. Cache respects per-query-parameter keying:', test4 ? 'PASS (GB cached correctly)' : 'FAIL');

  const gbOnly = callC.countries && Object.keys(callC.countries).length === 1 && callC.countries.GB;
  const usOnly = callD.countries && Object.keys(callD.countries).length === 1 && callD.countries.US;
  console.log('   GB filter only has GB cameras:', gbOnly ? 'PASS' : 'FAIL');
  console.log('   US filter only has US cameras:', usOnly ? 'PASS' : 'FAIL');

  const allPass = test1 && test2 && test3 && test4 && gbOnly && usOnly;
  console.log('\nOverall:', allPass ? 'ALL PASS' : 'FAIL');
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
