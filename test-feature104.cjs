const fs = require('fs');

const appTsx = fs.readFileSync('src/App.tsx', 'utf8');
const statusBar = fs.readFileSync('src/components/ui/StatusBar.tsx', 'utf8');
const globeViewer = fs.readFileSync('src/components/globe/GlobeViewer.tsx', 'utf8');
const types = fs.readFileSync('src/types/index.ts', 'utf8');

const checks = [];

// Check 1: CameraState type has all required fields (lat, lon, altitude, heading, pitch)
const hasCameraState = types.includes('interface CameraState') &&
  types.includes('lat: number') && types.includes('lon: number') &&
  types.includes('altitude: number') && types.includes('heading: number') &&
  types.includes('pitch: number');
checks.push({ name: 'CameraState type has lat/lon/altitude/heading/pitch', pass: hasCameraState });

// Check 2: App.tsx creates cameraState state and passes it to StatusBar
const hasCameraState2 = appTsx.includes('const [cameraState, setCameraState] = useState<CameraState>');
checks.push({ name: 'App.tsx has cameraState state', pass: hasCameraState2 });

// Check 3: App.tsx passes cameraState to StatusBar
const passesToStatusBar = appTsx.includes('cameraState={cameraState}');
checks.push({ name: 'cameraState passed to StatusBar', pass: passesToStatusBar });

// Check 4: GlobeViewer calls onCameraChange with camera position
const hasCameraSync = globeViewer.includes('camera.changed.addEventListener');
checks.push({ name: 'GlobeViewer listens to camera.changed event', pass: hasCameraSync });

// Check 5: onCameraChange extracts lat/lon/altitude/heading from Cesium camera
const extractsPos = globeViewer.includes('positionCartographic') &&
  globeViewer.includes('toDegrees(cartographic.latitude)') &&
  globeViewer.includes('toDegrees(cartographic.longitude)') &&
  globeViewer.includes('cartographic.height');
checks.push({ name: 'Extracts lat/lon/altitude from Cesium camera correctly', pass: extractsPos });

// Check 6: Heading extracted from camera
const extractsHeading = globeViewer.includes('toDegrees(camera.heading)');
checks.push({ name: 'Extracts heading from Cesium camera', pass: extractsHeading });

// Check 7: StatusBar displays lat in DMS format
const hasLatDisplay = statusBar.includes('toDMS(cameraState.lat, true)');
checks.push({ name: 'StatusBar displays latitude in DMS format', pass: hasLatDisplay });

// Check 8: StatusBar displays lon in DMS format
const hasLonDisplay = statusBar.includes('toDMS(cameraState.lon, false)');
checks.push({ name: 'StatusBar displays longitude in DMS format', pass: hasLonDisplay });

// Check 9: StatusBar displays altitude via formatAltitude
const hasAltDisplay = statusBar.includes('formatAltitude(cameraState.altitude)');
checks.push({ name: 'StatusBar displays altitude with formatAltitude', pass: hasAltDisplay });

// Check 10: StatusBar displays heading
const hasHdgDisplay = statusBar.includes('cameraState.heading');
checks.push({ name: 'StatusBar displays heading', pass: hasHdgDisplay });

// Check 11: percentageChanged threshold set (prevents missed updates)
const hasThreshold = globeViewer.includes('percentageChanged = 0.01');
checks.push({ name: 'Camera change threshold set to 0.01', pass: hasThreshold });

// Check 12: Initial camera state fired immediately (no stale data on mount)
const hasInitialFire = globeViewer.includes('// Fire once immediately') || globeViewer.includes('onChanged()');
checks.push({ name: 'Initial camera state fired on mount (no stale data)', pass: hasInitialFire });

// Check 13: App.tsx passes onCameraChange to GlobeViewer
const passesCallback = appTsx.includes('onCameraChange={setCameraState}');
checks.push({ name: 'onCameraChange callback passed to GlobeViewer', pass: passesCallback });

// Check 14: cameraState also feeds trafficBbox computation (cross-component sync)
const feedsTraffic = appTsx.includes('cameraState.altitude > 5_000_000') &&
  appTsx.includes('cameraState.lat') && appTsx.includes('cameraState.lon');
checks.push({ name: 'Camera state feeds traffic bbox computation', pass: feedsTraffic });

// Check 15: cameraState also feeds liveFlights enable logic (cross-component sync)
const feedsLiveFlights = appTsx.includes('cameraState.altitude < 500_000');
checks.push({ name: 'Camera state feeds live flights enable logic', pass: feedsLiveFlights });

// Check 16: Ref-based callback prevents stale closure issues
const hasCallbackRef = globeViewer.includes('onCameraChangeRef = useRef(props.onCameraChange)') &&
  globeViewer.includes('onCameraChangeRef.current = props.onCameraChange');
checks.push({ name: 'Ref-based callback prevents stale closure', pass: hasCallbackRef });

console.log('=== Feature #104: Camera state syncs across components ===');
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
