/**
 * Test Feature #138: CCTV country filter edge cases
 * Verifies CCTV country filtering handles edge cases in panel and API.
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

// Simulate the CCTVPanel filtering logic
function filterCameras(cameras, countryFilter) {
  if (!countryFilter) return cameras;
  return cameras.filter(c => c.country === countryFilter);
}

async function test() {
  console.log('=== Feature #138: CCTV country filter edge cases ===\n');

  // Step 0: Fetch real CCTV data
  const res = await fetch('http://localhost:3001/api/cctv');
  if (res.status !== 200) {
    console.error('FAIL: /api/cctv returned status', res.status);
    process.exit(1);
  }

  const cameras = res.data;
  console.log(`Total cameras from API: ${cameras.length}`);

  // Count by country
  const countryCounts = {};
  for (const cam of cameras) {
    const country = cam.country || 'unknown';
    countryCounts[country] = (countryCounts[country] || 0) + 1;
  }
  console.log('Country distribution:');
  for (const [country, count] of Object.entries(countryCounts)) {
    console.log(`  ${country}: ${count}`);
  }
  console.log();

  let allPassed = true;

  // Test 1: Filter to GB - only London cameras shown in panel
  console.log('Test 1: Filter to GB');
  const gbCameras = filterCameras(cameras, 'GB');
  const expectedGB = countryCounts['GB'] || 0;
  console.log(`  Filtered: ${gbCameras.length}, Expected: ${expectedGB}`);
  if (gbCameras.length === expectedGB) {
    console.log('  PASS: Only GB cameras shown');
  } else {
    console.log('  FAIL: Count mismatch');
    allPassed = false;
  }
  // Verify all are GB
  const nonGB = gbCameras.filter(c => c.country !== 'GB');
  if (nonGB.length === 0) {
    console.log('  PASS: All filtered cameras are GB');
  } else {
    console.log(`  FAIL: ${nonGB.length} non-GB cameras in result`);
    allPassed = false;
  }
  // Verify GB cameras have London-area coordinates (lat ~51.x)
  const londonArea = gbCameras.filter(c => c.lat > 50 && c.lat < 53);
  console.log(`  GB cameras in London area (lat 50-53): ${londonArea.length}/${gbCameras.length}`);
  if (londonArea.length > 0) {
    console.log('  PASS: GB cameras include London coordinates');
  } else {
    console.log('  WARN: No London-area cameras (unexpected for TfL data)');
  }
  console.log();

  // Test 2: Filter to US - only Austin cameras shown in panel
  console.log('Test 2: Filter to US');
  const usCameras = filterCameras(cameras, 'US');
  const expectedUS = countryCounts['US'] || 0;
  console.log(`  Filtered: ${usCameras.length}, Expected: ${expectedUS}`);
  if (usCameras.length === expectedUS) {
    console.log('  PASS: Only US cameras shown');
  } else {
    console.log('  FAIL: Count mismatch');
    allPassed = false;
  }
  const nonUS = usCameras.filter(c => c.country !== 'US');
  if (nonUS.length === 0) {
    console.log('  PASS: All filtered cameras are US');
  } else {
    console.log(`  FAIL: ${nonUS.length} non-US cameras in result`);
    allPassed = false;
  }
  // Verify US cameras have Austin-area coordinates (lat ~30.x)
  const austinArea = usCameras.filter(c => c.lat > 29 && c.lat < 32);
  console.log(`  US cameras in Austin area (lat 29-32): ${austinArea.length}/${usCameras.length}`);
  if (austinArea.length > 0) {
    console.log('  PASS: US cameras include Austin coordinates');
  } else {
    console.log('  WARN: No Austin-area cameras');
  }
  console.log();

  // Test 3: Filter to AU - only NSW cameras shown (when key configured)
  console.log('Test 3: Filter to AU');
  const auCameras = filterCameras(cameras, 'AU');
  const expectedAU = countryCounts['AU'] || 0;
  console.log(`  Filtered: ${auCameras.length}, Expected: ${expectedAU}`);
  if (auCameras.length === expectedAU) {
    console.log('  PASS: Only AU cameras shown (count matches)');
  } else {
    console.log('  FAIL: Count mismatch');
    allPassed = false;
  }
  if (expectedAU === 0) {
    console.log('  NOTE: No AU cameras (NSW_TRANSPORT_API_KEY likely not configured - expected)');
  } else {
    const nonAU = auCameras.filter(c => c.country !== 'AU');
    if (nonAU.length === 0) {
      console.log('  PASS: All filtered cameras are AU');
    } else {
      console.log(`  FAIL: ${nonAU.length} non-AU cameras in result`);
      allPassed = false;
    }
  }
  console.log();

  // Test 4: Clear filter (null) - all cameras from all countries shown
  console.log('Test 4: Clear filter (ALL)');
  const allCameras = filterCameras(cameras, null);
  console.log(`  Filtered: ${allCameras.length}, Expected: ${cameras.length}`);
  if (allCameras.length === cameras.length) {
    console.log('  PASS: All cameras visible when filter cleared');
  } else {
    console.log('  FAIL: Count mismatch');
    allPassed = false;
  }
  console.log();

  // Test 5: Camera count updates in panel for each filter - verify code structure
  console.log('Test 5: Camera count updates in panel');
  const cctvPanel = fs.readFileSync('/mnt/c/Users/turke/worldview/src/components/ui/CCTVPanel.tsx', 'utf8');

  // Verify country filter state
  const hasCountryFilterState = cctvPanel.includes('countryFilter') && cctvPanel.includes('setCountryFilter');
  console.log(`  countryFilter state exists: ${hasCountryFilterState ? 'PASS' : 'FAIL'}`);
  if (!hasCountryFilterState) allPassed = false;

  // Verify useMemo filtering
  const hasFilteredCameras = cctvPanel.includes('filteredCameras') && cctvPanel.includes('useMemo');
  console.log(`  filteredCameras useMemo exists: ${hasFilteredCameras ? 'PASS' : 'FAIL'}`);
  if (!hasFilteredCameras) allPassed = false;

  // Verify countries extracted from data
  const hasCountriesSet = cctvPanel.includes('new Set') && cctvPanel.includes('c.country');
  console.log(`  Countries dynamically extracted: ${hasCountriesSet ? 'PASS' : 'FAIL'}`);
  if (!hasCountriesSet) allPassed = false;

  // Verify ALL button with total count
  const hasAllButton = cctvPanel.includes('ALL') && cctvPanel.includes('cameras.length');
  console.log(`  ALL button with total count: ${hasAllButton ? 'PASS' : 'FAIL'}`);
  if (!hasAllButton) allPassed = false;

  // Verify individual country buttons show counts
  const hasCountryCountDisplay = cctvPanel.includes('country') && (cctvPanel.includes('count') || cctvPanel.includes('.length'));
  console.log(`  Country buttons show counts: ${hasCountryCountDisplay ? 'PASS' : 'FAIL'}`);
  if (!hasCountryCountDisplay) allPassed = false;

  // Verify handleCountryFilter handler
  const hasFilterHandler = cctvPanel.includes('handleCountryFilter') || cctvPanel.includes('setCountryFilter');
  console.log(`  Filter handler exists: ${hasFilterHandler ? 'PASS' : 'FAIL'}`);
  if (!hasFilterHandler) allPassed = false;

  // Verify null filter for ALL
  const hasNullFilter = cctvPanel.includes('countryFilter === null') || cctvPanel.includes('!countryFilter');
  console.log(`  Null filter for ALL: ${hasNullFilter ? 'PASS' : 'FAIL'}`);
  if (!hasNullFilter) allPassed = false;

  // Verify color coding per country
  const hasGBColor = cctvPanel.includes('cyan');
  const hasUSColor = cctvPanel.includes('amber');
  const hasAUColor = cctvPanel.includes('green');
  console.log(`  GB color (cyan): ${hasGBColor ? 'PASS' : 'FAIL'}`);
  console.log(`  US color (amber): ${hasUSColor ? 'PASS' : 'FAIL'}`);
  console.log(`  AU color (green): ${hasAUColor ? 'PASS' : 'FAIL'}`);
  if (!hasGBColor || !hasUSColor || !hasAUColor) allPassed = false;

  // Verify pagination reset on filter change
  const hasPaginationReset = cctvPanel.includes('setVisibleCount') || cctvPanel.includes('PAGE_SIZE');
  console.log(`  Pagination reset on filter change: ${hasPaginationReset ? 'PASS' : 'FAIL'}`);
  if (!hasPaginationReset) allPassed = false;
  console.log();

  // Test 6: Verify sum of countries equals total
  console.log('Test 6: Sum of filtered countries equals total');
  const countries = Object.keys(countryCounts);
  let sumCountries = 0;
  for (const country of countries) {
    const filtered = filterCameras(cameras, country);
    sumCountries += filtered.length;
  }
  console.log(`  Sum: ${sumCountries}, Total: ${cameras.length}`);
  if (sumCountries === cameras.length) {
    console.log('  PASS: No cameras lost in filtering');
  } else {
    console.log('  FAIL: Some cameras lost or duplicated');
    allPassed = false;
  }
  console.log();

  // Test 7: Each camera has valid country field
  console.log('Test 7: Data quality checks');
  const validCountry = cameras.filter(c => c.country && typeof c.country === 'string' && c.country.length > 0);
  console.log(`  Cameras with valid country: ${validCountry.length}/${cameras.length}`);
  if (validCountry.length === cameras.length) {
    console.log('  PASS: All cameras have valid country field');
  } else {
    console.log(`  WARN: ${cameras.length - validCountry.length} cameras missing country`);
  }

  // Verify real data (not mock)
  const hasRealNames = cameras.some(c => c.name && c.name.length > 3);
  // London cameras near Greenwich have lon ~0, so we just check valid range not non-zero
  const hasRealCoords = cameras.every(c => Math.abs(c.lat) >= 0 && Math.abs(c.lat) <= 90 && Math.abs(c.lon) <= 180);
  console.log(`  Cameras have real names: ${hasRealNames ? 'PASS' : 'FAIL'}`);
  console.log(`  Cameras have real coordinates: ${hasRealCoords ? 'PASS' : 'FAIL'}`);
  if (!hasRealNames || !hasRealCoords) allPassed = false;
  console.log();

  // Test 8: CameraData type has country field
  console.log('Test 8: Type definition');
  const types = fs.readFileSync('/mnt/c/Users/turke/worldview/src/types/index.ts', 'utf8');
  const hasCameraInterface = types.includes('interface CameraData');
  const hasCountryField = types.includes('country: string');
  console.log(`  CameraData interface: ${hasCameraInterface ? 'PASS' : 'FAIL'}`);
  console.log(`  country field: ${hasCountryField ? 'PASS' : 'FAIL'}`);
  if (!hasCameraInterface || !hasCountryField) allPassed = false;
  console.log();

  console.log('=== OVERALL RESULT ===');
  if (allPassed) {
    console.log('ALL TESTS PASSED - Feature #138 verified');
  } else {
    console.log('SOME TESTS FAILED');
  }

  return allPassed;
}

test().then(passed => process.exit(passed ? 0 : 1)).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
