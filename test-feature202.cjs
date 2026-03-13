/**
 * Test Feature #202: No memory leaks over extended sessions
 *
 * Static analysis verification that all cleanup patterns are properly implemented.
 * Checks: intervals, event listeners, primitive collections, data array replacement,
 * AbortController usage, Map/Set cleanup.
 */
const fs = require('fs');
const path = require('path');

const results = [];
let passed = 0;
let failed = 0;

function test(name, condition, detail) {
  if (condition) {
    passed++;
    results.push(`PASS: ${name}${detail ? ' — ' + detail : ''}`);
  } else {
    failed++;
    results.push(`FAIL: ${name}${detail ? ' — ' + detail : ''}`);
  }
}

function readSrc(relativePath) {
  return fs.readFileSync(path.join(__dirname, 'src', relativePath), 'utf8');
}

// ---------- Layer Components ----------
const flightLayer = readSrc('components/layers/FlightLayer.tsx');
const shipLayer = readSrc('components/layers/ShipLayer.tsx');
const cctvLayer = readSrc('components/layers/CCTVLayer.tsx');
const satLayer = readSrc('components/layers/SatelliteLayer.tsx');
const eqLayer = readSrc('components/layers/EarthquakeLayer.tsx');
const trafficLayer = readSrc('components/layers/TrafficLayer.tsx');

// ---------- Data Hooks ----------
const useFlights = readSrc('hooks/useFlights.ts');
const useSatellites = readSrc('hooks/useSatellites.ts');
const useShips = readSrc('hooks/useShips.ts');
const useCameras = readSrc('hooks/useCameras.ts');
const useEarthquakes = readSrc('hooks/useEarthquakes.ts');
const useTraffic = readSrc('hooks/useTraffic.ts');

// ============================================================================
// 1. INTERVAL CLEANUP
// ============================================================================
test('SatelliteLayer: propagation interval has clearInterval in cleanup',
  satLayer.includes('clearInterval(propagationIntervalRef.current)'));

test('SatelliteLayer: orbit interval has clearInterval in cleanup',
  satLayer.includes('clearInterval(orbitIntervalRef.current)'));

const statusBar = readSrc('components/ui/StatusBar.tsx');
test('StatusBar: UTC clock interval has clearInterval',
  statusBar.includes('clearInterval(interval)'));

// ============================================================================
// 2. EVENT LISTENER CLEANUP
// ============================================================================
test('FlightLayer: preRender listener removed in cleanup',
  flightLayer.includes('removeEventListener') && flightLayer.includes('preRender'));

test('ShipLayer: preRender listener removed in cleanup',
  shipLayer.includes('removeEventListener') && shipLayer.includes('preRender'));

test('CCTVLayer: preRender listener removed in cleanup',
  cctvLayer.includes('removeEventListener') && cctvLayer.includes('preRender'));

test('EarthquakeLayer: preRender listener removed in cleanup',
  eqLayer.includes('removeEventListener') && eqLayer.includes('preRender'));

test('TrafficLayer: requestAnimationFrame canceled in cleanup',
  trafficLayer.includes('cancelAnimationFrame'));

// ============================================================================
// 3. PRIMITIVE COLLECTIONS: STALE ENTRY REMOVAL
// ============================================================================
test('FlightLayer: removes stale aircraft billboards',
  flightLayer.includes('bbCollection.remove(entry.billboard)') &&
  flightLayer.includes('existingMap.delete(id)'),
  'billboards + labels + trails + arcs removed');

test('FlightLayer: removes stale labels',
  flightLayer.includes('lblCollection.remove(entry.label)'));

test('FlightLayer: removes stale heading trails',
  flightLayer.includes('trailCollection.remove(entry.headingTrail)'));

test('FlightLayer: removes stale route arcs',
  flightLayer.includes('routeCollection.remove(entry.routeArcCompleted)') &&
  flightLayer.includes('routeCollection.remove(entry.routeArcRemaining)'));

test('ShipLayer: removes stale ship billboards',
  shipLayer.includes('.remove(entry.billboard)') &&
  shipLayer.includes('.delete(id)'));

test('ShipLayer: removes stale ship labels',
  shipLayer.includes('.remove(entry.label)'));

test('CCTVLayer: removes stale camera billboards',
  cctvLayer.includes('.remove(entry.billboard)') &&
  cctvLayer.includes('.delete(id)'));

test('CCTVLayer: removes stale camera labels',
  cctvLayer.includes('.remove(entry.label)'));

test('SatelliteLayer: removes stale satellite entities',
  satLayer.includes('.delete(noradId)') || satLayer.includes('.delete('));

test('EarthquakeLayer: clears collections on update (no accumulation)',
  eqLayer.includes('removeAll()') || eqLayer.includes('.remove('));

test('TrafficLayer: clears collections on refresh',
  trafficLayer.includes('removeAll()'));

// ============================================================================
// 4. DATA ARRAYS REPLACED (NOT APPENDED) ON REFRESH
// ============================================================================
test('useFlights: state replaced (not appended)',
  useFlights.includes('setFlights(') && !useFlights.includes('prev =>') && !useFlights.includes('...prev'));

test('useSatellites: state replaced (not appended)',
  useSatellites.includes('setSatellites(') && !useSatellites.includes('prev =>') && !useSatellites.includes('...prev'));

test('useShips: state replaced (not appended)',
  useShips.includes('setShips(') && !useShips.includes('prev =>') && !useShips.includes('...prev'));

test('useCameras: state replaced (not appended)',
  useCameras.includes('setCameras(') && !useCameras.includes('prev =>') && !useCameras.includes('...prev'));

test('useEarthquakes: state replaced (not appended)',
  useEarthquakes.includes('setEarthquakes(') && !useEarthquakes.includes('prev =>') && !useEarthquakes.includes('...prev'));

test('useTraffic: state replaced (not appended)',
  useTraffic.includes('setRoads(') && !useTraffic.includes('prev =>') && !useTraffic.includes('...prev'));

// ============================================================================
// 5. ABORTCONTROLLER CLEANUP
// ============================================================================
const hooks = [
  { name: 'useFlights', code: useFlights },
  { name: 'useSatellites', code: useSatellites },
  { name: 'useShips', code: useShips },
  { name: 'useCameras', code: useCameras },
  { name: 'useEarthquakes', code: useEarthquakes },
  { name: 'useTraffic', code: useTraffic },
];

for (const { name, code } of hooks) {
  test(`${name}: creates AbortController`,
    code.includes('new AbortController()'));
  test(`${name}: aborts on cleanup`,
    code.includes('abortController.abort()') || code.includes('.abort()'));
}

// ============================================================================
// 6. MAP/SET CLEANUP ON UNMOUNT
// ============================================================================
test('FlightLayer: clears map on unmount',
  flightLayer.includes('flightMapRef.current.clear()'));

test('ShipLayer: clears map on unmount',
  shipLayer.includes('shipMapRef.current.clear()'));

test('CCTVLayer: clears map on unmount',
  cctvLayer.includes('cameraMapRef.current.clear()'));

// ============================================================================
// 7. VIEWER DESTRUCTION SAFETY CHECKS
// ============================================================================
test('FlightLayer: checks viewer.isDestroyed()',
  flightLayer.includes('viewer.isDestroyed()'));

test('ShipLayer: checks viewer.isDestroyed()',
  shipLayer.includes('viewer.isDestroyed()'));

test('CCTVLayer: checks viewer.isDestroyed()',
  cctvLayer.includes('viewer.isDestroyed()'));

test('SatelliteLayer: checks viewer.isDestroyed()',
  satLayer.includes('viewer.isDestroyed()'));

// ============================================================================
// 8. SERVER-SIDE MEMORY MANAGEMENT
// ============================================================================
const serverCode = fs.readFileSync(path.join(__dirname, 'server/index.js'), 'utf8');

test('Server: node-cache has checkperiod for expired key cleanup',
  serverCode.includes('checkperiod'));

test('Server: route registry prunes old entries (>6hr)',
  serverCode.includes('routeRegistry.delete') && serverCode.includes('6 * 3600000'));

test('Server: in-flight requests cleaned up after completion',
  serverCode.includes('inflightRequests.delete(cacheKey)'));

// ============================================================================
// HOOKS DATA CLEARING WHEN LAYER DISABLED
// ============================================================================
test('useFlights: clears data when disabled',
  useFlights.includes('setFlights([])'));

test('useSatellites: clears data when disabled',
  useSatellites.includes('setSatellites([])'));

test('useShips: clears data when disabled',
  useShips.includes('setShips([])'));

test('useCameras: clears data when disabled',
  useCameras.includes('setCameras([])'));

test('useEarthquakes: clears data when disabled',
  useEarthquakes.includes('setEarthquakes([])'));

test('useTraffic: clears data when disabled',
  useTraffic.includes('setRoads([])'));

// ============================================================================
// SUMMARY
// ============================================================================
const total = passed + failed;
results.push('');
results.push(`Results: ${passed}/${total} passed, ${failed} failed`);

fs.writeFileSync('/tmp/f202.txt', results.join('\n'));
