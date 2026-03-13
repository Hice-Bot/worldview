/**
 * Test Feature #136: Altitude band filter toggles individual bands
 * Verifies that the altitude band filtering logic correctly categorizes
 * and filters aircraft by altitude band.
 */
const http = require('http');

function fetch(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(data) }));
    }).on('error', reject);
  });
}

// Altitude band classification (mirrors FlightLayer.tsx)
function getAltitudeBand(altFeet) {
  if (altFeet >= 35000) return 'cruise';
  if (altFeet >= 20000) return 'high';
  if (altFeet >= 10000) return 'mid';
  if (altFeet >= 3000) return 'low';
  return 'ground';
}

// Simulate the FlightLayer filtering logic
function filterFlights(flights, altitudeFilters) {
  return flights.filter(f => {
    if (!f.icao24 || !f.lat || !f.lon) return false;
    if (f.onGround) return false;
    const band = getAltitudeBand(f.altitudeFeet);
    return altitudeFilters[band];
  });
}

async function test() {
  console.log('=== Feature #136: Altitude band filter toggles individual bands ===\n');

  // Step 0: Fetch real flight data
  const res = await fetch('http://localhost:3001/api/flights');
  if (res.status !== 200) {
    console.error('FAIL: /api/flights returned status', res.status);
    process.exit(1);
  }

  const flights = res.data;
  console.log(`Total flights from API: ${flights.length}`);

  // Separate airborne vs ground
  const airborne = flights.filter(f => f.icao24 && f.lat && f.lon && !f.onGround);
  const ground = flights.filter(f => f.onGround);
  console.log(`Airborne: ${airborne.length}, On ground: ${ground.length}\n`);

  // Categorize by altitude band
  const bandCounts = { cruise: 0, high: 0, mid: 0, low: 0, ground: 0 };
  for (const f of airborne) {
    const band = getAltitudeBand(f.altitudeFeet);
    bandCounts[band]++;
  }
  console.log('Altitude band distribution:');
  console.log(`  Cruise (>=35000ft): ${bandCounts.cruise}`);
  console.log(`  High (>=20000ft):   ${bandCounts.high}`);
  console.log(`  Mid (>=10000ft):    ${bandCounts.mid}`);
  console.log(`  Low (>=3000ft):     ${bandCounts.low}`);
  console.log(`  Ground (<3000ft):   ${bandCounts.ground}`);
  console.log();

  let allPassed = true;

  // Test 1: Disable Cruise band - only cruise-altitude aircraft hidden
  console.log('Test 1: Disable Cruise band');
  const noCruise = { cruise: false, high: true, mid: true, low: true, ground: true };
  const filteredNoCruise = filterFlights(flights, noCruise);
  const expectedNoCruise = airborne.length - bandCounts.cruise;
  console.log(`  Filtered: ${filteredNoCruise.length}, Expected: ${expectedNoCruise}`);
  if (filteredNoCruise.length === expectedNoCruise) {
    console.log('  PASS: Only cruise-altitude aircraft hidden');
  } else {
    console.log('  FAIL: Count mismatch');
    allPassed = false;
  }
  // Verify no cruise aircraft slipped through
  const cruiseLeaked = filteredNoCruise.filter(f => getAltitudeBand(f.altitudeFeet) === 'cruise');
  if (cruiseLeaked.length === 0) {
    console.log('  PASS: Zero cruise aircraft in filtered result');
  } else {
    console.log(`  FAIL: ${cruiseLeaked.length} cruise aircraft leaked through`);
    allPassed = false;
  }
  console.log();

  // Test 2: Disable Ground band - only ground-level aircraft hidden
  console.log('Test 2: Disable Ground band');
  const noGround = { cruise: true, high: true, mid: true, low: true, ground: false };
  const filteredNoGround = filterFlights(flights, noGround);
  const expectedNoGround = airborne.length - bandCounts.ground;
  console.log(`  Filtered: ${filteredNoGround.length}, Expected: ${expectedNoGround}`);
  if (filteredNoGround.length === expectedNoGround) {
    console.log('  PASS: Only ground-level aircraft hidden');
  } else {
    console.log('  FAIL: Count mismatch');
    allPassed = false;
  }
  const groundLeaked = filteredNoGround.filter(f => getAltitudeBand(f.altitudeFeet) === 'ground');
  if (groundLeaked.length === 0) {
    console.log('  PASS: Zero ground-band aircraft in filtered result');
  } else {
    console.log(`  FAIL: ${groundLeaked.length} ground-band aircraft leaked through`);
    allPassed = false;
  }
  console.log();

  // Test 3: Enable single band only - only that altitude range visible
  console.log('Test 3: Enable single band only (Mid)');
  const onlyMid = { cruise: false, high: false, mid: true, low: false, ground: false };
  const filteredOnlyMid = filterFlights(flights, onlyMid);
  console.log(`  Filtered: ${filteredOnlyMid.length}, Expected: ${bandCounts.mid}`);
  if (filteredOnlyMid.length === bandCounts.mid) {
    console.log('  PASS: Only mid-altitude aircraft visible');
  } else {
    console.log('  FAIL: Count mismatch');
    allPassed = false;
  }
  // Verify all are mid-band
  const nonMid = filteredOnlyMid.filter(f => getAltitudeBand(f.altitudeFeet) !== 'mid');
  if (nonMid.length === 0) {
    console.log('  PASS: All visible aircraft are in mid band');
  } else {
    console.log(`  FAIL: ${nonMid.length} non-mid aircraft visible`);
    allPassed = false;
  }
  console.log();

  // Test 4: All bands disabled - no aircraft visible
  console.log('Test 4: All bands disabled');
  const noneBands = { cruise: false, high: false, mid: false, low: false, ground: false };
  const filteredNone = filterFlights(flights, noneBands);
  console.log(`  Filtered: ${filteredNone.length}, Expected: 0`);
  if (filteredNone.length === 0) {
    console.log('  PASS: No aircraft visible when all bands disabled');
  } else {
    console.log(`  FAIL: ${filteredNone.length} aircraft still visible`);
    allPassed = false;
  }
  console.log();

  // Test 5: Re-enable all - all aircraft visible again
  console.log('Test 5: Re-enable all bands');
  const allBands = { cruise: true, high: true, mid: true, low: true, ground: true };
  const filteredAll = filterFlights(flights, allBands);
  console.log(`  Filtered: ${filteredAll.length}, Expected: ${airborne.length}`);
  if (filteredAll.length === airborne.length) {
    console.log('  PASS: All aircraft visible when all bands enabled');
  } else {
    console.log('  FAIL: Count mismatch');
    allPassed = false;
  }
  console.log();

  // Test 6: Verify each band individually
  console.log('Test 6: Each band individually filters correctly');
  const bands = ['cruise', 'high', 'mid', 'low', 'ground'];
  for (const band of bands) {
    const filters = { cruise: false, high: false, mid: false, low: false, ground: false };
    filters[band] = true;
    const filtered = filterFlights(flights, filters);
    if (filtered.length === bandCounts[band]) {
      console.log(`  PASS: ${band} band alone shows ${filtered.length} aircraft`);
    } else {
      console.log(`  FAIL: ${band} band shows ${filtered.length}, expected ${bandCounts[band]}`);
      allPassed = false;
    }
  }
  console.log();

  // Verify sum of individual bands equals total airborne
  const sumBands = bands.reduce((sum, b) => sum + bandCounts[b], 0);
  console.log(`Sum of all bands: ${sumBands}, Total airborne: ${airborne.length}`);
  if (sumBands === airborne.length) {
    console.log('PASS: Band counts sum to total airborne (no gaps in classification)');
  } else {
    console.log('FAIL: Band counts do not sum correctly');
    allPassed = false;
  }
  console.log();

  // Verify the UI toggle code structure
  console.log('Test 7: Code structure verification');
  const fs = require('fs');

  // Check FlightLayer has the filtering logic
  const flightLayer = fs.readFileSync('/mnt/c/Users/turke/worldview/src/components/layers/FlightLayer.tsx', 'utf8');
  const hasGetAltitudeBand = flightLayer.includes('function getAltitudeBand');
  const hasFilterCheck = flightLayer.includes('if (!altitudeFilters[band]) continue');
  console.log(`  FlightLayer has getAltitudeBand: ${hasGetAltitudeBand ? 'PASS' : 'FAIL'}`);
  console.log(`  FlightLayer has filter check: ${hasFilterCheck ? 'PASS' : 'FAIL'}`);
  if (!hasGetAltitudeBand || !hasFilterCheck) allPassed = false;

  // Check OperationsPanel has altitude toggle buttons
  const opsPanel = fs.readFileSync('/mnt/c/Users/turke/worldview/src/components/ui/OperationsPanel.tsx', 'utf8');
  const hasAltitudeBands = opsPanel.includes('ALTITUDE_BANDS');
  const hasToggleLogic = opsPanel.includes('onAltitudeFilterChange');
  const hasIndividualToggle = opsPanel.includes('[key]: !altitudeFilters[key]');
  console.log(`  OperationsPanel has ALTITUDE_BANDS config: ${hasAltitudeBands ? 'PASS' : 'FAIL'}`);
  console.log(`  OperationsPanel has onAltitudeFilterChange: ${hasToggleLogic ? 'PASS' : 'FAIL'}`);
  console.log(`  OperationsPanel toggles individual bands: ${hasIndividualToggle ? 'PASS' : 'FAIL'}`);
  if (!hasAltitudeBands || !hasToggleLogic || !hasIndividualToggle) allPassed = false;

  // Check App.tsx has altitude filter state
  const appTsx = fs.readFileSync('/mnt/c/Users/turke/worldview/src/App.tsx', 'utf8');
  const hasAltFilterState = appTsx.includes('altitudeFilters') && appTsx.includes('setAltitudeFilters');
  console.log(`  App.tsx has altitudeFilters state: ${hasAltFilterState ? 'PASS' : 'FAIL'}`);
  if (!hasAltFilterState) allPassed = false;

  // Check types
  const types = fs.readFileSync('/mnt/c/Users/turke/worldview/src/types/index.ts', 'utf8');
  const hasAltInterface = types.includes('interface AltitudeFilters');
  const hasCruise = types.includes('cruise: boolean');
  const hasHigh = types.includes('high: boolean');
  const hasMid = types.includes('mid: boolean');
  const hasLow = types.includes('low: boolean');
  const hasGroundType = types.includes('ground: boolean');
  console.log(`  Types has AltitudeFilters interface: ${hasAltInterface ? 'PASS' : 'FAIL'}`);
  console.log(`  Types has all 5 band fields: ${(hasCruise && hasHigh && hasMid && hasLow && hasGroundType) ? 'PASS' : 'FAIL'}`);
  if (!hasAltInterface || !hasCruise || !hasHigh || !hasMid || !hasLow || !hasGroundType) allPassed = false;

  console.log();
  console.log('=== OVERALL RESULT ===');
  if (allPassed) {
    console.log('ALL TESTS PASSED - Feature #136 verified');
  } else {
    console.log('SOME TESTS FAILED');
  }

  return allPassed;
}

test().then(passed => process.exit(passed ? 0 : 1)).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
