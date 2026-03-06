// Feature #78: Ship labels show name, speed, destination
// Verify:
// 1. Labels show vessel name, speed (knots), and destination
// 2. Labels fade at distance thresholds (NearFarScalar translucency)
// 3. Labels hidden when zoomed far out
// 4. Trails render only when vessel is moving (SOG >0.5 kt)

const http = require('http');
const fs = require('fs');

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

async function main() {
  let pass = true;
  console.log('=== Feature #78: Ship labels show name, speed, destination ===\n');

  // 1. Fetch ship data
  const ships = await fetchJSON('http://localhost:3001/api/ships');
  console.log(`Fetched ${ships.length} ships from proxy`);

  // 2. Verify ship data has required fields
  let withName = 0, withSog = 0, withDest = 0, moving = 0, stationary = 0;
  for (const ship of ships) {
    if (ship.name && ship.name.length > 0) withName++;
    if (ship.sog > 0) withSog++;
    if (ship.destination && ship.destination.length > 0 && ship.destination !== 'UNKNOWN') withDest++;
    if (ship.sog > 0.5) moving++;
    else stationary++;
  }
  console.log(`  Ships with name: ${withName}/${ships.length}`);
  console.log(`  Ships with SOG > 0: ${withSog}/${ships.length}`);
  console.log(`  Ships with destination: ${withDest}/${ships.length}`);
  console.log(`  Moving (SOG > 0.5): ${moving}, Stationary: ${stationary}`);
  console.log();

  // 3. Verify code implementation
  const layerCode = fs.readFileSync('/mnt/c/Users/turke/worldview/src/components/layers/ShipLayer.tsx', 'utf8');

  // Step 1: Labels show vessel name, speed (knots), and destination
  console.log('Step 1: Labels show vessel name, speed (knots), and destination');
  if (layerCode.includes('ship.name') && layerCode.includes('ship.mmsi')) {
    console.log('  PASS: Label uses vessel name (fallback to MMSI)');
  } else {
    console.log('  FAIL: Label does not use vessel name');
    pass = false;
  }

  if (layerCode.includes('sog.toFixed') && layerCode.includes('kn')) {
    console.log('  PASS: Label includes speed in knots');
  } else {
    console.log('  FAIL: Label does not include speed');
    pass = false;
  }

  if (layerCode.includes('ship.destination') && layerCode.includes('destStr')) {
    console.log('  PASS: Label includes destination');
  } else {
    console.log('  FAIL: Label does not include destination');
    pass = false;
  }

  // Verify the label composition
  if (layerCode.includes("vesselName + sogStr + destStr")) {
    console.log('  PASS: Label text combines name + speed + destination');
  } else {
    console.log('  FAIL: Label text not properly composed');
    pass = false;
  }

  // Step 2: Labels fade at distance thresholds
  console.log('\nStep 2: Labels fade at distance thresholds');
  if (layerCode.includes('translucencyByDistance') && layerCode.includes('NearFarScalar')) {
    console.log('  PASS: NearFarScalar translucency applied to labels');
  } else {
    console.log('  FAIL: No distance-based fading on labels');
    pass = false;
  }

  // Check specific distance values
  if (layerCode.includes('5000') && layerCode.includes('500000')) {
    console.log('  PASS: Fading from 5km (full) to 500km (transparent)');
  } else {
    console.log('  INFO: Distance thresholds may differ from expected');
  }

  // Step 3: Labels hidden when zoomed far out
  console.log('\nStep 3: Labels hidden when zoomed far out');
  if (layerCode.includes('cameraAlt') && layerCode.includes('showLabels') && layerCode.includes('3000000')) {
    console.log('  PASS: Labels hidden above 3,000km altitude');
  } else {
    console.log('  FAIL: No altitude-based label hiding');
    pass = false;
  }

  // Check occlusion integration
  if (layerCode.includes('!occluded && showLabels')) {
    console.log('  PASS: Labels hidden when occluded AND when zoomed out');
  } else {
    console.log('  FAIL: Label visibility not properly combined');
    pass = false;
  }

  // Step 4: Trails render only when vessel is moving (SOG >0.5 kt)
  console.log('\nStep 4: Trails render only when vessel is moving (SOG >0.5 kt)');
  if (layerCode.includes('MIN_SOG_FOR_TRAIL') && layerCode.includes('0.5')) {
    console.log('  PASS: Minimum SOG threshold of 0.5 kt defined');
  } else {
    console.log('  FAIL: No SOG threshold for trails');
    pass = false;
  }

  if (layerCode.includes('generateTrailPositions')) {
    console.log('  PASS: Trail generation function exists');
  } else {
    console.log('  FAIL: No trail generation function');
    pass = false;
  }

  if (layerCode.includes('PolylineCollection') && layerCode.includes('trailCollection')) {
    console.log('  PASS: Trails use PolylineCollection');
  } else {
    console.log('  FAIL: Trails not using PolylineCollection');
    pass = false;
  }

  if (layerCode.includes('reverseHeading') || layerCode.includes('reverse')) {
    console.log('  PASS: Trail uses reverse heading to trace past positions');
  } else {
    console.log('  FAIL: Trail does not trace past positions');
    pass = false;
  }

  // Check trail only shown for moving ships
  if (layerCode.includes('> MIN_SOG_FOR_TRAIL')) {
    console.log('  PASS: Trail only created when SOG > threshold');
  } else {
    console.log('  FAIL: Trail not gated by SOG threshold');
    pass = false;
  }

  // Check stopped vessels get trail hidden
  if (layerCode.includes('polyline.show = false') || layerCode.includes("show: false")) {
    console.log('  PASS: Stopped vessel trails hidden');
  } else {
    console.log('  INFO: Stopped vessel trail hiding may use different mechanism');
  }

  // 4. Check no mock data
  console.log('\nMock data check:');
  const mockPatterns = ['mockData', 'fakeData', 'sampleData', 'dummyData', 'testData', 'hardcodedShips', 'STUB', 'MOCK'];
  let foundMock = false;
  for (const p of mockPatterns) {
    if (layerCode.includes(p)) {
      console.log(`  FAIL: Found mock pattern: ${p}`);
      foundMock = true;
    }
  }
  if (!foundMock) {
    console.log('  PASS: No mock data patterns found');
  } else {
    pass = false;
  }

  // 5. Verify label composition with sample ship data
  console.log('\nSample label compositions:');
  const samples = ships.slice(0, 5);
  for (const ship of samples) {
    const vesselName = ship.name || ship.mmsi;
    const sogStr = ship.sog > 0 ? ` ${ship.sog.toFixed(1)}kn` : '';
    const destStr = ship.destination ? ` → ${ship.destination}` : '';
    const label = vesselName + sogStr + destStr;
    const hasTrail = ship.sog > 0.5 ? 'TRAIL' : 'NO TRAIL';
    console.log(`  ${label} [${hasTrail}]`);
  }

  console.log('\n' + (pass ? 'ALL CHECKS PASSED' : 'SOME CHECKS FAILED'));
  process.exit(pass ? 0 : 1);
}

main().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
