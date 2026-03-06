const fs = require('fs');

function checkHookPattern(name, filepath) {
  const code = fs.readFileSync(filepath, 'utf8');
  const results = {};

  // Check for enabled parameter
  results.hasEnabledParam = code.includes('enabled: boolean') || code.includes('enabled,');

  // Check for data clearing when disabled
  results.clearsDataWhenDisabled = code.includes('if (!enabled)') &&
    (code.includes('set') && code.includes('([])'));

  // Check for early return when disabled
  results.earlyReturnWhenDisabled = code.includes('if (!enabled)') && code.includes('return');

  // Check for polling/timeout cleanup
  results.hasCleanup = code.includes('clearTimeout') || code.includes('clearInterval');

  // Check for fetch function
  results.hasFetch = code.includes("fetch('/api/") || code.includes('fetch(`/api/');

  console.log(`\n--- ${name} (${filepath}) ---`);
  console.log('  Has enabled param:', results.hasEnabledParam);
  console.log('  Clears data when disabled:', results.clearsDataWhenDisabled);
  console.log('  Early return when disabled:', results.earlyReturnWhenDisabled);
  console.log('  Has polling cleanup:', results.hasCleanup);
  console.log('  Has fetch:', results.hasFetch);

  const allPass = Object.values(results).every(Boolean);
  console.log('  ALL CHECKS:', allPass ? 'PASS' : 'FAIL');
  return allPass;
}

function checkLayerConditionalRender() {
  const globeViewer = fs.readFileSync('src/components/globe/GlobeViewer.tsx', 'utf8');

  const layers = [
    { name: 'flights', pattern: 'props.layers.flights && ' },
    { name: 'satellites', pattern: 'props.layers.satellites && ' },
    { name: 'earthquakes', pattern: 'props.layers.earthquakes && ' },
    { name: 'traffic', pattern: 'props.layers.traffic && ' },
    { name: 'ships', pattern: 'props.layers.ships && ' },
    { name: 'cctv', pattern: 'props.layers.cctv && ' },
  ];

  console.log('\n--- GlobeViewer Conditional Rendering ---');
  let allPass = true;
  for (const layer of layers) {
    const found = globeViewer.includes(layer.pattern);
    console.log(`  ${layer.name} conditional render:`, found);
    if (!found) allPass = false;
  }
  console.log('  ALL CHECKS:', allPass ? 'PASS' : 'FAIL');
  return allPass;
}

function checkToggleHandler() {
  const app = fs.readFileSync('src/App.tsx', 'utf8');

  console.log('\n--- App.tsx Toggle Coordination ---');

  // Check for LayerState type
  const hasLayerState = app.includes('LayerState');
  console.log('  Uses LayerState type:', hasLayerState);

  // Check for toggleLayer handler
  const hasToggleLayer = app.includes('toggleLayer');
  console.log('  Has toggleLayer handler:', hasToggleLayer);

  // Check each hook is called with correct enabled flag
  const hooks = [
    { name: 'useFlights', pattern: 'useFlights(layers.flights)' },
    { name: 'useSatellites', pattern: 'useSatellites(layers.satellites)' },
    { name: 'useEarthquakes', pattern: 'useEarthquakes(layers.earthquakes)' },
    { name: 'useTraffic', pattern: 'useTraffic(layers.traffic' },
    { name: 'useShips', pattern: 'useShips(layers.ships)' },
    { name: 'useCameras', pattern: 'useCameras(layers.cctv)' },
  ];

  let allPass = hasLayerState && hasToggleLayer;
  for (const hook of hooks) {
    const found = app.includes(hook.pattern);
    console.log(`  ${hook.name} receives enabled flag:`, found);
    if (!found) allPass = false;
  }

  // Check layers initial state
  const hasFlightsDefault = app.includes('flights: true');
  const hasSatellitesDefault = app.includes('satellites: false');
  console.log('  flights defaults to true:', hasFlightsDefault);
  console.log('  satellites defaults to false:', hasSatellitesDefault);

  // Check all 6 layer toggles are independent
  const hasIndependentToggle = app.includes("setLayers((prev) => ({ ...prev, [layer]: !prev[layer] }))");
  console.log('  Independent toggle (spread + toggle):', hasIndependentToggle);

  console.log('  ALL CHECKS:', allPass ? 'PASS' : 'FAIL');
  return allPass;
}

function checkLayerCleanup(name, filepath) {
  const code = fs.readFileSync(filepath, 'utf8');

  // Check for cleanup of Cesium primitives on unmount
  const hasCleanup = code.includes('primitives.remove') ||
    code.includes('removeAll') ||
    code.includes('viewer.entities.removeAll') ||
    code.includes('destroy()');

  console.log(`  ${name} has primitive cleanup on unmount: ${hasCleanup}`);
  return hasCleanup;
}

console.log('=== Feature #55: Layer toggle routing and data fetch coordination ===');

console.log('\n=== STEP 1: Hook-level enable/disable checks ===');
const hooks = [
  ['useFlights', 'src/hooks/useFlights.ts'],
  ['useSatellites', 'src/hooks/useSatellites.ts'],
  ['useEarthquakes', 'src/hooks/useEarthquakes.ts'],
  ['useTraffic', 'src/hooks/useTraffic.ts'],
  ['useShips', 'src/hooks/useShips.ts'],
  ['useCameras', 'src/hooks/useCameras.ts'],
];

let allHooksPass = true;
for (const [name, path] of hooks) {
  if (!checkHookPattern(name, path)) allHooksPass = false;
}

console.log('\n=== STEP 2: GlobeViewer conditional rendering ===');
const rendersPass = checkLayerConditionalRender();

console.log('\n=== STEP 3: App.tsx toggle coordination ===');
const togglePass = checkToggleHandler();

console.log('\n=== STEP 4: Layer cleanup on unmount ===');
const layerFiles = [
  ['FlightLayer', 'src/components/layers/FlightLayer.tsx'],
  ['SatelliteLayer', 'src/components/layers/SatelliteLayer.tsx'],
  ['EarthquakeLayer', 'src/components/layers/EarthquakeLayer.tsx'],
  ['TrafficLayer', 'src/components/layers/TrafficLayer.tsx'],
  ['ShipLayer', 'src/components/layers/ShipLayer.tsx'],
  ['CCTVLayer', 'src/components/layers/CCTVLayer.tsx'],
];

for (const [name, path] of layerFiles) {
  checkLayerCleanup(name, path);
}

console.log('\n=== SUMMARY ===');
console.log('All hooks handle enabled/disabled:', allHooksPass);
console.log('All layers conditionally rendered:', rendersPass);
console.log('Toggle coordination works:', togglePass);
console.log('\n=== Feature #55 verification complete ===');
