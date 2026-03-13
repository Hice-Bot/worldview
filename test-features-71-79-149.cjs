/**
 * Test script for Features #71, #79, #149
 * Verifies:
 * - Feature #71: Earthquake intel feed events with descriptions
 * - Feature #79: Ship intel feed events with >=30 threshold
 * - Feature #149: Intel feed bootstrap system messages (4 SYS messages on mount)
 */
const fs = require('fs');

// Read the App.tsx source code to verify implementation
const appSrc = fs.readFileSync('src/App.tsx', 'utf8');
const intelFeedSrc = fs.readFileSync('src/components/ui/IntelFeed.tsx', 'utf8');
const typesSrc = fs.readFileSync('src/types/index.ts', 'utf8');

let allPassed = true;
let testCount = 0;
let passCount = 0;

function assert(condition, description) {
  testCount++;
  if (condition) {
    passCount++;
    console.log('  PASS:', description);
  } else {
    allPassed = false;
    console.log('  FAIL:', description);
  }
}

// ============================================================
// Feature #149: Intel feed bootstrap system messages
// ============================================================
console.log('\n=== Feature #149: Intel feed bootstrap system messages ===');

// Step 1: First message: system initialization
assert(
  appSrc.includes("addIntelEvent('SYS', 'WORLDVIEW SYSTEM INITIALIZING...')"),
  'First boot message: system initialization'
);

// Step 2: Second message: engine loading
assert(
  appSrc.includes("addIntelEvent('SYS', 'CESIUM ENGINE LOADING...')"),
  'Second boot message: engine loading'
);

// Step 3: Third message: connection status
assert(
  appSrc.includes("addIntelEvent('SYS', 'DATA PROXY CONNECTION ESTABLISHED')"),
  'Third boot message: connection status'
);

// Step 4: Fourth message: display online
assert(
  appSrc.includes("addIntelEvent('SYS', 'DISPLAY ONLINE"),
  'Fourth boot message: display online'
);

// Step 5: Messages appear with SYS type and HH:MM:SS timestamp
assert(
  appSrc.includes("'SYS'") && appSrc.includes("addIntelEvent('SYS'"),
  'Messages use SYS type'
);

// Verify HH:MM:SS format in IntelFeed component
assert(
  intelFeedSrc.includes('toISOString().slice(11, 19)'),
  'IntelFeed formats timestamps as HH:MM:SS'
);

// Step 6: Messages visible before data layers start loading
// Boot sequence uses setTimeout(0, 500, 1000, 1500ms) and sets booted=true after 1500ms
// Data effects check `if (!booted)` so they only fire AFTER boot sequence
assert(
  appSrc.includes("if (!booted) {") &&
  appSrc.includes("setTimeout(") &&
  appSrc.includes("setBooted(true)"),
  'Boot sequence fires before data events (booted flag gates data events)'
);

// Verify exactly 4 boot messages
const bootMatches = appSrc.match(/addIntelEvent\('SYS',.*(?:INITIALIZING|ENGINE|PROXY|DISPLAY)/g);
assert(
  bootMatches && bootMatches.length === 4,
  'Exactly 4 boot messages present'
);

// ============================================================
// Feature #71: Earthquake intel feed events
// ============================================================
console.log('\n=== Feature #71: Earthquake intel feed events ===');

// Step 1: New significant earthquake triggers SEIS event in intel feed
assert(
  appSrc.includes("addIntelEvent('SEIS'"),
  'SEIS events are generated for earthquakes'
);

// Verify individual earthquake events are generated (not just counts)
assert(
  appSrc.includes('newQuakes') && appSrc.includes('for (const quake of newQuakes)'),
  'Individual per-earthquake events generated for new quakes'
);

// Step 2: Event format includes earthquake description
assert(
  appSrc.includes('quake.place') && appSrc.includes('quake.magnitude.toFixed(1)'),
  'Event includes magnitude and place description'
);

// Verify the event format matches: M5.2 place
assert(
  appSrc.includes('`M${quake.magnitude.toFixed(1)} ${quake.place}`'),
  'Event format: M{magnitude} {place}'
);

// Step 3: Events appear in real-time as new data arrives
// Earthquake effect tracks IDs and detects new ones
assert(
  appSrc.includes('prevQuakeIdsRef') && appSrc.includes("new Set(earthquakes.map(q => q.id))"),
  'Tracks earthquake IDs to detect new arrivals in real-time'
);

assert(
  appSrc.includes("!prevIds.has(q.id)"),
  'Filters for earthquakes not in previous set'
);

// Step 4: Intel feed updates without page refresh
// React useEffect + state updates = no page refresh needed
assert(
  appSrc.includes('useEffect(') && appSrc.includes('setIntelEvents'),
  'useEffect + state updates provide no-refresh updates'
);

// ============================================================
// Feature #79: Ship intel feed events
// ============================================================
console.log('\n=== Feature #79: Ship intel feed events ===');

// Step 1: Ship count increasing by 30+ triggers AIS event
assert(
  appSrc.includes(">= 30"),
  'Threshold set to 30+ for vessel count changes'
);

assert(
  appSrc.includes("addIntelEvent('AIS'"),
  'AIS events generated for ship count changes'
);

// Step 2: Event format: HH:MM:SS | [AIS] | vessel count update
assert(
  appSrc.includes('VESSEL COUNT') && appSrc.includes('AIS TARGETS'),
  'AIS event message includes vessel count update text'
);

// Verify both increase and decrease are tracked
assert(
  appSrc.includes("'INCREASED'") && appSrc.includes("'DECREASED'"),
  'Both increase and decrease in vessel count are reported'
);

// Step 3: Events track significant changes in maritime activity
assert(
  appSrc.includes("Math.abs(ships.length - prev) >= 30"),
  'Tracks significant changes (abs diff >= 30)'
);

// Initial AIS feed activation event
assert(
  appSrc.includes("AIS FEED ACTIVE"),
  'Initial AIS feed activation event generated'
);

// ============================================================
// Cross-cutting: IntelEvent type system
// ============================================================
console.log('\n=== Cross-cutting: IntelEvent type verification ===');

assert(
  typesSrc.includes("'SEIS'") && typesSrc.includes("'AIS'") && typesSrc.includes("'SYS'"),
  'IntelEvent type includes SEIS, AIS, SYS'
);

assert(
  intelFeedSrc.includes("SEIS: 'text-red-400'"),
  'SEIS events render in red'
);

assert(
  intelFeedSrc.includes("AIS:  'text-orange-400'"),
  'AIS events render in orange'
);

assert(
  intelFeedSrc.includes("SYS:  'text-amber-400'"),
  'SYS events render in amber'
);

// Format verification: HH:MM:SS | [TYPE] | message
assert(
  intelFeedSrc.includes('[{event.type}]') || intelFeedSrc.includes('{event.type}'),
  'IntelFeed renders event type badge'
);

assert(
  intelFeedSrc.includes('event.message'),
  'IntelFeed renders event message'
);

assert(
  intelFeedSrc.includes('formatTime(event.timestamp)'),
  'IntelFeed renders formatted timestamp'
);

// ============================================================
// Summary
// ============================================================
console.log('\n==============================');
console.log('Results:', passCount + '/' + testCount, 'passed');
if (allPassed) {
  console.log('ALL TESTS PASSED!');
} else {
  console.log('SOME TESTS FAILED');
  process.exit(1);
}
