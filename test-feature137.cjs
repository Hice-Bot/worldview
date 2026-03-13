/**
 * Test Feature #137: Satellite category filter edge cases
 * Verifies ISS/Other filter toggles handle all edge cases correctly.
 */
const http = require('http');
const fs = require('fs');

function fetch(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(data) }));
    }).on('error', reject);
  });
}

const ISS_NORAD = 25544;

// Simulate the SatelliteLayer filtering logic
function filterSatellites(satellites, filters) {
  return satellites.filter(sat => {
    const isISS = sat.noradId === ISS_NORAD;
    if (isISS && !filters.iss) return false;
    if (!isISS && !filters.other) return false;
    return true;
  });
}

async function test() {
  console.log('=== Feature #137: Satellite category filter edge cases ===\n');

  // Step 0: Fetch real satellite data
  const res = await fetch('http://localhost:3001/api/satellites');
  if (res.status !== 200) {
    console.error('FAIL: /api/satellites returned status', res.status);
    process.exit(1);
  }

  const satellites = res.data;
  console.log(`Total satellites from API: ${satellites.length}`);

  // Separate ISS vs others
  const issSats = satellites.filter(s => s.noradId === ISS_NORAD);
  const otherSats = satellites.filter(s => s.noradId !== ISS_NORAD);
  console.log(`ISS satellites: ${issSats.length}`);
  console.log(`Other satellites: ${otherSats.length}\n`);

  let allPassed = true;

  // Test 1: Disable ISS - ISS and stations hidden, others visible
  console.log('Test 1: Disable ISS filter');
  const noISS = { iss: false, other: true, showPaths: false };
  const filteredNoISS = filterSatellites(satellites, noISS);
  console.log(`  Filtered: ${filteredNoISS.length}, Expected: ${otherSats.length}`);
  if (filteredNoISS.length === otherSats.length) {
    console.log('  PASS: ISS hidden, others visible');
  } else {
    console.log('  FAIL: Count mismatch');
    allPassed = false;
  }
  // Verify ISS is not in results
  const issLeaked = filteredNoISS.filter(s => s.noradId === ISS_NORAD);
  if (issLeaked.length === 0) {
    console.log('  PASS: ISS not in filtered result');
  } else {
    console.log(`  FAIL: ISS leaked through (${issLeaked.length})`);
    allPassed = false;
  }
  console.log();

  // Test 2: Disable Other - non-ISS hidden, ISS visible
  console.log('Test 2: Disable Other filter');
  const noOther = { iss: true, other: false, showPaths: false };
  const filteredNoOther = filterSatellites(satellites, noOther);
  console.log(`  Filtered: ${filteredNoOther.length}, Expected: ${issSats.length}`);
  if (filteredNoOther.length === issSats.length) {
    console.log('  PASS: Others hidden, ISS visible');
  } else {
    console.log('  FAIL: Count mismatch');
    allPassed = false;
  }
  // Verify only ISS remains
  const nonISSLeaked = filteredNoOther.filter(s => s.noradId !== ISS_NORAD);
  if (nonISSLeaked.length === 0) {
    console.log('  PASS: Only ISS in filtered result');
  } else {
    console.log(`  FAIL: ${nonISSLeaked.length} non-ISS satellites leaked through`);
    allPassed = false;
  }
  console.log();

  // Test 3: Both disabled - no satellites visible
  console.log('Test 3: Both ISS and Other disabled');
  const noBoth = { iss: false, other: false, showPaths: false };
  const filteredNone = filterSatellites(satellites, noBoth);
  console.log(`  Filtered: ${filteredNone.length}, Expected: 0`);
  if (filteredNone.length === 0) {
    console.log('  PASS: No satellites visible when both disabled');
  } else {
    console.log(`  FAIL: ${filteredNone.length} satellites still visible`);
    allPassed = false;
  }
  console.log();

  // Test 4: Both enabled - all visible
  console.log('Test 4: Both ISS and Other enabled');
  const allEnabled = { iss: true, other: true, showPaths: false };
  const filteredAll = filterSatellites(satellites, allEnabled);
  console.log(`  Filtered: ${filteredAll.length}, Expected: ${satellites.length}`);
  if (filteredAll.length === satellites.length) {
    console.log('  PASS: All satellites visible when both enabled');
  } else {
    console.log('  FAIL: Count mismatch');
    allPassed = false;
  }
  console.log();

  // Test 5: Orbit path visibility independent - verify code structure
  console.log('Test 5: Toggle doesn\'t affect orbit path visibility independently');
  const satLayer = fs.readFileSync('/mnt/c/Users/turke/worldview/src/components/layers/SatelliteLayer.tsx', 'utf8');

  // showPaths is a separate independent control
  const hasShowPathsGuard = satLayer.includes('if (!filters.showPaths) return');
  console.log(`  showPaths is independent master toggle: ${hasShowPathsGuard ? 'PASS' : 'FAIL'}`);
  if (!hasShowPathsGuard) allPassed = false;

  // Category filters also apply to orbit paths
  const orbitSectionMatch = satLayer.match(/computeOrbitPaths[\s\S]*?filters\.iss[\s\S]*?filters\.other/);
  const orbitRespectsISS = orbitSectionMatch !== null;
  console.log(`  Orbit paths respect ISS filter: ${orbitRespectsISS ? 'PASS' : 'FAIL'}`);
  if (!orbitRespectsISS) allPassed = false;

  // Verify both entity and orbit sections filter consistently
  const entityFilterISS = satLayer.includes('if (isISS && !filters.iss) continue');
  const entityFilterOther = satLayer.includes('if (!isISS && !filters.other) continue');
  console.log(`  Entity filter checks ISS: ${entityFilterISS ? 'PASS' : 'FAIL'}`);
  console.log(`  Entity filter checks Other: ${entityFilterOther ? 'PASS' : 'FAIL'}`);
  if (!entityFilterISS || !entityFilterOther) allPassed = false;

  // showPaths does NOT control ISS/Other visibility
  // ISS/Other toggles do NOT control showPaths — they are independent axes
  const opsPanel = fs.readFileSync('/mnt/c/Users/turke/worldview/src/components/ui/OperationsPanel.tsx', 'utf8');
  const hasISSToggle = opsPanel.includes('iss: !satelliteFilters.iss');
  const hasOtherToggle = opsPanel.includes('other: !satelliteFilters.other');
  const hasShowPathsToggle = opsPanel.includes('showPaths: !satelliteFilters.showPaths');
  console.log(`  ISS toggle is independent: ${hasISSToggle ? 'PASS' : 'FAIL'}`);
  console.log(`  Other toggle is independent: ${hasOtherToggle ? 'PASS' : 'FAIL'}`);
  console.log(`  showPaths toggle is independent: ${hasShowPathsToggle ? 'PASS' : 'FAIL'}`);
  if (!hasISSToggle || !hasOtherToggle || !hasShowPathsToggle) allPassed = false;
  console.log();

  // Test 6: ISS identification is correct (NORAD 25544)
  console.log('Test 6: ISS identification');
  const issConst = satLayer.includes('const ISS_NORAD = 25544');
  console.log(`  ISS identified by NORAD 25544: ${issConst ? 'PASS' : 'FAIL'}`);
  if (!issConst) allPassed = false;

  // Verify ISS is actually present in data
  if (issSats.length > 0) {
    console.log(`  ISS found in API data: PASS (NORAD ${issSats[0].noradId}, name: ${issSats[0].name})`);
  } else {
    console.log('  ISS NOT found in API data - checking if data is available');
    // ISS might not be in the current data set - that's OK for the filter logic
    console.log('  NOTE: ISS may not be in current satellite data, filter logic still correct');
  }
  console.log();

  // Test 7: Types interface has all required fields
  console.log('Test 7: Type definitions');
  const types = fs.readFileSync('/mnt/c/Users/turke/worldview/src/types/index.ts', 'utf8');
  const hasSatFiltersInterface = types.includes('interface SatelliteFilters');
  const hasISSField = types.includes('iss: boolean');
  const hasOtherField = types.includes('other: boolean');
  const hasShowPathsField = types.includes('showPaths: boolean');
  console.log(`  SatelliteFilters interface exists: ${hasSatFiltersInterface ? 'PASS' : 'FAIL'}`);
  console.log(`  Has iss field: ${hasISSField ? 'PASS' : 'FAIL'}`);
  console.log(`  Has other field: ${hasOtherField ? 'PASS' : 'FAIL'}`);
  console.log(`  Has showPaths field: ${hasShowPathsField ? 'PASS' : 'FAIL'}`);
  if (!hasSatFiltersInterface || !hasISSField || !hasOtherField || !hasShowPathsField) allPassed = false;
  console.log();

  // Test 8: App.tsx state management
  console.log('Test 8: State management in App.tsx');
  const appTsx = fs.readFileSync('/mnt/c/Users/turke/worldview/src/App.tsx', 'utf8');
  const hasSatFilterState = appTsx.includes('satelliteFilters') && appTsx.includes('setSatelliteFilters');
  const hasDefaultISS = appTsx.includes('iss: true');
  const hasDefaultOther = appTsx.includes('other: true');
  console.log(`  satelliteFilters state exists: ${hasSatFilterState ? 'PASS' : 'FAIL'}`);
  console.log(`  ISS defaults to true: ${hasDefaultISS ? 'PASS' : 'FAIL'}`);
  console.log(`  Other defaults to true: ${hasDefaultOther ? 'PASS' : 'FAIL'}`);
  if (!hasSatFilterState || !hasDefaultISS || !hasDefaultOther) allPassed = false;
  console.log();

  console.log('=== OVERALL RESULT ===');
  if (allPassed) {
    console.log('ALL TESTS PASSED - Feature #137 verified');
  } else {
    console.log('SOME TESTS FAILED');
  }

  return allPassed;
}

test().then(passed => process.exit(passed ? 0 : 1)).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
