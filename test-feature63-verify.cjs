// Comprehensive verification for Feature #63: Flight callsign labels visible when zoomed in
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

  // Read FlightLayer source
  const src = fs.readFileSync(
    path.join(__dirname, 'src/components/layers/FlightLayer.tsx'), 'utf8'
  );

  // 1. Labels hidden when camera zoomed out far (reduce clutter)
  console.log('\n=== Requirement 1: Labels hidden when zoomed out ===');
  check('Camera altitude check for label visibility', src.includes('showLabels = cameraAlt < 3000000'));
  check('Labels hidden when zoomed out (data update)', src.includes('show: !occluded && showLabels'));
  check('Labels hidden when zoomed out (preRender)', src.includes('entry.label.show = !occluded && showLabels'));
  check('PreRender updates at 1Hz throttle', src.includes('1000') && src.includes('1Hz throttle'));

  // 2. Labels appear when zoomed into region
  console.log('\n=== Requirement 2: Labels appear when zoomed in ===');
  check('Below 3M meters labels show', src.includes('cameraAlt < 3000000'));
  check('Label visibility computed in both data loop and preRender',
    (src.match(/showLabels/g) || []).length >= 3);

  // 3. Each label shows callsign, altitude (ft), speed (kts)
  console.log('\n=== Requirement 3: Label shows callsign + alt + speed ===');
  check('Callsign from flight data', src.includes('flight.callsign || flight.icao24'));
  check('Altitude in feet', src.includes('flight.altitudeFeet') && src.includes("'ft'"));
  check('Speed in knots', src.includes('flight.velocityKnots') && src.includes("'kts'"));
  check('Label text combines all fields', src.includes('callsignStr + altStr + spdStr'));

  // 4. Route (origin-destination) shown when available
  console.log('\n=== Requirement 4: Route shown when available ===');
  check('Route string built from origin+destination', src.includes('flight.origin') && src.includes('flight.destination'));
  check('Route format is ORIGIN-DESTINATION', src.includes("flight.origin + '-' + flight.destination"));
  check('Route on newline for readability', src.includes("'\\n'") && src.includes('routeStr'));
  check('Route only shown when both origin and destination exist',
    src.includes('flight.origin && flight.destination'));

  // 5. Labels positioned near aircraft billboards
  console.log('\n=== Requirement 5: Labels positioned near billboards ===');
  check('pixelOffset positions label right of billboard', src.includes('pixelOffset: new Cartesian2(10, -4)'));
  check('Label has same position as billboard', src.includes('existing.label.position = position'));
  check('Label vertically aligned to bottom of text', src.includes('VerticalOrigin.BOTTOM'));
  check('Label horizontally aligned left', src.includes('HorizontalOrigin.LEFT'));

  // 6. Label text updates with live data
  console.log('\n=== Requirement 6: Label text updates with live data ===');
  check('Label text updated on data refresh', src.includes('existing.label.text = labelText'));
  check('Label position updated on data refresh', src.includes('existing.label.position = position'));
  check('Label fillColor updated on data refresh', src.includes('existing.label.fillColor = color'));
  check('useEffect triggers on flights array change', src.includes('[flights, altitudeFilters'));

  // Verify API data has the required fields
  console.log('\n=== API Data Verification ===');
  const res = await fetch('http://localhost:3001/api/flights');
  const flights = JSON.parse(res.data);
  const airborne = flights.filter(f => !f.onGround && f.callsign);
  const sample = airborne[0];

  check('API returns flights with callsign', sample && typeof sample.callsign === 'string' && sample.callsign.length > 0);
  check('API returns altitudeFeet', sample && typeof sample.altitudeFeet === 'number');
  check('API returns velocityKnots', sample && typeof sample.velocityKnots === 'number');

  const withRoute = airborne.filter(f => f.origin && f.destination);
  console.log('  Flights with route info:', withRoute.length, '/', airborne.length);
  if (withRoute.length > 0) {
    console.log('  Sample route:', withRoute[0].callsign, withRoute[0].origin + '-' + withRoute[0].destination);
  }

  // Label style verification
  console.log('\n=== Label Style Verification ===');
  check('Monospace font', src.includes("'10px monospace'"));
  check('Black outline for readability', src.includes('outlineColor: Color.BLACK'));
  check('Semi-transparent background', src.includes('backgroundColor: Color.BLACK.withAlpha(0.5)'));
  check('FILL_AND_OUTLINE style', src.includes('LabelStyle.FILL_AND_OUTLINE'));

  // Summary
  console.log('\n=== RESULTS ===');
  console.log('Passed:', passed, '/', passed + failed);
  console.log('Failed:', failed);
  if (failed === 0) {
    console.log('\n✓ FEATURE #63 PASSES - Flight callsign labels visible when zoomed in');
  } else {
    console.log('\n✗ FEATURE #63 FAILS -', failed, 'checks failed');
  }
}

main().catch(e => console.error('Error:', e));
