/**
 * Feature #116: Multiple entity clicks handled correctly
 *
 * Tests:
 * 1. Click handler clears previous tracking before creating new tracking
 * 2. Only one tracking entity exists at a time
 * 3. Previous tracking state is fully cleaned up
 * 4. No camera jitter from conflicting tracks
 * 5. Double-click guard prevents duplicate tracking
 * 6. ESC key clears all tracking state
 */
const fs = require('fs');

const results = [];
let allPassed = true;

function test(name, fn) {
  try {
    const result = fn();
    if (result === true) {
      results.push(`✅ ${name}`);
    } else {
      results.push(`❌ ${name}: ${result}`);
      allPassed = false;
    }
  } catch (err) {
    results.push(`❌ ${name}: ${err.message}`);
    allPassed = false;
  }
}

function readFile(path) {
  return fs.readFileSync(path, 'utf-8');
}

const clickHandler = readFile('src/components/globe/EntityClickHandler.tsx');
const trackingMgr = readFile('src/trackingManager.ts');
const appCode = readFile('src/App.tsx');

// Test 1: clearTrackingEntity called before creating new billboard tracking entity
test('Billboard picks: clearTrackingEntity called before creating new tracking', () => {
  // In the billboard pick handling section, clearTrackingEntity must come before
  // the creation of new tracking entity
  const bbSection = clickHandler.match(/if \(bbPick\)[\s\S]*?clearTrackingEntity\(\);[\s\S]*?viewer\.entities\.add\(/);
  if (!bbSection) {
    return 'clearTrackingEntity() not called before viewer.entities.add() in billboard picks';
  }
  return true;
});

// Test 2: clearTrackingEntity called before setting new Cesium entity
test('Cesium entity picks: clearTrackingEntity called before setting viewer.trackedEntity', () => {
  // In the Cesium entity pick section (satellite), clearTrackingEntity before viewer.trackedEntity
  const cesiumSection = clickHandler.match(/clearTrackingEntity\(\);[\s\S]*?currentTrackingIdRef\.current = entityId;[\s\S]*?viewer\.trackedEntity = cesiumEntity/);
  if (!cesiumSection) {
    return 'clearTrackingEntity() not called before viewer.trackedEntity in Cesium entity picks';
  }
  return true;
});

// Test 3: CCTV picks: clearTrackingEntity called before creating new tracking
test('CCTV picks: clearTrackingEntity called before creating new tracking entity', () => {
  const cctvSection = clickHandler.match(/entityType === 'cctv'[\s\S]*?clearTrackingEntity\(\);[\s\S]*?viewer\.entities\.add\(/);
  if (!cctvSection) {
    return 'clearTrackingEntity() not called before viewer.entities.add() in CCTV picks';
  }
  return true;
});

// Test 4: clearTrackingEntity removes the tracking entity from viewer.entities
test('clearTrackingEntity removes entity from viewer', () => {
  if (!clickHandler.includes('viewer.entities.remove(trackingEntityRef.current)')) {
    return 'Missing viewer.entities.remove() in clearTrackingEntity';
  }
  return true;
});

// Test 5: clearTrackingEntity clears trackingManager
test('clearTrackingEntity clears trackingManager state', () => {
  if (!clickHandler.includes('trackingManager.clearTracking()')) {
    return 'Missing trackingManager.clearTracking() in clearTrackingEntity';
  }
  return true;
});

// Test 6: clearTrackingEntity nullifies currentTrackingIdRef
test('clearTrackingEntity nullifies currentTrackingIdRef', () => {
  if (!clickHandler.includes('currentTrackingIdRef.current = null')) {
    return 'Missing currentTrackingIdRef.current = null in clearTrackingEntity';
  }
  return true;
});

// Test 7: clearTrackingEntity nullifies trackingEntityRef
test('clearTrackingEntity nullifies trackingEntityRef', () => {
  if (!clickHandler.includes('trackingEntityRef.current = null')) {
    return 'Missing trackingEntityRef.current = null in clearTrackingEntity';
  }
  return true;
});

// Test 8: Only one tracking entity ref maintained
test('Single trackingEntityRef prevents multiple simultaneous tracking entities', () => {
  // Should be exactly one trackingEntityRef declaration
  const refDeclarations = clickHandler.match(/const trackingEntityRef = useRef</g) || [];
  if (refDeclarations.length !== 1) {
    return `Expected 1 trackingEntityRef declaration, found ${refDeclarations.length}`;
  }
  return true;
});

// Test 9: Double-click guard exists and uses currentTrackingIdRef
test('Double-click guard prevents duplicate tracking on same entity', () => {
  // Must have debounce check
  if (!clickHandler.includes('CLICK_DEBOUNCE_MS')) {
    return 'Missing CLICK_DEBOUNCE_MS debounce constant';
  }

  // Must check if clicking same entity
  if (!clickHandler.includes('clickedEntityId === currentTrackingIdRef.current')) {
    return 'Missing check for clicking same entity';
  }

  // Must check time threshold
  if (!clickHandler.includes('lastClickTimeRef.current < CLICK_DEBOUNCE_MS')) {
    return 'Missing time threshold check';
  }

  return true;
});

// Test 10: Same-entity double-click on CCTV also guarded
test('CCTV double-click guard prevents re-creation of tracking entity', () => {
  if (!clickHandler.includes('currentTrackingIdRef.current === cameraData.id && trackingEntityRef.current')) {
    return 'Missing CCTV same-entity guard check';
  }
  return true;
});

// Test 11: ESC key clears all tracking state
test('ESC key handler clears onTrackEntity, onCctvClick, viewer.trackedEntity, and tracking entity', () => {
  // Find the ESC handler block by index to avoid regex issues with nested braces
  var idx = clickHandler.indexOf("e.key === 'Escape'");
  if (idx === -1) {
    return 'Missing ESC key handler';
  }

  var escCode = clickHandler.substring(idx, idx + 300);
  if (!escCode.includes('onTrackEntity(null)')) {
    return 'ESC handler missing onTrackEntity(null)';
  }
  if (!escCode.includes('onCctvClick(null)')) {
    return 'ESC handler missing onCctvClick(null)';
  }
  if (!escCode.includes('viewer.trackedEntity')) {
    return 'ESC handler missing viewer.trackedEntity cleanup';
  }
  if (!escCode.includes('clearTrackingEntity()')) {
    return 'ESC handler missing clearTrackingEntity()';
  }

  return true;
});

// Test 12: Empty space click clears all tracking state
test('Empty space click clears all tracking state', () => {
  // Find the empty space handler
  const emptyClick = clickHandler.match(/picks\.length === 0\)[\s\S]*?return;/);
  if (!emptyClick) {
    return 'Missing empty space click handler';
  }

  const code = emptyClick[0];
  if (!code.includes('onTrackEntity(null)')) {
    return 'Empty space handler missing onTrackEntity(null)';
  }
  if (!code.includes('onCctvClick(null)')) {
    return 'Empty space handler missing onCctvClick(null)';
  }
  if (!code.includes('clearTrackingEntity()')) {
    return 'Empty space handler missing clearTrackingEntity()';
  }

  return true;
});

// Test 13: TrackingManager is a singleton
test('TrackingManager is a singleton with clearTracking method', () => {
  if (!trackingMgr.includes('class TrackingManager')) {
    return 'Missing TrackingManager class';
  }
  if (!trackingMgr.includes('clearTracking()')) {
    return 'Missing clearTracking method';
  }
  if (!trackingMgr.includes('export const trackingManager = new TrackingManager()')) {
    return 'Missing singleton export';
  }
  return true;
});

// Test 14: TrackingManager.clearTracking nullifies all state
test('TrackingManager.clearTracking nullifies all fields', () => {
  const clearMethod = trackingMgr.match(/clearTracking\(\)[\s\S]*?\}/);
  if (!clearMethod) {
    return 'Missing clearTracking method';
  }

  const code = clearMethod[0];
  if (!code.includes('this._positionRef = null')) {
    return 'Missing positionRef cleanup';
  }
  if (!code.includes('this._trackedId = null')) {
    return 'Missing trackedId cleanup';
  }
  if (!code.includes('this._trackedType = null')) {
    return 'Missing trackedType cleanup';
  }

  return true;
});

// Test 15: TrackingManager.updatePosition validates id+type before updating
test('TrackingManager.updatePosition validates entity identity before updating', () => {
  if (!trackingMgr.includes('this._trackedId === id && this._trackedType === type')) {
    return 'Missing id/type validation in updatePosition';
  }
  return true;
});

// Test 16: Non-matching entities passed to onTrackEntity(null)
test('Unknown entity type triggers onTrackEntity(null) cleanup', () => {
  if (!clickHandler.includes('if (!entityType)')) {
    return 'Missing null entity type check';
  }

  const unknownSection = clickHandler.match(/if \(!entityType\)[\s\S]*?clearTrackingEntity/);
  if (!unknownSection) {
    return 'Missing cleanup for unknown entity type';
  }

  return true;
});

// Test 17: Billboard picks clear CCTV state and vice versa
test('Non-CCTV picks clear CCTV selection state', () => {
  // After building trackedInfo for billboard/satellite pick, onCctvClick(null) should be called
  const cctvClearMatch = clickHandler.match(/onTrackEntity\(trackedInfo\);[\s\S]*?onCctvClick\(null\)/);
  if (!cctvClearMatch) {
    return 'Missing onCctvClick(null) after non-CCTV entity selection';
  }
  return true;
});

// Test 18: App.tsx has single tracked entity state
test('App.tsx maintains single trackedEntity state (not array)', () => {
  // Should have trackedEntity as singular state, not array
  if (!appCode.includes('const [trackedEntity, setTrackedEntity] = useState<TrackedEntityInfo | null>(null)')) {
    return 'Missing singular trackedEntity state';
  }
  return true;
});

// Test 19: Cleanup effect on component unmount
test('EntityClickHandler has cleanup effect on unmount', () => {
  // Should have a useEffect that calls clearTrackingEntity on unmount
  const unmountCleanup = clickHandler.match(/useEffect\(\(\)\s*=>\s*\{[\s\S]*?return\s*\(\)\s*=>\s*\{[\s\S]*?clearTrackingEntity\(\)/);
  if (!unmountCleanup) {
    return 'Missing unmount cleanup effect calling clearTrackingEntity';
  }
  return true;
});

// Test 20: ScreenSpaceEventHandler destroyed on cleanup
test('ScreenSpaceEventHandler destroyed on cleanup', () => {
  if (!clickHandler.includes('handler.destroy()')) {
    return 'Missing handler.destroy() in cleanup';
  }
  return true;
});

// Test 21: keydown listener removed on cleanup
test('keydown listener removed on cleanup', () => {
  if (!clickHandler.includes("document.removeEventListener('keydown', handleKeyDown)")) {
    return 'Missing removeEventListener for keydown';
  }
  return true;
});

// Print results
console.log('\n=== Feature #116: Multiple entity clicks handled correctly ===\n');
results.forEach(r => console.log(r));
console.log(`\n${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
console.log(`${results.filter(r => r.startsWith('✅')).length}/${results.length} passed`);
process.exit(allPassed ? 0 : 1);
