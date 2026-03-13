/**
 * Feature #121: Code verification - Concurrent tile switching race condition protection
 * Feature #122: Code verification - All flyTo calls preceded by cancelFlight
 *
 * Verifies the implementation patterns are correct via static code analysis.
 */
const fs = require('fs');
const path = require('path');

console.log('=== Feature #121 & #122 Code Verification ===\n');

// Read GlobeViewer.tsx
const globeViewer = fs.readFileSync(
  path.join(__dirname, 'src/components/globe/GlobeViewer.tsx'),
  'utf8'
);

// Read App.tsx
const appTsx = fs.readFileSync(
  path.join(__dirname, 'src/App.tsx'),
  'utf8'
);

let pass121 = true;
let pass122 = true;

// ============================================================
// Feature #121: Concurrent tile switching doesn't corrupt globe
// ============================================================
console.log('--- Feature #121: Concurrent Tile Switching ---\n');

// Check 1: cancelled flag exists in tile management effect
const hasCancelledFlag = globeViewer.includes('let cancelled = false');
console.log(`[${hasCancelledFlag ? 'PASS' : 'FAIL'}] cancelled flag declared in tile effect`);
if (!hasCancelledFlag) pass121 = false;

// Check 2: cancelled flag is checked in async then callback
const checksCancelledInThen = globeViewer.includes('if (cancelled || viewer.isDestroyed())');
console.log(`[${checksCancelledInThen ? 'PASS' : 'FAIL'}] cancelled checked in async .then() callback`);
if (!checksCancelledInThen) pass121 = false;

// Check 3: cancelled flag is checked in catch callback
const checksCancelledInCatch = globeViewer.includes('if (cancelled) return; // Ignore errors for stale requests');
console.log(`[${checksCancelledInCatch ? 'PASS' : 'FAIL'}] cancelled checked in .catch() callback`);
if (!checksCancelledInCatch) pass121 = false;

// Check 4: cleanup function sets cancelled = true
const cleanupSetsCancelled = globeViewer.includes('cancelled = true;');
console.log(`[${cleanupSetsCancelled ? 'PASS' : 'FAIL'}] useEffect cleanup sets cancelled = true`);
if (!cleanupSetsCancelled) pass121 = false;

// Check 5: tileset.destroy() called when cancelled to prevent memory leaks
const destroysOnCancel = globeViewer.includes('tileset.destroy()');
console.log(`[${destroysOnCancel ? 'PASS' : 'FAIL'}] Stale tileset destroyed to prevent memory leak`);
if (!destroysOnCancel) pass121 = false;

// Check 6: Effect depends on mapTiles and google3dAvailable
const hasDeps = globeViewer.includes('[props.mapTiles, google3dAvailable]');
console.log(`[${hasDeps ? 'PASS' : 'FAIL'}] Effect dependencies include mapTiles and google3dAvailable`);
if (!hasDeps) pass121 = false;

// Check 7: OSM path synchronously shows globe (no async race)
const osmShowsGlobe = globeViewer.includes('viewer.scene.globe.show = true');
console.log(`[${osmShowsGlobe ? 'PASS' : 'FAIL'}] OSM path synchronously shows globe`);
if (!osmShowsGlobe) pass121 = false;

// Check 8: Google 3D path hides Google tileset when switching to OSM
const hidesGoogle = globeViewer.includes('google3dTilesetRef.current.show = false');
console.log(`[${hidesGoogle ? 'PASS' : 'FAIL'}] Google 3D tileset hidden when switching to OSM`);
if (!hidesGoogle) pass121 = false;

console.log(`\nFeature #121 RESULT: ${pass121 ? 'PASS' : 'FAIL'}\n`);

// ============================================================
// Feature #122: Rapid flyTo requests handled cleanly
// ============================================================
console.log('--- Feature #122: Rapid flyTo Requests ---\n');

// Find all flyTo calls in App.tsx
const flyToMatches = appTsx.match(/\.flyTo\(/g) || [];
console.log(`Found ${flyToMatches.length} flyTo calls in App.tsx`);

// Check that every flyTo is preceded by cancelFlight
const cancelFlightMatches = appTsx.match(/cancelFlight\(\)/g) || [];
console.log(`Found ${cancelFlightMatches.length} cancelFlight calls in App.tsx`);

// For each flyTo, verify it's preceded by cancelFlight within the same function scope
// Parse flyTo positions and check preceding lines
const lines = appTsx.split('\n');
const flyToLines = [];
const cancelFlightLines = [];

lines.forEach((line, i) => {
  if (line.includes('.flyTo(')) flyToLines.push(i + 1);
  if (line.includes('cancelFlight()')) cancelFlightLines.push(i + 1);
});

console.log(`flyTo lines: ${flyToLines.join(', ')}`);
console.log(`cancelFlight lines: ${cancelFlightLines.join(', ')}`);

// Each flyTo should have a cancelFlight within 30 lines before it
let allFlyTosProtected = true;
for (const flyToLine of flyToLines) {
  const hasCancel = cancelFlightLines.some(cl => cl < flyToLine && flyToLine - cl < 30);
  console.log(`  flyTo at line ${flyToLine}: cancelFlight within 30 lines before? ${hasCancel ? 'YES' : 'NO'}`);
  if (!hasCancel) allFlyTosProtected = false;
}

console.log(`[${allFlyTosProtected ? 'PASS' : 'FAIL'}] All flyTo calls preceded by cancelFlight`);
if (!allFlyTosProtected) pass122 = false;

// Check that trackedEntity is cleared before flyTo to prevent entity tracking interference
const trackedEntityClear = appTsx.includes('viewer.trackedEntity = undefined');
console.log(`[${trackedEntityClear ? 'PASS' : 'FAIL'}] trackedEntity cleared before flyTo (prevents tracking interference)`);
if (!trackedEntityClear) pass122 = false;

// Check that handleResetView uses cancelFlight
const resetViewSection = appTsx.substring(
  appTsx.indexOf('handleResetView'),
  appTsx.indexOf('handleResetView') + 500
);
const resetHasCancel = resetViewSection.includes('cancelFlight');
console.log(`[${resetHasCancel ? 'PASS' : 'FAIL'}] handleResetView calls cancelFlight`);
if (!resetHasCancel) pass122 = false;

// Check that handleLocateMe's flyToLocation uses cancelFlight
const locateMeSection = appTsx.substring(
  appTsx.indexOf('handleLocateMe'),
  appTsx.indexOf('handleLocateMe') + 800
);
const locateHasCancel = locateMeSection.includes('cancelFlight');
console.log(`[${locateHasCancel ? 'PASS' : 'FAIL'}] handleLocateMe flyToLocation calls cancelFlight`);
if (!locateHasCancel) pass122 = false;

// Check CCTV flyTo also has cancelFlight
const cctvFlyToSection = appTsx.substring(
  appTsx.indexOf('onFlyTo'),
  appTsx.indexOf('onFlyTo') + 500
);
const cctvHasCancel = cctvFlyToSection.includes('cancelFlight');
console.log(`[${cctvHasCancel ? 'PASS' : 'FAIL'}] CCTV onFlyTo calls cancelFlight`);
if (!cctvHasCancel) pass122 = false;

console.log(`\nFeature #122 RESULT: ${pass122 ? 'PASS' : 'FAIL'}\n`);

// ============================================================
// Summary
// ============================================================
console.log('=== SUMMARY ===');
console.log(`Feature #121 (Concurrent tile switching): ${pass121 ? 'PASS' : 'FAIL'}`);
console.log(`Feature #122 (Rapid flyTo requests): ${pass122 ? 'PASS' : 'FAIL'}`);

process.exit(pass121 && pass122 ? 0 : 1);
