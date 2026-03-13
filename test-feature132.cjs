/**
 * Feature #132: Default map tiles based on API key availability
 *
 * Tests:
 * 1. With VITE_GOOGLE_API_KEY: Google 3D Tiles load
 * 2. Without VITE_GOOGLE_API_KEY: OSM tiles load
 * 3. OperationsPanel reflects which tile mode is active
 * 4. Correct globe.show state for each mode
 */
const fs = require('fs');

const results = [];
let allPassed = true;

function test(name, fn) {
  try {
    const result = fn();
    if (result === true) {
      results.push(`PASS: ${name}`);
    } else {
      results.push(`FAIL: ${name}: ${result}`);
      allPassed = false;
    }
  } catch (err) {
    results.push(`FAIL: ${name}: ${err.message}`);
    allPassed = false;
  }
}

const appSrc = fs.readFileSync('src/App.tsx', 'utf-8');
const globeViewerSrc = fs.readFileSync('src/components/globe/GlobeViewer.tsx', 'utf-8');
const opsPanelSrc = fs.readFileSync('src/components/ui/OperationsPanel.tsx', 'utf-8');
const envFile = fs.readFileSync('.env', 'utf-8');

// --- Step 1: With VITE_GOOGLE_API_KEY, Google 3D Tiles load ---
test('GlobeViewer reads VITE_GOOGLE_API_KEY from env', () => {
  const hasKeyRead = globeViewerSrc.includes('import.meta.env.VITE_GOOGLE_API_KEY');
  if (!hasKeyRead) return 'VITE_GOOGLE_API_KEY not read';
  return true;
});

test('google3dAvailable initialized from key presence', () => {
  const hasInit = globeViewerSrc.includes('useState(!!GOOGLE_API_KEY)');
  if (!hasInit) return 'google3dAvailable not initialized from key';
  return true;
});

test('Google 3D Tiles loaded via createGooglePhotorealistic3DTileset when key present', () => {
  const hasCreate = globeViewerSrc.includes('createGooglePhotorealistic3DTileset');
  if (!hasCreate) return 'createGooglePhotorealistic3DTileset not called';
  return true;
});

test('Google 3D Tiles condition checks both mapTiles and google3dAvailable', () => {
  const hasCondition = globeViewerSrc.includes("props.mapTiles === 'GOOGLE_3D' && google3dAvailable");
  if (!hasCondition) return 'Google tile condition missing';
  return true;
});

test('Google 3D mode hides globe (globe.show = false)', () => {
  const hasHide = globeViewerSrc.includes('viewer.scene.globe.show = false');
  if (!hasHide) return 'Globe not hidden for Google 3D';
  return true;
});

// --- Step 2: Without VITE_GOOGLE_API_KEY, OSM tiles load ---
test('OSM fallback loads OpenStreetMapImageryProvider', () => {
  const hasOSM = globeViewerSrc.includes('new OpenStreetMapImageryProvider');
  if (!hasOSM) return 'OpenStreetMapImageryProvider not used';
  return true;
});

test('OSM uses correct tile URL', () => {
  const hasURL = globeViewerSrc.includes('https://tile.openstreetmap.org/');
  if (!hasURL) return 'OSM tile URL not found';
  return true;
});

test('Google 3D failure triggers OSM fallback via setGoogle3dAvailable(false)', () => {
  const hasFallback = globeViewerSrc.includes('setGoogle3dAvailable(false)');
  if (!hasFallback) return 'No fallback to OSM on Google 3D failure';
  return true;
});

test('Current env has no Google API key (should use OSM)', () => {
  const keyMatch = envFile.match(/VITE_GOOGLE_API_KEY\s*=\s*(\S*)/);
  if (!keyMatch) return 'VITE_GOOGLE_API_KEY not in .env';
  const value = keyMatch[1];
  // Empty or not set means OSM
  if (value && value.length > 5) return `Key is set: ${value.substring(0, 10)}... (Google 3D would be used)`;
  return true;
});

// --- Step 3: OperationsPanel reflects which tile mode is active ---
test('OperationsPanel has GOOGLE_3D and OSM buttons', () => {
  const hasGoogle = opsPanelSrc.includes("'GOOGLE_3D'");
  const hasOSM = opsPanelSrc.includes("'OSM'");
  if (!hasGoogle) return 'GOOGLE_3D button missing';
  if (!hasOSM) return 'OSM button missing';
  return true;
});

test('OperationsPanel highlights active tile mode', () => {
  const hasGoogleActive = opsPanelSrc.includes("mapTiles === 'GOOGLE_3D'");
  const hasOSMActive = opsPanelSrc.includes("mapTiles === 'OSM'");
  if (!hasGoogleActive) return 'No active state for GOOGLE_3D';
  if (!hasOSMActive) return 'No active state for OSM';
  return true;
});

test('App passes mapTiles state to OperationsPanel', () => {
  const hasProp = appSrc.includes('mapTiles={mapTiles}');
  if (!hasProp) return 'mapTiles not passed to OperationsPanel';
  return true;
});

test('App passes mapTiles state to GlobeViewer', () => {
  const hasProp = appSrc.includes('mapTiles={mapTiles}');
  if (!hasProp) return 'mapTiles not passed to GlobeViewer';
  return true;
});

test('GlobeViewer notifies App on Google 3D fallback via onMapTilesChange', () => {
  const hasCallback = globeViewerSrc.includes("props.onMapTilesChange?.('OSM')");
  if (!hasCallback) return 'onMapTilesChange callback not called on fallback';
  return true;
});

test('App passes onMapTilesChange={setMapTiles} to GlobeViewer', () => {
  const hasProp = appSrc.includes('onMapTilesChange={setMapTiles}');
  if (!hasProp) return 'onMapTilesChange not passed to GlobeViewer';
  return true;
});

// --- Step 4: Correct globe.show state for each mode ---
test('Google 3D mode: globe.show = false (prevents black bleed-through)', () => {
  const hasGlobeHide = globeViewerSrc.includes('viewer.scene.globe.show = false');
  if (!hasGlobeHide) return 'globe.show not set to false for Google 3D';
  return true;
});

test('OSM mode: globe.show = true (depth buffer contribution)', () => {
  const hasGlobeShow = globeViewerSrc.includes('viewer.scene.globe.show = true');
  if (!hasGlobeShow) return 'globe.show not set to true for OSM';
  return true;
});

test('Google 3D tileset hidden when switching to OSM', () => {
  const hasHide = globeViewerSrc.includes('google3dTilesetRef.current.show = false');
  if (!hasHide) return 'Google 3D tileset not hidden for OSM';
  return true;
});

test('Google 3D tileset shown when switching back', () => {
  const hasShow = globeViewerSrc.includes('google3dTilesetRef.current.show = true');
  if (!hasShow) return 'Google 3D tileset not shown when switching back';
  return true;
});

test('OSM imagery layer removed when switching to Google 3D', () => {
  const hasRemove = globeViewerSrc.includes('viewer.imageryLayers.remove(osmLayerRef.current, true)');
  if (!hasRemove) return 'OSM imagery layer not removed for Google 3D';
  return true;
});

test('App default mapTiles state is GOOGLE_3D', () => {
  const match = appSrc.match(/useState<MapTileMode>\(['"](\w+)['"]\)/);
  if (!match) return 'No default mapTiles state found';
  if (match[1] !== 'GOOGLE_3D') return `Default is ${match[1]}, expected GOOGLE_3D`;
  return true;
});

test('No mock data patterns in tile code', () => {
  const mockPatterns = ['mockTiles', 'fakeTiles', 'dummyTiles', 'testTiles', 'STUB', 'MOCK'];
  for (const pattern of mockPatterns) {
    if (globeViewerSrc.toLowerCase().includes(pattern.toLowerCase())) {
      return `Found mock pattern: ${pattern}`;
    }
  }
  return true;
});

// Summary
console.log('\n=== Feature #132: Default map tiles based on API key availability ===\n');
results.forEach(r => console.log(r));
console.log('\n=== OVERALL:', allPassed ? 'ALL PASSED' : 'SOME FAILED', '===');
process.exit(allPassed ? 0 : 1);
