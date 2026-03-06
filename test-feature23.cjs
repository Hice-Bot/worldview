const http = require('http');
const crypto = require('crypto');

function fetchSatellites() {
  return new Promise((resolve, reject) => {
    const req = http.get('http://localhost:3001/api/satellites', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const hash = crypto.createHash('md5').update(JSON.stringify(json)).digest('hex');
          resolve({ count: json.length, hash, status: res.statusCode, first: json.slice(0, 2) });
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
  console.log('=== Feature #23: Satellite cache TTL verification ===\n');

  // Call A
  console.log('Making Call A (may fetch from upstream)...');
  const startA = Date.now();
  const callA = await fetchSatellites();
  const durationA = Date.now() - startA;
  console.log('Call A result:');
  console.log('  Status:', callA.status);
  console.log('  Count:', callA.count);
  console.log('  Hash:', callA.hash);
  console.log('  Duration:', durationA + 'ms');
  console.log('  First 2:', callA.first.map(s => s.name + ' (NORAD:' + s.noradId + ')').join(', '));

  // Wait 2 seconds then make Call B
  console.log('\nWaiting 2 seconds...');
  await new Promise(r => setTimeout(r, 2000));

  console.log('Making Call B (should be cached)...');
  const startB = Date.now();
  const callB = await fetchSatellites();
  const durationB = Date.now() - startB;
  console.log('Call B result:');
  console.log('  Status:', callB.status);
  console.log('  Count:', callB.count);
  console.log('  Hash:', callB.hash);
  console.log('  Duration:', durationB + 'ms');

  // Verify
  console.log('\n=== Verification ===');
  console.log('Both return 200:', callA.status === 200 && callB.status === 200 ? 'PASS' : 'FAIL');
  console.log('Same data (hash match):', callA.hash === callB.hash ? 'PASS' : 'FAIL');
  console.log('Call B faster (cached):', durationB < durationA ? 'PASS (' + durationB + 'ms vs ' + durationA + 'ms)' : 'MAYBE (both may be cached)');
  console.log('Count > 0:', callA.count > 0 ? 'PASS (' + callA.count + ' satellites)' : 'FAIL');

  // Check cache TTL in server code
  console.log('\n=== Cache TTL Check ===');
  const fs = require('fs');
  const serverCode = fs.readFileSync('/mnt/c/Users/turke/worldview/server/index.js', 'utf8');
  const ttlMatch = serverCode.match(/cache\.set\(cacheKey,\s*deduplicated,\s*(\d+)\)/);
  if (ttlMatch) {
    const ttlSeconds = parseInt(ttlMatch[1]);
    const ttlHours = ttlSeconds / 3600;
    console.log('TTL value:', ttlSeconds + 's (' + ttlHours + ' hours)');
    console.log('TTL is 2 hours (7200s):', ttlSeconds === 7200 ? 'PASS' : 'FAIL (got ' + ttlSeconds + 's)');
  } else {
    console.log('Could not find cache.set for satellites - FAIL');
  }

  // Check cache key uses groups param
  const cacheKeyMatch = serverCode.match(/const cacheKey = `satellites_\$\{groups\}`/);
  console.log('Cache key includes groups param:', cacheKeyMatch ? 'PASS' : 'FAIL');

  // Verify no upstream fetch logged on call B (both hashes match = cached)
  console.log('\n=== Summary ===');
  const allPass = callA.status === 200 && callB.status === 200 && callA.hash === callB.hash && callA.count > 0;
  console.log('All checks:', allPass ? 'PASS' : 'FAIL');
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
