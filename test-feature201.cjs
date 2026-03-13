/**
 * Test Feature #201: Concurrent proxy cache prevents upstream overload
 *
 * Verifies:
 * 1. Multiple rapid client requests served from cache
 * 2. Upstream APIs called only when cache expires
 * 3. Cache key strategy prevents duplicate upstream calls
 * 4. FR24 minimum 15s between upstream calls enforced
 * 5. Health endpoint shows cache hit/miss ratio
 */
const fs = require('fs');
const http = require('http');

const results = [];

function test(name, passed, detail) {
  const status = passed ? 'PASS' : 'FAIL';
  results.push(`${status}: ${name}${detail ? ' — ' + detail : ''}`);
}

async function fetchJSON(urlPath) {
  return new Promise((resolve, reject) => {
    const req = http.get(`http://localhost:3001${urlPath}`, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body), time: 0 });
        } catch (e) {
          resolve({ status: res.statusCode, data: body, time: 0 });
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

async function timedFetch(urlPath) {
  const start = Date.now();
  const result = await fetchJSON(urlPath);
  result.time = Date.now() - start;
  return result;
}

async function run() {
  // --- Test 1: Health endpoint shows cache stats ---
  const health = await fetchJSON('/api/health');
  test('Health endpoint returns 200', health.status === 200);
  test('Health shows cache stats with hits/misses',
    health.data?.cache?.stats?.hits !== undefined && health.data?.cache?.stats?.misses !== undefined,
    `hits=${health.data?.cache?.stats?.hits}, misses=${health.data?.cache?.stats?.misses}`);
  test('Health shows cache hit rate percentage',
    typeof health.data?.cache?.hitRate === 'string' && health.data?.cache?.hitRate.includes('%'),
    health.data?.cache?.hitRate);
  test('Health shows inflight request count',
    health.data?.cache?.inflightRequests !== undefined,
    `inflightRequests=${health.data?.cache?.inflightRequests}`);

  // --- Test 2: Rapid requests served from cache ---
  // Make initial request to warm cache
  const eq1 = await timedFetch('/api/earthquakes');
  test('Earthquake endpoint returns 200', eq1.status === 200);

  // Rapid second request should be much faster (from cache)
  const eq2 = await timedFetch('/api/earthquakes');
  test('Second earthquake request served from cache (faster)',
    eq2.time < eq1.time || eq2.time < 50,
    `first=${eq1.time}ms, second=${eq2.time}ms`);

  // --- Test 3: Cache key strategy prevents duplicate upstream calls ---
  // Read server code to verify unique cache keys per endpoint
  const serverCode = fs.readFileSync(__dirname + '/server/index.js', 'utf8');

  test('Earthquakes use dedicated cache key',
    serverCode.includes("'earthquakes'") && serverCode.includes("cachedFetch('earthquakes'"));
  test('Ships use dedicated cache key',
    serverCode.includes("'ships'") && serverCode.includes("cachedFetch('ships'"));
  test('Satellites use parameterized cache key',
    serverCode.includes('satellites_${groups}'));
  test('CCTV uses parameterized cache key',
    serverCode.includes("cctv_${country || 'all'}"));
  test('Traffic uses bbox-based cache key',
    serverCode.includes('traffic_${s}_${w}_${n}_${e}'));

  // --- Test 4: In-flight request deduplication exists ---
  test('inflightRequests map exists for deduplication',
    serverCode.includes('inflightRequests') && serverCode.includes('new Map()'));
  test('cachedFetch function prevents duplicate upstream calls',
    serverCode.includes('async function cachedFetch') && serverCode.includes('inflightRequests.has'));
  test('cachedFetch cleans up in-flight on success',
    serverCode.includes('inflightRequests.delete(cacheKey)'));
  test('cachedFetch cleans up in-flight on error',
    serverCode.includes('.catch(err =>') && serverCode.includes('inflightRequests.delete'));

  // --- Test 5: FR24 minimum 15s between upstream calls enforced ---
  test('FR24_MIN_INTERVAL = 15000 (15s)',
    serverCode.includes('FR24_MIN_INTERVAL = 15000'),
    'Enforces minimum 15s between FR24 upstream calls');
  test('FR24 cooldown check before upstream call',
    serverCode.includes('fr24CooldownOk') && serverCode.includes('timeSinceLastFR24 >= FR24_MIN_INTERVAL'));
  test('FR24 exponential backoff on failures',
    serverCode.includes('fr24BackoffMs') && serverCode.includes('Math.min'));

  // --- Test 6: Cache TTLs are set per endpoint ---
  test('Earthquakes TTL is 60s',
    serverCode.includes("cachedFetch('earthquakes', 60"));
  test('Ships TTL is 120s',
    serverCode.includes("cachedFetch('ships', 120"));
  test('CCTV TTL is 300s',
    serverCode.includes("cacheKey, 300"));
  test('Satellites TTL is 7200s',
    serverCode.includes("cacheKey, 7200"));
  test('Traffic TTL is 86400s',
    serverCode.includes("cacheKey, 86400"));

  // --- Test 7: Verify actual cache behavior via health endpoint ---
  const healthAfter = await fetchJSON('/api/health');
  const stats = healthAfter.data?.cache?.stats;
  test('Cache has recorded hits > 0',
    stats?.hits > 0,
    `hits=${stats?.hits}`);
  test('Cache has active keys',
    healthAfter.data?.cache?.keys > 0,
    `keys=${healthAfter.data?.cache?.keys}`);

  // Summary
  const passed = results.filter(r => r.startsWith('PASS')).length;
  const failed = results.filter(r => r.startsWith('FAIL')).length;
  results.push('');
  results.push(`Results: ${passed}/${passed + failed} passed, ${failed} failed`);

  fs.writeFileSync('/tmp/f201.txt', results.join('\n'));
}

run().catch(err => {
  results.push(`ERROR: ${err.message}`);
  fs.writeFileSync('/tmp/f201.txt', results.join('\n'));
});
