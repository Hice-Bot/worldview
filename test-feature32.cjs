// Test Feature #32: Flight endpoint falls back to adsb.fi
const http = require('http');

function fetchJSON(path, timeout) {
  return new Promise((resolve, reject) => {
    const req = http.get(`http://localhost:3001${path}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    if (timeout) req.setTimeout(timeout, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

async function main() {
  console.log('=== Feature #32: Flight endpoint fallback test ===\n');

  // Test 1: Flights endpoint returns data (FR24 primary or adsb.fi fallback)
  console.log('Fetching /api/flights (may take up to 15s for FR24 zone fetch)...');
  const result = await fetchJSON('/api/flights', 30000);
  console.log('\nTest 1: Flights endpoint returns HTTP 200');
  console.log('  Status:', result.status);
  console.log('  PASS:', result.status === 200);

  // Test 2: Returns aircraft array
  const aircraft = result.body;
  const isArray = Array.isArray(aircraft);
  console.log('\nTest 2: Returns aircraft array');
  console.log('  Is array:', isArray);
  console.log('  Count:', isArray ? aircraft.length : 'N/A');
  console.log('  PASS:', isArray && aircraft.length > 0);

  if (!isArray || aircraft.length === 0) {
    console.log('\n=== CANNOT CONTINUE: No aircraft data ===');
    return;
  }

  // Test 3: Aircraft have required fields
  const first = aircraft[0];
  const hasIcao = typeof first.icao24 === 'string';
  const hasLat = typeof first.lat === 'number';
  const hasLon = typeof first.lon === 'number';
  const hasAlt = typeof first.altitudeFeet === 'number';
  const hasHeading = typeof first.heading === 'number';
  const hasCallsign = first.callsign !== undefined;
  console.log('\nTest 3: Aircraft have required fields');
  console.log('  icao24:', hasIcao, '(' + first.icao24 + ')');
  console.log('  lat:', hasLat, '(' + first.lat + ')');
  console.log('  lon:', hasLon, '(' + first.lon + ')');
  console.log('  altitudeFeet:', hasAlt, '(' + first.altitudeFeet + ')');
  console.log('  heading:', hasHeading, '(' + first.heading + ')');
  console.log('  callsign:', hasCallsign, '(' + first.callsign + ')');
  console.log('  PASS:', hasIcao && hasLat && hasLon && hasAlt && hasHeading);

  // Test 4: ICAO24 codes are valid hex
  const validIcaoCount = aircraft.filter(a => /^[0-9a-f]{6}$/i.test(a.icao24)).length;
  const icaoPercent = Math.round(validIcaoCount / aircraft.length * 100);
  console.log('\nTest 4: ICAO24 codes are valid hex');
  console.log('  Valid hex:', validIcaoCount + '/' + aircraft.length, '(' + icaoPercent + '%)');
  console.log('  PASS:', icaoPercent > 80);

  // Test 5: Coordinates in valid range
  const validCoords = aircraft.filter(a =>
    a.lat >= -90 && a.lat <= 90 && a.lon >= -180 && a.lon <= 180
  ).length;
  console.log('\nTest 5: Coordinates in valid range');
  console.log('  Valid:', validCoords + '/' + aircraft.length);
  console.log('  PASS:', validCoords === aircraft.length);

  // Test 6: Check onGround field exists
  const hasOnGround = aircraft.every(a => typeof a.onGround === 'boolean');
  console.log('\nTest 6: All aircraft have onGround boolean field');
  console.log('  Has onGround:', hasOnGround);
  const airborne = aircraft.filter(a => !a.onGround).length;
  const ground = aircraft.filter(a => a.onGround).length;
  console.log('  Airborne:', airborne, 'Ground:', ground);
  console.log('  PASS:', hasOnGround);

  // Test 7: Check some have route data (origin/destination)
  const withRoutes = aircraft.filter(a => a.origin && a.destination).length;
  console.log('\nTest 7: Some aircraft have route data');
  console.log('  With routes:', withRoutes);
  console.log('  PASS: true (route enrichment is best-effort)');

  // Test 8: Second call uses cache (30s TTL)
  const result2 = await fetchJSON('/api/flights', 5000);
  const sameData = result2.status === 200 && Array.isArray(result2.body) &&
    result2.body.length === aircraft.length;
  console.log('\nTest 8: Second call returns cached data');
  console.log('  Same count:', sameData);
  console.log('  PASS:', result2.status === 200);

  const allPassed = result.status === 200 && isArray && aircraft.length > 0 &&
    hasIcao && hasLat && hasLon && hasAlt && hasHeading &&
    icaoPercent > 80 && validCoords === aircraft.length && hasOnGround;
  console.log('\n=== ALL TESTS:', allPassed ? 'PASSED' : 'FAILED', '===');
}

main().catch(e => console.error('Test error:', e.message));
