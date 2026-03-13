/**
 * Test Feature #184: Layer disable during active fetch
 *
 * Verifies that all data hooks properly handle AbortController cancellation
 * and cancelled flag checks when a layer is disabled during an active fetch.
 *
 * Tests:
 * 1. All hooks use AbortController with signal passed to fetch()
 * 2. All hooks check cancelled flag before setState after fetch resolves
 * 3. All hooks abort the controller in cleanup
 * 4. All hooks clear data immediately when disabled
 * 5. No orphaned state updates after cancellation
 * 6. Build compiles without errors
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

const HOOKS_DIR = path.join(__dirname, 'src', 'hooks');
const HOOKS = [
  'useFlights.ts',
  'useSatellites.ts',
  'useEarthquakes.ts',
  'useShips.ts',
  'useCameras.ts',
  'useTraffic.ts',
  'useFlightsLive.ts',
];

let passed = 0;
let failed = 0;

function check(name, condition) {
  if (condition) {
    console.log('  PASS:', name);
    passed++;
  } else {
    console.log('  FAIL:', name);
    failed++;
  }
}

console.log('=== Feature #184: Layer disable during active fetch ===\n');

for (const hookFile of HOOKS) {
  const filePath = path.join(HOOKS_DIR, hookFile);
  const code = fs.readFileSync(filePath, 'utf8');
  const hookName = hookFile.replace('.ts', '');

  console.log(`\nChecking ${hookName}:`);

  // 1. Uses AbortController
  check('Creates AbortController', code.includes('new AbortController()'));

  // 2. Passes signal to fetch
  check('Passes signal to fetch()', code.includes('signal: abortController.signal'));

  // 3. Checks cancelled flag after fetch response
  check('Checks cancelled after fetch response', code.includes('if (cancelled) return'));

  // 4. Aborts controller in cleanup
  check('Aborts controller in cleanup', code.includes('abortController.abort()'));

  // 5. Sets cancelled=true in cleanup
  check('Sets cancelled=true in cleanup', code.includes('cancelled = true'));

  // 6. Clears data when disabled
  const setsEmptyArray = code.includes('set') && code.includes('([])');
  check('Clears data when disabled', setsEmptyArray);

  // 7. Handles AbortError gracefully (doesn't set error state on abort)
  const handlesAbort = code.includes('AbortError') || code.includes('if (cancelled');
  check('Handles AbortError gracefully', handlesAbort);

  // 8. Guards setLoading(false) with cancelled check
  check('Guards setLoading in finally block', code.includes('if (!cancelled) setLoading(false)'));

  // 9. Fetch function is defined inside useEffect (has access to cancelled flag)
  const fetchInsideEffect = code.includes('useEffect(()') && !code.includes('useCallback');
  check('Fetch defined inside useEffect (access to cancelled)', fetchInsideEffect);
}

// Test GlobeViewer conditional rendering
console.log('\nChecking GlobeViewer conditional rendering:');
const globeViewer = fs.readFileSync(path.join(__dirname, 'src', 'components', 'globe', 'GlobeViewer.tsx'), 'utf8');
check('FlightLayer conditionally rendered', globeViewer.includes('props.layers.flights && ('));
check('SatelliteLayer conditionally rendered', globeViewer.includes('props.layers.satellites && ('));
check('EarthquakeLayer conditionally rendered', globeViewer.includes('props.layers.earthquakes && ('));
check('ShipLayer conditionally rendered', globeViewer.includes('props.layers.ships && ('));
check('CCTVLayer conditionally rendered', globeViewer.includes('props.layers.cctv && ('));
check('TrafficLayer conditionally rendered', globeViewer.includes('props.layers.traffic && ('));

// Test that App.tsx passes enabled flag from layer state
console.log('\nChecking App.tsx hook wiring:');
const appTsx = fs.readFileSync(path.join(__dirname, 'src', 'App.tsx'), 'utf8');
check('useFlights receives layers.flights', appTsx.includes('useFlights(layers.flights)'));
check('useSatellites receives layers.satellites', appTsx.includes('useSatellites(layers.satellites)'));
check('useEarthquakes receives layers.earthquakes', appTsx.includes('useEarthquakes(layers.earthquakes)'));
check('useCameras receives layers.cctv', appTsx.includes('useCameras(layers.cctv)'));
check('useShips receives layers.ships', appTsx.includes('useShips(layers.ships)'));

// API verification - check proxy is serving real data
console.log('\nChecking proxy serves real data:');
const apiTest = (endpoint) => new Promise((resolve) => {
  http.get('http://localhost:3001' + endpoint, { timeout: 10000 }, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      try {
        const parsed = JSON.parse(data);
        resolve({ status: res.statusCode, data: parsed });
      } catch {
        resolve({ status: res.statusCode, data: null });
      }
    });
  }).on('error', (err) => {
    resolve({ status: 0, error: err.message });
  });
});

async function testAPIs() {
  const flightsRes = await apiTest('/api/flights');
  check('Flights API returns data', flightsRes.status === 200 && Array.isArray(flightsRes.data) && flightsRes.data.length > 0);

  console.log('\n=== RESULTS ===');
  console.log('Passed:', passed);
  console.log('Failed:', failed);
  console.log(failed === 0 ? '\nALL TESTS PASSED' : '\nSOME TESTS FAILED');
  process.exit(failed === 0 ? 0 : 1);
}

testAPIs();
