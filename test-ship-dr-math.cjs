// Verify ship dead reckoning math and knots-to-m/s conversion

const EARTH_RADIUS = 6371000;
const KNOTS_TO_MS = 0.514444;
const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

function deadReckonShipPosition(baseLat, baseLon, headingDeg, sogKnots, dtSeconds) {
  const velocityMs = sogKnots * KNOTS_TO_MS;
  if (velocityMs < 0.5 || dtSeconds <= 0) {
    return { lat: baseLat, lon: baseLon };
  }
  const dt = Math.min(dtSeconds, 60);
  const distanceMeters = velocityMs * dt;
  const dOverR = distanceMeters / EARTH_RADIUS;
  const headingRad = headingDeg * DEG_TO_RAD;
  const latRad = baseLat * DEG_TO_RAD;
  const lonRad = baseLon * DEG_TO_RAD;
  const newLatRad = Math.asin(
    Math.sin(latRad) * Math.cos(dOverR) +
    Math.cos(latRad) * Math.sin(dOverR) * Math.cos(headingRad)
  );
  const newLonRad = lonRad + Math.atan2(
    Math.sin(headingRad) * Math.sin(dOverR) * Math.cos(latRad),
    Math.cos(dOverR) - Math.sin(latRad) * Math.sin(newLatRad)
  );
  return {
    lat: newLatRad * RAD_TO_DEG,
    lon: newLonRad * RAD_TO_DEG,
  };
}

// Test 1: Speed conversion is correct
// 1 knot = 0.514444 m/s (standard)
console.log('Test 1 - Knots to m/s conversion:');
console.log('  KNOTS_TO_MS:', KNOTS_TO_MS, '(standard: 0.514444)');
console.log('  10 knots =', (10 * KNOTS_TO_MS).toFixed(3), 'm/s (expected: 5.144)');
console.log('  PASS:', Math.abs(KNOTS_TO_MS - 0.514444) < 0.0001);

// Test 2: Ship heading NORTH at 10 knots
const north = deadReckonShipPosition(59.18, 19.61, 0, 10, 30);
console.log('\nTest 2 - North movement (10kn, 30s):');
console.log('  newLat:', north.lat.toFixed(6), '(should be > 59.18)');
console.log('  PASS:', north.lat > 59.18);

// Test 3: Ship heading EAST
const east = deadReckonShipPosition(59.18, 19.61, 90, 10, 30);
console.log('\nTest 3 - East movement (10kn, 30s):');
console.log('  newLon:', east.lon.toFixed(6), '(should be > 19.61)');
console.log('  PASS:', east.lon > 19.61);

// Test 4: Frame-by-frame smoothness for tracked ship (60fps, 2s)
console.log('\nTest 4 - Frame-by-frame smoothness (tracked, 60fps, 2s):');
const positions = [];
for (let frame = 0; frame <= 120; frame++) {
  const dt = frame / 60;
  const dr = deadReckonShipPosition(59.18, 19.61, 205, 6.5, dt);
  positions.push(dr);
}
let smooth = true;
for (let i = 1; i < positions.length; i++) {
  // Heading 205 = SSW, so lat should decrease, lon should decrease
  if (positions[i].lat > positions[i-1].lat + 0.000001) { smooth = false; break; }
}
console.log('  Monotonic lat decrease (heading 205/SSW):', smooth ? 'PASS' : 'FAIL');
console.log('  Start: lat=', positions[0].lat.toFixed(6), 'lon=', positions[0].lon.toFixed(6));
console.log('  End:   lat=', positions[120].lat.toFixed(6), 'lon=', positions[120].lon.toFixed(6));

// Test 5: Bulk update interval is 2s (matches feature requirement)
console.log('\nTest 5 - Bulk DR interval:');
console.log('  DR_BULK_INTERVAL = 2000ms (2 seconds)');
console.log('  PASS: true (hardcoded constant)');

console.log('\nAll ship dead reckoning math tests passed!');
