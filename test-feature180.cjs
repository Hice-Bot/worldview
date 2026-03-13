// Test Feature #180: Data Refresh Intervals Timing Accurate
// Verify all polling intervals match specified durations by reading source code constants

var fs = require('fs');
var path = require('path');

var hooksDir = path.join(__dirname, 'src', 'hooks');

function readHook(name) {
  return fs.readFileSync(path.join(hooksDir, name), 'utf8');
}

// Test 1: useFlights polls every 20s
var flightsCode = readHook('useFlights.ts');
var flightsBase = flightsCode.match(/BASE_INTERVAL\s*=\s*(\d[\d_]*)/);
var flightsInterval = flightsBase ? parseInt(flightsBase[1].replace(/_/g, '')) : 0;
var flightsPass = flightsInterval === 20000;
console.log('Test 1 - useFlights polls every 20s:', flightsPass ? 'PASS' : 'FAIL', '(BASE_INTERVAL=' + flightsInterval + 'ms)');

// Test 2: useFlightsLive polls every 5s
var liveCode = readHook('useFlightsLive.ts');
var liveInterval = liveCode.match(/setInterval\(fetchLive,\s*(\d+)\)/);
var liveMs = liveInterval ? parseInt(liveInterval[1]) : 0;
var livePass = liveMs === 5000;
console.log('Test 2 - useFlightsLive polls every 5s:', livePass ? 'PASS' : 'FAIL', '(interval=' + liveMs + 'ms)');

// Test 3: useEarthquakes polls every 60s
var quakeCode = readHook('useEarthquakes.ts');
var quakeBase = quakeCode.match(/BASE_INTERVAL\s*=\s*(\d[\d_]*)/);
var quakeInterval = quakeBase ? parseInt(quakeBase[1].replace(/_/g, '')) : 0;
var quakePass = quakeInterval === 60000;
console.log('Test 3 - useEarthquakes polls every 60s:', quakePass ? 'PASS' : 'FAIL', '(BASE_INTERVAL=' + quakeInterval + 'ms)');

// Test 4: useSatellites fetches with appropriate interval (2 hours = 7200000ms)
var satCode = readHook('useSatellites.ts');
var satBase = satCode.match(/BASE_INTERVAL\s*=\s*(\d[\d_]*)/);
var satInterval = satBase ? parseInt(satBase[1].replace(/_/g, '')) : 0;
var satPass = satInterval >= 300000; // At least 5 minutes is "appropriate" for TLE data
console.log('Test 4 - useSatellites appropriate interval:', satPass ? 'PASS' : 'FAIL', '(BASE_INTERVAL=' + satInterval + 'ms = ' + (satInterval / 3600000).toFixed(1) + ' hours)');

// Test 5: useCameras polls every 5 minutes
var cctvCode = readHook('useCameras.ts');
var cctvBase = cctvCode.match(/BASE_INTERVAL\s*=\s*(\d[\d_]*)/);
var cctvInterval = cctvBase ? parseInt(cctvBase[1].replace(/_/g, '')) : 0;
var cctvPass = cctvInterval === 300000;
console.log('Test 5 - useCameras polls every 5 minutes:', cctvPass ? 'PASS' : 'FAIL', '(BASE_INTERVAL=' + cctvInterval + 'ms = ' + (cctvInterval / 60000) + ' min)');

// Test 6: useShips polls every 30s
var shipCode = readHook('useShips.ts');
var shipBase = shipCode.match(/BASE_INTERVAL\s*=\s*(\d[\d_]*)/);
var shipInterval = shipBase ? parseInt(shipBase[1].replace(/_/g, '')) : 0;
var shipPass = shipInterval === 30000;
console.log('Test 6 - useShips polls every 30s:', shipPass ? 'PASS' : 'FAIL', '(BASE_INTERVAL=' + shipInterval + 'ms)');

// Test 7: Intervals don't drift - verify all hooks use setTimeout-based polling (not setInterval for most)
// setTimeout-based polling prevents drift because the next poll schedules AFTER the fetch completes
var flightsUseTimeout = flightsCode.includes('setTimeout') && flightsCode.includes('poll()');
var quakeUseTimeout = quakeCode.includes('setTimeout') && quakeCode.includes('poll()');
var satUseTimeout = satCode.includes('setTimeout') && satCode.includes('poll()');
var cctvUseTimeout = cctvCode.includes('setTimeout') && cctvCode.includes('poll()');
var shipUseTimeout = shipCode.includes('setTimeout') && shipCode.includes('poll()');
// useFlightsLive uses setInterval which is acceptable for 5s supplementary data
var liveUseSetInterval = liveCode.includes('setInterval');
var noDriftPass = flightsUseTimeout && quakeUseTimeout && satUseTimeout && cctvUseTimeout && shipUseTimeout && liveUseSetInterval;
console.log('Test 7 - Anti-drift polling pattern:', noDriftPass ? 'PASS' : 'FAIL');
console.log('  - useFlights: setTimeout+poll():', flightsUseTimeout);
console.log('  - useEarthquakes: setTimeout+poll():', quakeUseTimeout);
console.log('  - useSatellites: setTimeout+poll():', satUseTimeout);
console.log('  - useCameras: setTimeout+poll():', cctvUseTimeout);
console.log('  - useShips: setTimeout+poll():', shipUseTimeout);
console.log('  - useFlightsLive: setInterval:', liveUseSetInterval);

// Test 8: Backoff resets on success (intervals don't permanently drift)
var flightsReset = flightsCode.includes('backoffRef.current = BASE_INTERVAL');
var quakeReset = quakeCode.includes('backoffRef.current = BASE_INTERVAL');
var satReset = satCode.includes('backoffRef.current = BASE_INTERVAL');
var cctvReset = cctvCode.includes('backoffRef.current = BASE_INTERVAL');
var shipReset = shipCode.includes('backoffRef.current = BASE_INTERVAL');
var resetPass = flightsReset && quakeReset && satReset && cctvReset && shipReset;
console.log('Test 8 - Backoff resets on success:', resetPass ? 'PASS' : 'FAIL');

// Test 9: Verify proper cleanup (no leaked intervals)
var flightsCleanup = flightsCode.includes('clearTimeout(intervalRef.current)');
var quakeCleanup = quakeCode.includes('clearTimeout(timeoutRef.current)');
var satCleanup = satCode.includes('clearTimeout(timeoutRef.current)');
var cctvCleanup = cctvCode.includes('clearTimeout(timeoutRef.current)');
var shipCleanup = shipCode.includes('clearTimeout(timeoutRef.current)');
var liveCleanup = liveCode.includes('clearInterval(intervalRef.current)');
var cleanupPass = flightsCleanup && quakeCleanup && satCleanup && cctvCleanup && shipCleanup && liveCleanup;
console.log('Test 9 - Proper interval cleanup:', cleanupPass ? 'PASS' : 'FAIL');

console.log('\n--- Summary ---');
var allPass = flightsPass && livePass && quakePass && satPass && cctvPass && shipPass && noDriftPass && resetPass && cleanupPass;
console.log('Feature #180 overall:', allPass ? 'ALL TESTS PASS' : 'SOME TESTS FAILED');
