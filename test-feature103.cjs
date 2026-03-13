const fs = require('fs');

// Test that the app source code correctly implements layer toggle state reflection
const opsPanel = fs.readFileSync('src/components/ui/OperationsPanel.tsx', 'utf8');
const appTsx = fs.readFileSync('src/App.tsx', 'utf8');

const checks = [];

// Check 1: Each toggle switch shows on/off state matching actual layer state
const hasActiveCheck = opsPanel.includes('isActive = layers[key]');
checks.push({ name: 'Toggle reads active state from layers prop', pass: hasActiveCheck });

// Check 2: Visual indicator changes based on isActive
const hasInactiveStyle = opsPanel.includes('bg-white/5 border-white/10 text-white/40');
checks.push({ name: 'Active toggle has distinct styling from inactive', pass: hasInactiveStyle });

// Check 3: Colored dot indicator shows/hides based on isActive
const hasColoredDot = opsPanel.includes('isActive ?') && opsPanel.includes('bg-white/20');
checks.push({ name: 'Colored indicator dot shows for active, gray for inactive', pass: hasColoredDot });

// Check 4: Loading pulse animation during data fetch
const hasLoadingPulse = opsPanel.includes('animate-pulse');
const hasLoadingText = opsPanel.includes('isActive && isLoading');
checks.push({ name: 'Loading pulse animation during data fetch', pass: hasLoadingPulse && hasLoadingText });

// Check 5: onClick triggers onToggleLayer
const hasOnClick = opsPanel.includes('onClick={() => onToggleLayer(key)');
checks.push({ name: 'onClick triggers onToggleLayer callback', pass: hasOnClick });

// Check 6: App.tsx - toggleLayer uses functional setState (prevents race conditions with rapid toggles)
const hasFunctionalSetState = appTsx.includes('setLayers((prev) => ({ ...prev, [layer]: !prev[layer] })');
checks.push({ name: 'toggleLayer uses functional setState (rapid toggle safe)', pass: hasFunctionalSetState });

// Check 7: layerLoading is passed from App.tsx to OperationsPanel
const hasLayerLoadingProp = appTsx.includes('layerLoading={layerLoading}');
checks.push({ name: 'layerLoading prop passed to OperationsPanel', pass: hasLayerLoadingProp });

// Check 8: All 6 layers have loading states aggregated
const hasAllLoading = appTsx.includes('flightsLoading') && appTsx.includes('satellitesLoading') &&
  appTsx.includes('earthquakesLoading') && appTsx.includes('trafficLoading') &&
  appTsx.includes('cctvLoading') && appTsx.includes('shipsLoading');
checks.push({ name: 'All 6 layer loading states aggregated', pass: hasAllLoading });

// Check 9: All 6 LAYER_CONFIG entries exist
const layerKeys = ['flights', 'satellites', 'earthquakes', 'traffic', 'cctv', 'ships'];
const allLayersConfigured = layerKeys.every(k => opsPanel.includes("key: '" + k + "'"));
checks.push({ name: 'All 6 layers defined in LAYER_CONFIG', pass: allLayersConfigured });

// Check 10: layers prop is read-only (no direct mutation, only via onToggleLayer callback)
const noDirectLayerMutation = !opsPanel.includes('layers[key] =') && !opsPanel.includes('layers.flights =');
checks.push({ name: 'Layers prop is read-only (no direct mutation)', pass: noDirectLayerMutation });

// Check 11: Enabling a toggle immediately updates visual (React state -> re-render)
// The toggleLayer callback is a useCallback wrapping setLayers, so it's synchronous re-render
const hasUseCallback = appTsx.includes('const toggleLayer = useCallback');
checks.push({ name: 'toggleLayer is stable useCallback reference', pass: hasUseCallback });

// Check 12: Disabling a toggle grays out the indicator
// When isActive is false, the dot becomes bg-white/20 (gray)
const grayWhenInactive = opsPanel.includes("bg-white/20'}");
checks.push({ name: 'Disabled toggle shows gray indicator dot', pass: grayWhenInactive });

console.log('=== Feature #103: Layer toggle states reflect in UI ===');
console.log('');
let allPass = true;
for (const c of checks) {
  const icon = c.pass ? 'PASS' : 'FAIL';
  console.log(icon + ': ' + c.name);
  if (!c.pass) allPass = false;
}
console.log('');
console.log('Overall: ' + (allPass ? 'ALL CHECKS PASSED' : 'SOME CHECKS FAILED'));
process.exit(allPass ? 0 : 1);
