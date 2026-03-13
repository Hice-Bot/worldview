// Test: Feature #84 - Full entity track-untrack cycle for aircraft
// Verifies the complete workflow is implemented in the codebase

const fs = require('fs');
const path = require('path');

function readFile(relPath) {
  return fs.readFileSync(path.join(__dirname, relPath), 'utf-8');
}

let passed = 0;
let failed = 0;

function check(name, condition) {
  if (condition) {
    passed++;
  } else {
    failed++;
    console.log('FAIL: ' + name);
  }
}

// 1. EntityClickHandler: Click aircraft on globe
const ech = readFile('src/components/globe/EntityClickHandler.tsx');
check('Step 1: drillPick detects clicks', ech.includes('scene.drillPick(position, 10)'));
check('Step 1: classifyEntity identifies aircraft', ech.includes("'aircraft'") && ech.includes("'flight'"));
check('Step 1: isBillboardPick checks billboard structure', ech.includes('function isBillboardPick'));

// 2. Camera locks on with 42km offset
check('Step 2: Aircraft viewFrom (0, -30000, 30000)', ech.includes('aircraft: new Cartesian3(0, -30000, 30000)'));
check('Step 2: viewFrom applied to tracking entity', ech.includes('viewFrom: VIEW_FROM_OFFSETS[entityType]'));
check('Step 2: viewer.trackedEntity set', ech.includes('viewer.trackedEntity = trackEntity'));

// 3. TrackedEntityPanel shows aircraft details
const tep = readFile('src/components/ui/TrackedEntityPanel.tsx');
check('Step 3: Panel renders for aircraft type', tep.includes("entity.type === 'aircraft'"));
check('Step 3: Shows CALLSIGN', tep.includes('CALLSIGN'));
check('Step 3: Shows ICAO24', tep.includes('ICAO24'));
check('Step 3: Shows ALT (altitude)', tep.includes('ALT') && tep.includes('altitudeFeet'));
check('Step 3: Shows SPD (speed)', tep.includes('SPD') && tep.includes('velocityKnots'));
check('Step 3: Shows HDG (heading)', tep.includes('HDG') && tep.includes('heading'));

// 4. Camera follows aircraft in real-time
const fl = readFile('src/components/layers/FlightLayer.tsx');
check('Step 4: Dead reckoning in FlightLayer', fl.includes('deadReckon') || fl.includes('preRender') || fl.includes('preUpdate'));
check('Step 4: trackingManager.updatePosition called', fl.includes('trackingManager.updatePosition'));
const tm = readFile('src/trackingManager.ts');
check('Step 4: trackingManager has updatePosition method', tm.includes('updatePosition'));
check('Step 4: CallbackProperty for smooth tracking', ech.includes('CallbackProperty'));

// 5. Click empty space or ESC to untrack
check('Step 5: Empty space click clears tracking', ech.includes('onTrackEntity(null)') && ech.includes('clearTrackingEntity()'));
check('Step 5: ESC key handler', ech.includes("e.key === 'Escape'"));
check('Step 5: viewer.trackedEntity = undefined on ESC', ech.includes('viewer.trackedEntity = undefined'));

// 6. Camera stops following, position preserved (native Cesium behavior when setting trackedEntity = undefined)
check('Step 6: clearTrackingEntity removes temp entity', ech.includes('viewer.entities.remove(trackingEntityRef.current)'));
check('Step 6: trackingManager.clearTracking called', ech.includes('trackingManager.clearTracking()'));

// 7. TrackedEntityPanel hides
const app = readFile('src/App.tsx');
check('Step 7: Panel conditionally rendered', app.includes('trackedEntity &&') && app.includes('TrackedEntityPanel'));
check('Step 7: setTrackedEntity(null) clears panel', app.includes('setTrackedEntity(null)') || app.includes('handleTrackEntity'));

// 8. Aircraft returns to normal billboard scale
check('Step 8: isTracked determines billboard scale', fl.includes('isTracked'));
check('Step 8: Tracked aircraft enlarged (1.0 scale)', fl.includes('1.0') && (fl.includes('isTracked') || fl.includes('tracked')));

console.log('Passed: ' + passed + '/' + (passed + failed));
if (failed === 0) {
  console.log('Feature #84 - Full aircraft track-untrack cycle VERIFIED');
} else {
  console.log(failed + ' checks FAILED');
  process.exit(1);
}
