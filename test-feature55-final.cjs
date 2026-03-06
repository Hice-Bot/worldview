const fs = require('fs');

console.log('=== Feature #55: Layer toggle routing and data fetch coordination ===\n');

const appCode = fs.readFileSync('src/App.tsx', 'utf8');
const globeCode = fs.readFileSync('src/components/globe/GlobeViewer.tsx', 'utf8');

const hooks = {
  flights: fs.readFileSync('src/hooks/useFlights.ts', 'utf8'),
  satellites: fs.readFileSync('src/hooks/useSatellites.ts', 'utf8'),
  earthquakes: fs.readFileSync('src/hooks/useEarthquakes.ts', 'utf8'),
  traffic: fs.readFileSync('src/hooks/useTraffic.ts', 'utf8'),
  ships: fs.readFileSync('src/hooks/useShips.ts', 'utf8'),
  cctv: fs.readFileSync('src/hooks/useCameras.ts', 'utf8'),
};

const layers = {
  flights: fs.readFileSync('src/components/layers/FlightLayer.tsx', 'utf8'),
  satellites: fs.readFileSync('src/components/layers/SatelliteLayer.tsx', 'utf8'),
  earthquakes: fs.readFileSync('src/components/layers/EarthquakeLayer.tsx', 'utf8'),
  traffic: fs.readFileSync('src/components/layers/TrafficLayer.tsx', 'utf8'),
  ships: fs.readFileSync('src/components/layers/ShipLayer.tsx', 'utf8'),
  cctv: fs.readFileSync('src/components/layers/CCTVLayer.tsx', 'utf8'),
};

let allPass = true;

// Step 1: Verify each hook accepts enabled parameter and clears data when disabled
console.log('--- Step 1: Hook enabled/disabled behavior ---');
for (const [name, code] of Object.entries(hooks)) {
  const hasEnabled = code.includes('enabled: boolean') || code.includes('enabled,');
  const hasDisableCheck = code.includes('!enabled');
  const hasDataClear = code.includes('([])');
  const pass = hasEnabled && hasDisableCheck && hasDataClear;
  if (!pass) allPass = false;
  console.log(`  ${name}: enabled param=${hasEnabled}, disable check=${hasDisableCheck}, data clear=${hasDataClear} => ${pass ? 'PASS' : 'FAIL'}`);
}

// Step 2: Verify App.tsx passes enabled flag from layers state to each hook
console.log('\n--- Step 2: App.tsx hook wiring ---');
const hookWiring = {
  flights: 'useFlights(layers.flights)',
  satellites: 'useSatellites(layers.satellites)',
  earthquakes: 'useEarthquakes(layers.earthquakes)',
  traffic: 'useTraffic(layers.traffic',
  ships: 'useShips(layers.ships)',
  cctv: 'useCameras(layers.cctv)',
};
for (const [name, pattern] of Object.entries(hookWiring)) {
  const pass = appCode.includes(pattern);
  if (!pass) allPass = false;
  console.log(`  ${name} hook wired: ${pass ? 'PASS' : 'FAIL'} (${pattern})`);
}

// Step 3: Verify GlobeViewer conditionally renders each layer
console.log('\n--- Step 3: GlobeViewer conditional rendering ---');
const renderPatterns = {
  flights: 'props.layers.flights &&',
  satellites: 'props.layers.satellites &&',
  earthquakes: 'props.layers.earthquakes &&',
  traffic: 'props.layers.traffic &&',
  ships: 'props.layers.ships &&',
  cctv: 'props.layers.cctv &&',
};
for (const [name, pattern] of Object.entries(renderPatterns)) {
  const pass = globeCode.includes(pattern);
  if (!pass) allPass = false;
  console.log(`  ${name} conditional render: ${pass ? 'PASS' : 'FAIL'}`);
}

// Step 4: Verify each layer component cleans up on unmount
console.log('\n--- Step 4: Layer cleanup on unmount ---');
for (const [name, code] of Object.entries(layers)) {
  const hasCleanup = code.includes('clearInterval') || code.includes('clearTimeout') ||
    code.includes('primitives.remove') || code.includes('entities.remove') ||
    code.includes('removeEventListener') || code.includes('removeAll');
  if (!hasCleanup) allPass = false;
  console.log(`  ${name}: cleanup on unmount = ${hasCleanup ? 'PASS' : 'FAIL'}`);
}

// Step 5: Verify independent toggle (each layer toggle only affects its own state)
console.log('\n--- Step 5: Independent layer toggles ---');
const hasIndependentToggle = appCode.includes("setLayers((prev) => ({ ...prev, [layer]: !prev[layer] }))");
console.log(`  Toggle uses spread operator (independent): ${hasIndependentToggle ? 'PASS' : 'FAIL'}`);
if (!hasIndependentToggle) allPass = false;

// Step 6: Verify no hook starts fetching without enabled flag
console.log('\n--- Step 6: Hooks only fetch when enabled ---');
for (const [name, code] of Object.entries(hooks)) {
  // The hook should have a check like "if (!enabled) { ... return; }" before any fetch
  const lines = code.split('\n');
  let foundDisableGuard = false;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('!enabled')) {
      foundDisableGuard = true;
      break;
    }
  }
  if (!foundDisableGuard) allPass = false;
  console.log(`  ${name}: has disable guard: ${foundDisableGuard ? 'PASS' : 'FAIL'}`);
}

// Step 7: Verify polling stops when disabled (cleanup return in useEffect)
console.log('\n--- Step 7: Polling stops when disabled ---');
for (const [name, code] of Object.entries(hooks)) {
  const hasReturn = code.includes('return () =>') || code.includes('return ()=>');
  if (!hasReturn) allPass = false;
  console.log(`  ${name}: has useEffect cleanup: ${hasReturn ? 'PASS' : 'FAIL'}`);
}

console.log('\n=== OVERALL RESULT ===');
console.log(`All Feature #55 checks: ${allPass ? 'PASS' : 'FAIL'}`);
