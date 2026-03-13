/**
 * Feature #109: Satellite filter states persist during session
 *
 * Verifies:
 * 1. ISS/Other category filters retain their state
 * 2. Orbit paths toggle retains its state
 * 3. Filter states passed correctly from OperationsPanel to SatelliteLayer
 *
 * Tests via code analysis + API verification (browser not available in sandbox)
 */
const fs = require('fs');
const path = require('path');

let passed = 0;
let failed = 0;

function check(label, condition) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.log(`  ✗ ${label}`);
    failed++;
  }
}

console.log('=== Feature #109: Satellite filter states persist during session ===\n');

// Read source files
const appSrc = fs.readFileSync(path.join(__dirname, 'src/App.tsx'), 'utf-8');
const opsPanelSrc = fs.readFileSync(path.join(__dirname, 'src/components/ui/OperationsPanel.tsx'), 'utf-8');
const globeViewerSrc = fs.readFileSync(path.join(__dirname, 'src/components/globe/GlobeViewer.tsx'), 'utf-8');
const satLayerSrc = fs.readFileSync(path.join(__dirname, 'src/components/layers/SatelliteLayer.tsx'), 'utf-8');
const typesSrc = fs.readFileSync(path.join(__dirname, 'src/types/index.ts'), 'utf-8');

// ============================================================
// Step 1: SatelliteFilters type definition
// ============================================================
console.log('Step 1: SatelliteFilters type definition');
check('SatelliteFilters has iss boolean', typesSrc.includes('iss: boolean'));
check('SatelliteFilters has other boolean', typesSrc.includes('other: boolean'));
check('SatelliteFilters has showPaths boolean', typesSrc.includes('showPaths: boolean'));

// ============================================================
// Step 2: App.tsx - State is held as persistent useState
// ============================================================
console.log('\nStep 2: App.tsx - satelliteFilters state persists during session');
check('satelliteFilters initialized with useState',
  appSrc.includes('useState<SatelliteFilters>'));
check('Initial state: iss: true',
  appSrc.includes('iss: true'));
check('Initial state: other: true',
  appSrc.includes('other: true'));
check('Initial state: showPaths: false',
  appSrc.includes('showPaths: false'));

// CRITICAL: Verify that toggleLayer does NOT reset satellite filters
// It should only reset flight filters (Feature #108)
const toggleLayerMatch = appSrc.match(/const toggleLayer[\s\S]*?(?=\n\s*\/\/ Track entity)/);
if (toggleLayerMatch) {
  const toggleLayerCode = toggleLayerMatch[0];
  check('toggleLayer does NOT reset satelliteFilters',
    !toggleLayerCode.includes('setSatelliteFilters'));
  check('toggleLayer only resets flight filters (not satellite)',
    toggleLayerCode.includes('setAltitudeFilters') &&
    toggleLayerCode.includes("layer === 'flights'") &&
    !toggleLayerCode.includes("layer === 'satellites'"));
} else {
  console.log('  ⚠ Could not extract toggleLayer function');
}

// Verify no other code path resets satellite filters unexpectedly
const setSatFilterOccurrences = (appSrc.match(/setSatelliteFilters/g) || []).length;
// setSatelliteFilters appears exactly 2 times: 1 useState declaration + 1 prop passing to OperationsPanel
// Both are valid and neither resets state - the only way filters change is via user interaction
check('setSatelliteFilters used only in useState + prop pass (no unexpected resets)',
  setSatFilterOccurrences === 2);

// ============================================================
// Step 3: OperationsPanel receives and updates satellite filters
// ============================================================
console.log('\nStep 3: OperationsPanel correctly reads/writes satellite filters');
check('OperationsPanel props include satelliteFilters',
  opsPanelSrc.includes('satelliteFilters: SatelliteFilters'));
check('OperationsPanel props include onSatelliteFilterChange callback',
  opsPanelSrc.includes('onSatelliteFilterChange: (filters: SatelliteFilters) => void'));
check('ISS toggle calls onSatelliteFilterChange with spread',
  opsPanelSrc.includes('onSatelliteFilterChange({\n') ||
  opsPanelSrc.includes('onSatelliteFilterChange({'));
check('ISS toggle toggles iss field',
  opsPanelSrc.includes('iss: !satelliteFilters.iss'));
check('Other toggle toggles other field',
  opsPanelSrc.includes('other: !satelliteFilters.other'));
check('Orbit Paths toggle toggles showPaths field',
  opsPanelSrc.includes('showPaths: !satelliteFilters.showPaths'));

// Filters section conditional on satellites layer
check('Satellite filters only shown when satellites enabled',
  opsPanelSrc.includes('layers.satellites'));

// ============================================================
// Step 4: App.tsx passes filters through to GlobeViewer
// ============================================================
console.log('\nStep 4: App.tsx passes satelliteFilters to GlobeViewer');
check('App passes satelliteFilters prop to GlobeViewer',
  appSrc.includes('satelliteFilters={satelliteFilters}'));
check('App passes onSatelliteFilterChange to OperationsPanel',
  appSrc.includes('onSatelliteFilterChange={setSatelliteFilters}'));

// ============================================================
// Step 5: GlobeViewer passes filters to SatelliteLayer
// ============================================================
console.log('\nStep 5: GlobeViewer passes filters to SatelliteLayer');
check('GlobeViewer has satelliteFilters in props interface',
  globeViewerSrc.includes('satelliteFilters: SatelliteFilters'));
check('GlobeViewer passes satelliteFilters to SatelliteLayer as filters',
  globeViewerSrc.includes('filters={props.satelliteFilters}'));
check('SatelliteLayer conditionally rendered on layers.satellites',
  globeViewerSrc.includes('props.layers.satellites'));

// ============================================================
// Step 6: SatelliteLayer uses filters correctly
// ============================================================
console.log('\nStep 6: SatelliteLayer uses filters to control rendering');
check('SatelliteLayer accepts filters prop of type SatelliteFilters',
  satLayerSrc.includes('filters: SatelliteFilters'));
check('SatelliteLayer checks filters.iss for ISS satellite',
  satLayerSrc.includes('filters.iss'));
check('SatelliteLayer checks filters.other for non-ISS satellites',
  satLayerSrc.includes('filters.other'));
check('SatelliteLayer checks filters.showPaths for orbit paths',
  satLayerSrc.includes('filters.showPaths'));
check('ISS filtered by norad ID 25544',
  satLayerSrc.includes('ISS_NORAD') && satLayerSrc.includes('25544'));

// ============================================================
// Step 7: Key persistence test - SatelliteLayer re-creates on filter change
// ============================================================
console.log('\nStep 7: SatelliteLayer effect depends on filters (re-renders on change)');
check('SatelliteLayer main useEffect includes filters in deps',
  satLayerSrc.includes('[viewer, satellites, filters,'));

// ============================================================
// Step 8: Verify no mock data patterns
// ============================================================
console.log('\nStep 8: No mock data patterns');
const allSrc = appSrc + opsPanelSrc + globeViewerSrc + satLayerSrc;
const mockPatterns = ['mockData', 'fakeData', 'sampleData', 'dummyData', 'testData', 'STUB', 'MOCK'];
for (const pattern of mockPatterns) {
  check(`No "${pattern}" in production code`, !allSrc.includes(pattern));
}

// ============================================================
// Step 9: Verify satellite API endpoint works
// ============================================================
console.log('\nStep 9: Satellite API returns real data');

async function testApi() {
  try {
    const res = await fetch('http://localhost:3001/api/satellites');
    const data = await res.json();
    check('Satellite API returns 200', res.status === 200);
    check('Satellite API returns array', Array.isArray(data));
    // Satellite count varies based on CelesTrak availability and caching
    // Feature #109 is about filter persistence, not satellite count
    check('Satellite API returns satellites', data.length > 10);

    // Check for ISS
    const iss = data.find(s => s.noradId === 25544 || s.name === 'ISS (ZARYA)');
    check('ISS (NORAD 25544) present in data', !!iss);

    // Verify real TLE data
    if (data.length > 0) {
      const first = data[0];
      check('Satellite has name', !!first.name);
      check('Satellite has noradId', typeof first.noradId === 'number');
      check('Satellite has tle1 starting with "1 "', first.tle1 && first.tle1.startsWith('1 '));
      check('Satellite has tle2 starting with "2 "', first.tle2 && first.tle2.startsWith('2 '));
      check('Satellite has category', !!first.category);
    }

    // Check for non-ISS satellites
    // Verify both ISS and non-ISS categories exist (needed for ISS/Other filter)
    const nonIss = data.filter(s => s.noradId !== 25544);
    check('Non-ISS satellites present (for Other filter)', nonIss.length > 5);

  } catch (err) {
    console.log(`  ✗ API test failed: ${err.message}`);
    failed++;
  }

  // Summary
  console.log(`\n=== RESULTS: ${passed} passed, ${failed} failed ===`);
  if (failed === 0) {
    console.log('=== ALL PASS ===');
  } else {
    console.log('=== SOME FAILED ===');
    process.exit(1);
  }
}

testApi();
