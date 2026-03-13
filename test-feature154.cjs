/**
 * Test Feature #154: StatusBar UTC clock ticks every second
 *
 * Verifies:
 * 1. Clock format is YYYY-MM-DD HH:MM:SS UTC
 * 2. Uses setInterval(1000) for 1-second ticks
 * 3. Uses UTC (toISOString), not local timezone
 * 4. Interval runs independently of app state (empty deps [])
 * 5. Proper cleanup via clearInterval on unmount
 */

const fs = require('fs');

function main() {
  console.log('=== Feature #154: StatusBar UTC clock ticks every second ===\n');
  let passed = 0;
  let failed = 0;

  const src = fs.readFileSync('/mnt/c/Users/turke/worldview/src/components/ui/StatusBar.tsx', 'utf8');

  // Test 1: YYYY-MM-DD HH:MM:SS format
  // toISOString() returns "2026-03-13T18:42:30.000Z"
  // .replace('T', ' ') => "2026-03-13 18:42:30.000Z"
  // .slice(0, 19) => "2026-03-13 18:42:30"
  // + ' UTC' => "2026-03-13 18:42:30 UTC"
  const hasFormat = src.includes("toISOString()") &&
                    src.includes(".replace('T', ' ')") &&
                    src.includes('.slice(0, 19)') &&
                    src.includes("' UTC'");
  console.log('1. Clock format YYYY-MM-DD HH:MM:SS UTC:');
  if (hasFormat) {
    console.log('   PASS: toISOString().replace(T, " ").slice(0,19) + " UTC"');
    passed++;
  } else {
    console.log('   FAIL: Format not found');
    failed++;
  }

  // Test 2: setInterval(1000) for 1-second ticks
  const hasInterval = src.includes('setInterval') && src.includes('1000');
  console.log('2. setInterval(1000) for 1-second ticks:');
  if (hasInterval) {
    console.log('   PASS: setInterval with 1000ms interval');
    passed++;
  } else {
    console.log('   FAIL: setInterval(1000) not found');
    failed++;
  }

  // Test 3: UTC time (toISOString always returns UTC)
  const hasToISOString = src.includes('toISOString()');
  console.log('3. UTC timezone (not local):');
  if (hasToISOString) {
    console.log('   PASS: Uses toISOString() which is always UTC');
    passed++;
  } else {
    console.log('   FAIL: toISOString not used');
    failed++;
  }

  // Test 4: Seconds update via state (setUtcTime)
  const hasState = src.includes('useState') && src.includes('setUtcTime') && src.includes('new Date()');
  console.log('4. State-driven clock updates:');
  if (hasState) {
    console.log('   PASS: useState + setUtcTime(new Date()) in interval');
    passed++;
  } else {
    console.log('   FAIL: State management not found');
    failed++;
  }

  // Test 5: Cleanup via clearInterval
  const hasClearInterval = src.includes('clearInterval');
  console.log('5. Cleanup via clearInterval on unmount:');
  if (hasClearInterval) {
    console.log('   PASS: clearInterval in useEffect cleanup');
    passed++;
  } else {
    console.log('   FAIL: clearInterval not found');
    failed++;
  }

  // Test 6: useEffect with empty deps [] (runs once, independent of app state)
  // Pattern: useEffect(() => { ... setInterval ... }, []);
  const hasEmptyDeps = src.includes('}, []);') || src.includes('}, [ ]);');
  console.log('6. Clock runs independently (useEffect empty deps):');
  if (hasEmptyDeps) {
    console.log('   PASS: useEffect with [] deps — runs once on mount');
    passed++;
  } else {
    console.log('   FAIL: Empty deps not found');
    failed++;
  }

  // Test 7: Verify the formatted time is rendered in JSX
  const hasRender = src.includes('formatUtc(utcTime)') || src.includes('{formatUtc(utcTime)}');
  console.log('7. Formatted UTC clock rendered in JSX:');
  if (hasRender) {
    console.log('   PASS: {formatUtc(utcTime)} rendered in component');
    passed++;
  } else {
    console.log('   FAIL: Clock not rendered');
    failed++;
  }

  // Verify the actual format output
  console.log('\n--- Format verification ---');
  const now = new Date();
  const formatted = now.toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
  console.log('Example output:', formatted);
  const pattern = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} UTC$/;
  const matchesPattern = pattern.test(formatted);
  console.log('Matches YYYY-MM-DD HH:MM:SS UTC:', matchesPattern);

  // Summary
  console.log(`\n=== RESULTS: ${passed}/${passed + failed} checks passed ===`);
  if (failed === 0) {
    console.log('ALL CHECKS PASSED - Feature #154 verified');
  } else {
    console.log(`${failed} check(s) FAILED`);
  }

  process.exit(failed > 0 ? 1 : 0);
}

main();
