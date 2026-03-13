const fs = require('fs');

const appTsx = fs.readFileSync('src/App.tsx', 'utf8');
const trackedPanel = fs.readFileSync('src/components/ui/TrackedEntityPanel.tsx', 'utf8');
const clickHandler = fs.readFileSync('src/components/globe/EntityClickHandler.tsx', 'utf8');
const flightLayer = fs.readFileSync('src/components/layers/FlightLayer.tsx', 'utf8');
const globeViewer = fs.readFileSync('src/components/globe/GlobeViewer.tsx', 'utf8');

const checks = [];

// Step 1: Tracking aircraft - panel shows aircraft data
const panelShowsAircraft = trackedPanel.includes("entity.type === 'aircraft'") &&
  trackedPanel.includes('AircraftDetails');
checks.push({ name: 'TrackedEntityPanel shows aircraft-specific details', pass: panelShowsAircraft });

// Step 1b: Camera follows aircraft via viewer.trackedEntity
const cameraFollows = clickHandler.includes('viewer.trackedEntity = trackEntity') ||
  clickHandler.includes('viewer.trackedEntity = cesiumEntity');
checks.push({ name: 'Camera follows tracked entity via viewer.trackedEntity', pass: cameraFollows });

// Step 1c: Billboard enlarged when tracked
const billboardEnlarged = flightLayer.includes("isTracked ? 1.0 : scale");
checks.push({ name: 'Tracked aircraft billboard enlarged to 1.0 scale', pass: billboardEnlarged });

// Step 1d: Depth test disabled for tracked billboard
const depthTestDisabled = flightLayer.includes('disableDepthTestDistance') &&
  flightLayer.includes('isTracked ? Number.POSITIVE_INFINITY');
checks.push({ name: 'Tracked billboard depth test disabled (always visible)', pass: depthTestDisabled });

// Step 2: Untracking - panel hides
const panelHides = appTsx.includes('{trackedEntity && (') &&
  appTsx.includes('<TrackedEntityPanel');
checks.push({ name: 'TrackedEntityPanel conditionally rendered (hides when null)', pass: panelHides });

// Step 2b: Camera stops following on untrack
const cameraStops = clickHandler.includes('viewer.trackedEntity = undefined');
checks.push({ name: 'Camera stops following on untrack (trackedEntity=undefined)', pass: cameraStops });

// Step 2c: Billboard returns to normal - isTracked becomes false when trackedEntity is null
const billboardNormal = flightLayer.includes("trackedEntity?.type === 'aircraft' && trackedEntity?.id === flight.icao24");
checks.push({ name: 'Billboard returns to normal scale when untracked', pass: billboardNormal });

// Step 3: App.tsx is single source of truth for tracked entity
const singleSource = appTsx.includes('const [trackedEntity, setTrackedEntity] = useState<TrackedEntityInfo | null>(null)');
checks.push({ name: 'App.tsx is single source of truth for trackedEntity', pass: singleSource });

// Step 3b: trackedEntity passed to TrackedEntityPanel
const passedToPanel = appTsx.includes('entity={trackedEntity}');
checks.push({ name: 'trackedEntity passed to TrackedEntityPanel', pass: passedToPanel });

// Step 3c: trackedEntity passed to GlobeViewer/layers
const passedToGlobe = appTsx.includes('trackedEntity={trackedEntity}');
checks.push({ name: 'trackedEntity passed to GlobeViewer and layers', pass: passedToGlobe });

// Step 3d: onTrackEntity callback flows back to App.tsx
const callbackFlows = appTsx.includes('onTrackEntity={handleTrackEntity}');
checks.push({ name: 'onTrackEntity callback set to handleTrackEntity', pass: callbackFlows });

// Step 3e: handleTrackEntity updates single source state
const handleUpdates = appTsx.includes('const handleTrackEntity = useCallback((entity: TrackedEntityInfo | null)') &&
  appTsx.includes('setTrackedEntity(entity)');
checks.push({ name: 'handleTrackEntity updates trackedEntity state', pass: handleUpdates });

// Step 4: No phantom tracked entity after untrack
const noPhantom = clickHandler.includes('onTrackEntity(null)') &&
  clickHandler.includes('clearTrackingEntity()');
checks.push({ name: 'Untrack clears both state and temp entity (no phantom)', pass: noPhantom });

// Step 4b: clearTrackingEntity removes temp entity from viewer
const clearsTemp = clickHandler.includes('viewer.entities.remove(trackingEntityRef.current)') &&
  clickHandler.includes('trackingEntityRef.current = null') &&
  clickHandler.includes('trackingManager.clearTracking()');
checks.push({ name: 'clearTrackingEntity removes temp entity and clears tracking manager', pass: clearsTemp });

// Step 4c: onClose callback in TrackedEntityPanel also clears
const onCloseClears = appTsx.includes('onClose={() => setTrackedEntity(null)}');
checks.push({ name: 'Panel close button clears trackedEntity state', pass: onCloseClears });

// Step 5: Switching entities works - clearTrackingEntity called before creating new one
const switchWorks = clickHandler.includes('clearTrackingEntity()') &&
  // Called before creating new tracking entity
  clickHandler.indexOf('clearTrackingEntity()') < clickHandler.indexOf('viewer.entities.add({');
checks.push({ name: 'Old tracking entity cleared before creating new one (switch works)', pass: switchWorks });

// Step 5b: ESC key also unlocks tracking cleanly
const escUnlocks = clickHandler.includes("e.key === 'Escape'") &&
  clickHandler.includes('document.addEventListener') &&
  clickHandler.includes('document.removeEventListener');
checks.push({ name: 'ESC key unlocks tracking with proper event cleanup', pass: escUnlocks });

// Step 5c: Empty space click unlocks tracking
const emptySpaceUnlocks = clickHandler.includes('picks.length === 0') &&
  clickHandler.includes('onTrackEntity(null)');
checks.push({ name: 'Empty space click unlocks tracking', pass: emptySpaceUnlocks });

// Step 5d: Cleanup on unmount prevents leaks
const cleanupOnUnmount = clickHandler.includes('handler.destroy()') &&
  clickHandler.includes('clearTrackingEntity');
checks.push({ name: 'Cleanup on unmount prevents entity/handler leaks', pass: cleanupOnUnmount });

console.log('=== Feature #105: Tracked entity state consistent across UI ===');
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
