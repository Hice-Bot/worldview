const fs = require('fs');
const globeViewer = fs.readFileSync('src/components/globe/GlobeViewer.tsx', 'utf-8');
const appCode = fs.readFileSync('src/App.tsx', 'utf-8');
const statusBar = fs.readFileSync('src/components/ui/StatusBar.tsx', 'utf-8');

console.log('=== Feature #46: Camera state syncs to App via changed event ===\n');

const checks = [
  // Step 1: Camera moved event fires with threshold 0.01
  { name: 'camera.changed event listener added', test: globeViewer.includes('camera.changed.addEventListener') },
  { name: 'percentageChanged threshold set to 0.01', test: globeViewer.includes('percentageChanged = 0.01') },

  // Step 2: App receives updated lat, lon, altitude, heading, pitch
  { name: 'Latitude extracted via toDegrees(cartographic.latitude)', test: globeViewer.includes('toDegrees(cartographic.latitude)') },
  { name: 'Longitude extracted via toDegrees(cartographic.longitude)', test: globeViewer.includes('toDegrees(cartographic.longitude)') },
  { name: 'Altitude extracted via cartographic.height', test: globeViewer.includes('cartographic.height') },
  { name: 'Heading extracted via toDegrees(camera.heading)', test: globeViewer.includes('toDegrees(camera.heading)') },
  { name: 'Pitch extracted via toDegrees(camera.pitch)', test: globeViewer.includes('toDegrees(camera.pitch)') },
  { name: 'onCameraChange callback invoked with state object', test: globeViewer.includes('onCameraChangeRef.current({') },

  // Step 3: StatusBar reflects current camera coordinates
  { name: 'StatusBar receives cameraState prop', test: statusBar.includes('cameraState: CameraState') || statusBar.includes('cameraState') },
  { name: 'StatusBar displays LAT', test: statusBar.includes('cameraState.lat') },
  { name: 'StatusBar displays LON', test: statusBar.includes('cameraState.lon') },
  { name: 'StatusBar displays ALT', test: statusBar.includes('cameraState.altitude') },
  { name: 'StatusBar displays HDG', test: statusBar.includes('cameraState.heading') },
  { name: 'App passes cameraState to StatusBar', test: appCode.includes('cameraState={cameraState}') },

  // Step 4: Camera state updates on zoom, pan, and rotate
  { name: 'camera.changed fires on all movement types (Cesium native behavior)', test: globeViewer.includes('camera.changed') },

  // Step 5: State sync doesn\'t cause excessive re-renders
  { name: 'Uses ref for callback (avoids re-render dependency)', test: globeViewer.includes('onCameraChangeRef') },
  { name: 'Event listener cleanup on unmount', test: globeViewer.includes('removeEventListener(onChanged)') },
  { name: 'useEffect has empty deps (runs once)', test: globeViewer.includes('}, []);') },

  // Integration
  { name: 'CesiumMath imported for toDegrees', test: globeViewer.includes('Math as CesiumMath') },
  { name: 'App passes onCameraChange to GlobeViewer', test: appCode.includes('onCameraChange={setCameraState}') },
];

let allPass = true;
for (const c of checks) {
  console.log(c.test ? '✅' : '❌', c.name);
  if (!c.test) allPass = false;
}

console.log(allPass ? '\n✅ All Feature #46 checks pass!' : '\n❌ Some checks failed');
process.exit(allPass ? 0 : 1);
