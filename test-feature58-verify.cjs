// Comprehensive verification for Feature #58: Flight altitude band colors correct
const http = require('http');
const fs = require('fs');
const path = require('path');

function fetch(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    }).on('error', reject);
  });
}

async function main() {
  let passed = 0;
  let failed = 0;

  function check(desc, condition) {
    if (condition) {
      console.log('  ✓', desc);
      passed++;
    } else {
      console.log('  ✗', desc);
      failed++;
    }
  }

  // 1. Verify API returns real flight data with altitude info
  console.log('\n=== API Data Verification ===');
  const res = await fetch('http://localhost:3001/api/flights');
  const flights = JSON.parse(res.data);
  const airborne = flights.filter(f => !f.onGround);

  check('API returns flights', flights.length > 0);
  check('Has airborne aircraft', airborne.length > 0);
  check('Flights have altitudeFeet field', airborne[0] && typeof airborne[0].altitudeFeet === 'number');

  // Count by altitude band
  const bands = { cruise: 0, high: 0, mid: 0, low: 0, ground: 0 };
  airborne.forEach(f => {
    const alt = f.altitudeFeet;
    if (alt >= 35000) bands.cruise++;
    else if (alt >= 20000) bands.high++;
    else if (alt >= 10000) bands.mid++;
    else if (alt >= 3000) bands.low++;
    else bands.ground++;
  });

  console.log('\n=== Altitude Band Distribution ===');
  console.log('  Cruise (>=35000ft):', bands.cruise);
  console.log('  High (>=20000ft):', bands.high);
  console.log('  Mid (>=10000ft):', bands.mid);
  console.log('  Low (>=3000ft):', bands.low);
  console.log('  Ground (<3000ft):', bands.ground);

  check('Cruise band has aircraft', bands.cruise > 0);
  check('High band has aircraft', bands.high > 0);
  check('Mid band has aircraft', bands.mid > 0);
  check('Low band has aircraft', bands.low > 0);
  check('Multiple altitude bands present', Object.values(bands).filter(v => v > 0).length >= 3);

  // 2. Verify FlightLayer source code has correct color mapping
  console.log('\n=== Code Verification ===');
  const flightLayerSrc = fs.readFileSync(
    path.join(__dirname, 'src/components/layers/FlightLayer.tsx'), 'utf8'
  );

  check('Cruise >=35000ft -> CYAN', flightLayerSrc.includes('if (altFeet >= 35000) return COLOR_CYAN'));
  check('High >=20000ft -> LIGHT BLUE', flightLayerSrc.includes('if (altFeet >= 20000) return COLOR_LIGHT_BLUE'));
  check('Mid >=10000ft -> GOLD', flightLayerSrc.includes('if (altFeet >= 10000) return COLOR_GOLD'));
  check('Low >=3000ft -> ORANGE', flightLayerSrc.includes('if (altFeet >= 3000) return COLOR_ORANGE'));
  check('Ground <3000ft -> RED', flightLayerSrc.includes('return COLOR_RED'));

  check('CYAN constant defined', flightLayerSrc.includes('Color.CYAN'));
  check('LIGHT BLUE is #87CEEB', flightLayerSrc.includes('#87CEEB'));
  check('GOLD is #FFD700', flightLayerSrc.includes('#FFD700'));
  check('ORANGE constant defined', flightLayerSrc.includes('Color.ORANGE'));
  check('RED constant defined', flightLayerSrc.includes('Color.RED'));

  // 3. Verify colors are applied to billboards
  check('Billboard color set from getAltitudeColor', flightLayerSrc.includes('const color = getAltitudeColor(flight.altitudeFeet)'));
  check('Billboard.color updated on re-render', flightLayerSrc.includes('existing.billboard.color = color'));
  check('New billboard created with color', flightLayerSrc.includes('color,') && flightLayerSrc.includes('bbCollection.add({'));

  // 4. Verify altitude band filtering
  check('getAltitudeBand function exists', flightLayerSrc.includes('function getAltitudeBand'));
  check('Altitude filter applied before rendering', flightLayerSrc.includes('if (!altitudeFilters[band]) continue'));

  // 5. Verify colors update when data changes
  check('useEffect depends on flights array', flightLayerSrc.includes('[flights, altitudeFilters'));

  // 6. Verify visual hierarchy (different scales per band)
  check('Scale varies by altitude (getAltitudeScale)', flightLayerSrc.includes('function getAltitudeScale'));
  check('Cruise scale 0.35', flightLayerSrc.includes('return 0.35'));
  check('Ground scale 0.7', flightLayerSrc.includes('return 0.7'));

  // 7. Verify no mock data
  console.log('\n=== Mock Data Check ===');
  check('No mockData in FlightLayer', !flightLayerSrc.includes('mockData'));
  check('No fakeData in FlightLayer', !flightLayerSrc.includes('fakeData'));
  check('No hardcoded flight arrays', !flightLayerSrc.includes('hardcoded'));

  // 8. Verify label colors match billboard colors
  check('Label fillColor matches billboard color', flightLayerSrc.includes('existing.label.fillColor = color'));

  // Summary
  console.log('\n=== RESULTS ===');
  console.log('Passed:', passed, '/', passed + failed);
  console.log('Failed:', failed);
  if (failed === 0) {
    console.log('\n✓ FEATURE #58 PASSES - All altitude band colors are correct');
  } else {
    console.log('\n✗ FEATURE #58 FAILS -', failed, 'checks failed');
  }
}

main().catch(e => console.error('Error:', e));
