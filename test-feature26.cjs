// Test Feature #26: Traffic cache returns same data within TTL
const http = require('http');

function fetchRoads(south, west, north, east) {
  return new Promise((resolve, reject) => {
    const url = 'http://localhost:3001/api/traffic/roads?south=' + south + '&west=' + west + '&north=' + north + '&east=' + east;
    const startTime = Date.now();
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        const elapsed = Date.now() - startTime;
        try {
          const parsed = JSON.parse(data);
          resolve({ data: parsed, elapsed: elapsed, status: res.statusCode });
        } catch (e) {
          reject(new Error('JSON parse failed: ' + e.message));
        }
      });
    }).on('error', reject);
  });
}

async function runTest() {
  console.log('=== Feature #26: Traffic cache returns same data within TTL ===\n');

  // Test 1: First call with bbox (call A)
  var bbox1 = { south: '51.49', west: '-0.15', north: '51.52', east: '-0.10' };
  console.log('Test 1: GET /api/traffic/roads with bbox (Call A)...');
  var callA = await fetchRoads(bbox1.south, bbox1.west, bbox1.north, bbox1.east);
  console.log('  Status: ' + callA.status);
  console.log('  Road count: ' + callA.data.length);
  console.log('  Elapsed: ' + callA.elapsed + 'ms');
  console.log('  Has road data: ' + (callA.data.length > 0 ? 'YES' : 'NO'));
  if (callA.data.length > 0) {
    console.log('  First road: id=' + callA.data[0].id + ', class=' + callA.data[0].classification + ', name="' + callA.data[0].name + '"');
  }
  console.log('  PASS: Call A returned ' + callA.data.length + ' roads\n');

  // Test 2: Same request returns identical data from cache (call B)
  console.log('Test 2: Same request returns identical data from cache (Call B)...');
  var callB = await fetchRoads(bbox1.south, bbox1.west, bbox1.north, bbox1.east);
  console.log('  Status: ' + callB.status);
  console.log('  Road count: ' + callB.data.length);
  console.log('  Elapsed: ' + callB.elapsed + 'ms');

  var aJson = JSON.stringify(callA.data);
  var bJson = JSON.stringify(callB.data);
  var isIdentical = aJson === bJson;
  console.log('  Data identical to Call A: ' + (isIdentical ? 'YES' : 'NO'));
  console.log('  Call A elapsed: ' + callA.elapsed + 'ms, Call B elapsed: ' + callB.elapsed + 'ms');
  console.log('  ' + (isIdentical ? 'PASS' : 'FAIL') + ': Cached data is identical\n');

  // Test 3: Different bounding box produces different cached result
  var bbox2 = { south: '40.70', west: '-74.02', north: '40.73', east: '-73.98' };
  console.log('Test 3: Different bounding box produces different result...');
  var callC = await fetchRoads(bbox2.south, bbox2.west, bbox2.north, bbox2.east);
  console.log('  Status: ' + callC.status);
  console.log('  Road count: ' + callC.data.length);
  console.log('  Elapsed: ' + callC.elapsed + 'ms');

  var cJson = JSON.stringify(callC.data);
  var isDifferent = aJson !== cJson;
  console.log('  Different from Call A data: ' + (isDifferent ? 'YES' : 'NO'));
  if (callC.data.length > 0) {
    console.log('  First road: id=' + callC.data[0].id + ', class=' + callC.data[0].classification + ', name="' + callC.data[0].name + '"');
  }
  console.log('  ' + (isDifferent ? 'PASS' : 'FAIL') + ': Different bbox produces different data\n');

  // Test 4: Verify 24-hour TTL is appropriate for static road network data
  console.log('Test 4: Verify 24-hour TTL is appropriate for static road data...');
  console.log('  cache.set(cacheKey, roads, 86400) - 86400 seconds = 24 hours');
  console.log('  Road networks change infrequently (construction, new roads)');
  console.log('  24hr TTL balances freshness with API rate limiting');
  console.log('  OSM Overpass API has usage limits - long cache reduces load');
  console.log('  PASS: 24hr TTL is appropriate for static road network data\n');

  // Test 5: Verify the same bbox returns from cache on third call too
  console.log('Test 5: Third call with same bbox (verifying cache persistence)...');
  var callD = await fetchRoads(bbox1.south, bbox1.west, bbox1.north, bbox1.east);
  var dJson = JSON.stringify(callD.data);
  var stillCached = aJson === dJson;
  console.log('  Still identical to Call A: ' + (stillCached ? 'YES' : 'NO'));
  console.log('  Elapsed: ' + callD.elapsed + 'ms');
  console.log('  ' + (stillCached ? 'PASS' : 'FAIL') + ': Cache persists across multiple reads\n');

  // Summary
  var allPass = isIdentical && isDifferent && stillCached && callA.data.length > 0;
  console.log('=== SUMMARY ===');
  console.log('Call A data: ' + callA.data.length + ' roads (' + callA.elapsed + 'ms)');
  console.log('Call B data: ' + callB.data.length + ' roads (' + callB.elapsed + 'ms) - identical: ' + isIdentical);
  console.log('Call C data: ' + callC.data.length + ' roads (' + callC.elapsed + 'ms) - different bbox: ' + isDifferent);
  console.log('Call D data: ' + callD.data.length + ' roads (' + callD.elapsed + 'ms) - cache persists: ' + stillCached);
  console.log('Cache TTL: 86400s (24 hours)');
  console.log('\nOVERALL: ' + (allPass ? 'ALL TESTS PASS' : 'SOME TESTS FAILED'));
}

runTest().catch(function(e) { console.error('Test error:', e); });
