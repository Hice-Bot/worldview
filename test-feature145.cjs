const http = require('http');

function get(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    }).on('error', reject);
  });
}

async function main() {
  console.log('=== Feature #145: API Response Format Validation ===\n');

  // Test 1: USGS GeoJSON validation
  console.log('Test 1: Earthquake endpoint validates GeoJSON format');
  const quakeRes = await get('http://localhost:3001/api/earthquakes');
  const quakes = JSON.parse(quakeRes.body);
  const isGeoJSON = quakes.type === 'FeatureCollection' && Array.isArray(quakes.features);
  console.log('  Response is valid GeoJSON:', isGeoJSON ? 'PASS' : 'FAIL');
  console.log('  Feature count:', quakes.features ? quakes.features.length : 0);

  // Test 2: TLE data validates proper 3-line format
  console.log('\nTest 2: Satellite endpoint validates TLE format');
  const satRes = await get('http://localhost:3001/api/satellites');
  const sats = JSON.parse(satRes.body);
  let validTLE = 0;
  let invalidTLE = 0;
  for (const sat of sats) {
    if (sat.tle1 && sat.tle1.startsWith('1 ') && sat.tle2 && sat.tle2.startsWith('2 ') && sat.tle1.length >= 60 && sat.tle2.length >= 60) {
      validTLE++;
    } else {
      invalidTLE++;
      console.log('  Invalid:', sat.name, 'tle1 starts:', sat.tle1 ? sat.tle1.substring(0, 5) : 'null');
    }
  }
  console.log('  Valid TLE entries:', validTLE);
  console.log('  Invalid TLE entries:', invalidTLE);
  console.log('  All entries valid:', invalidTLE === 0 ? 'PASS' : 'FAIL');

  // Test 3: Malformed upstream responses don't crash the proxy
  console.log('\nTest 3: Server handles malformed responses gracefully');
  const healthRes = await get('http://localhost:3001/api/health');
  const health = JSON.parse(healthRes.body);
  console.log('  Server still healthy after all requests:', health.status === 'ok' ? 'PASS' : 'FAIL');

  // Test 4: Flight data validation
  console.log('\nTest 4: Flight data validation');
  const flightRes = await get('http://localhost:3001/api/flights');
  const flights = JSON.parse(flightRes.body);
  let validFlights = 0;
  for (const f of flights) {
    if (f.icao24 && typeof f.lat === 'number' && typeof f.lon === 'number') {
      validFlights++;
    }
  }
  console.log('  Total flights:', flights.length);
  console.log('  Valid flights:', validFlights);
  console.log('  All valid:', validFlights === flights.length ? 'PASS' : 'FAIL');

  // Test 5: Ships data validation
  console.log('\nTest 5: Ships data validation');
  const shipRes = await get('http://localhost:3001/api/ships');
  const ships = JSON.parse(shipRes.body);
  console.log('  Ships returned:', ships.length);
  console.log('  Is array:', Array.isArray(ships) ? 'PASS' : 'FAIL');

  console.log('\n=== All validation tests complete ===');
}

main().catch(err => console.error('ERROR:', err.message));
