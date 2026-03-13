const http = require('http');

function fetchEndpoint(url) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const elapsed = Date.now() - start;
        resolve({ status: res.statusCode, data, elapsed, size: data.length });
      });
    }).on('error', reject);
  });
}

async function main() {
  console.log('=== Feature #182: Rapid camera movement during data refresh ===\n');

  console.log('Test 1: Simulate rapid camera changes - different traffic bboxes simultaneously');
  const bboxes = [
    { s: -33.88, w: 151.19, n: -33.85, e: 151.22, label: 'Sydney CBD' },
    { s: 51.49, w: -0.13, n: 51.52, e: -0.10, label: 'London' },
    { s: 40.74, w: -74.00, n: 40.77, e: -73.97, label: 'NYC' },
    { s: 35.66, w: 139.70, n: 35.69, e: 139.73, label: 'Tokyo' },
    { s: 48.85, w: 2.33, n: 48.88, e: 2.36, label: 'Paris' },
  ];

  const trafficResults = await Promise.all(
    bboxes.map(bb =>
      fetchEndpoint(
        'http://localhost:3001/api/traffic/roads?south=' + bb.s + '&west=' + bb.w + '&north=' + bb.n + '&east=' + bb.e
      ).then(r => Object.assign(r, { label: bb.label }))
    )
  );

  let trafficPass = true;
  trafficResults.forEach(r => {
    const ok = r.status === 200;
    if (!ok) trafficPass = false;
    console.log('  ' + (ok ? 'PASS' : 'FAIL') + ' ' + r.label + ': HTTP ' + r.status + ', ' + r.elapsed + 'ms, ' + r.size + ' bytes');
  });

  console.log('\nTest 2: Simulate rapid useFlightsLive calls with different positions');
  const livePositions = [
    { lat: -33.86, lon: 151.21, dist: 100, label: 'Sydney' },
    { lat: 51.50, lon: -0.12, dist: 150, label: 'London' },
    { lat: 40.76, lon: -73.98, dist: 200, label: 'NYC' },
    { lat: 35.68, lon: 139.72, dist: 100, label: 'Tokyo' },
  ];

  const liveResults = await Promise.all(
    livePositions.map(pos =>
      fetchEndpoint(
        'http://localhost:3001/api/flights/live?lat=' + pos.lat + '&lon=' + pos.lon + '&dist=' + pos.dist
      ).then(r => Object.assign(r, { label: pos.label }))
    )
  );

  let livePass = true;
  liveResults.forEach(r => {
    const ok = r.status === 200;
    if (!ok) livePass = false;
    let count = 'N/A';
    try { count = JSON.parse(r.data).length; } catch (e) {}
    console.log('  ' + (ok ? 'PASS' : 'FAIL') + ' ' + r.label + ': HTTP ' + r.status + ', ' + count + ' flights, ' + r.elapsed + 'ms');
  });

  console.log('\nTest 3: Concurrent data refresh during rapid bbox changes');
  const mixedResults = await Promise.all([
    fetchEndpoint('http://localhost:3001/api/flights'),
    fetchEndpoint('http://localhost:3001/api/satellites'),
    fetchEndpoint('http://localhost:3001/api/ships'),
    fetchEndpoint('http://localhost:3001/api/traffic/roads?south=-33.88&west=151.19&north=-33.85&east=151.22'),
    fetchEndpoint('http://localhost:3001/api/traffic/roads?south=51.49&west=-0.13&north=51.52&east=-0.10'),
    fetchEndpoint('http://localhost:3001/api/flights/live?lat=-33.86&lon=151.21&dist=100'),
    fetchEndpoint('http://localhost:3001/api/flights/live?lat=51.50&lon=-0.12&dist=150'),
    fetchEndpoint('http://localhost:3001/api/cctv'),
    fetchEndpoint('http://localhost:3001/api/earthquakes'),
  ]);

  let mixedPass = true;
  const labels = ['flights', 'satellites', 'ships', 'traffic-sydney', 'traffic-london', 'live-sydney', 'live-london', 'cctv', 'earthquakes'];
  mixedResults.forEach((r, i) => {
    const ok = r.status === 200;
    if (!ok) mixedPass = false;
    console.log('  ' + (ok ? 'PASS' : 'FAIL') + ' ' + labels[i] + ': HTTP ' + r.status + ', ' + r.elapsed + 'ms, ' + r.size + ' bytes');
  });

  console.log('\nTest 4: Rapid sequential fetches (simulating camera panning)');
  let seqPass = true;
  for (let i = 0; i < 5; i++) {
    const lat = -33.86 + (i * 0.01);
    const lon = 151.21 + (i * 0.01);
    const r = await fetchEndpoint('http://localhost:3001/api/flights/live?lat=' + lat + '&lon=' + lon + '&dist=100');
    const ok = r.status === 200;
    if (!ok) seqPass = false;
    console.log('  ' + (ok ? 'PASS' : 'FAIL') + ' Position ' + i + ' (lat=' + lat.toFixed(2) + ', lon=' + lon.toFixed(2) + '): ' + r.elapsed + 'ms');
  }

  console.log('\nTest 5: Verify server health after rapid movement simulation');
  const health = await fetchEndpoint('http://localhost:3001/api/health');
  const hd = JSON.parse(health.data);
  console.log('  Server status: ' + hd.status);
  console.log('  Cache keys: ' + hd.cache.keys);
  console.log('  Cache hits: ' + hd.cache.stats.hits);

  const allPass = trafficPass && livePass && mixedPass && seqPass && hd.status === 'ok';
  console.log('\n=== RESULT: ' + (allPass ? 'ALL PASS' : 'SOME FAILED') + ' ===');
  process.exit(allPass ? 0 : 1);
}

main().catch(err => {
  console.error('Test failed: ' + err.message);
  process.exit(1);
});
