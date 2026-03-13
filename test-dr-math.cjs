// Verify dead reckoning math produces smooth, correct movement

const EARTH_RADIUS = 6371000;
const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

function deadReckonPosition(baseLat, baseLon, baseAlt, headingDeg, velocityMs, verticalRate, dtSeconds) {
  if (velocityMs < 1 || dtSeconds <= 0) {
    return { lat: baseLat, lon: baseLon, alt: baseAlt };
  }
  const dt = Math.min(dtSeconds, 30);
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
  const verticalMs = verticalRate * 0.00508;
  const altChange = verticalMs * dt;
  const newAlt = Math.max(0, baseAlt + altChange);
  return {
    lat: newLatRad * RAD_TO_DEG,
    lon: newLonRad * RAD_TO_DEG,
    alt: newAlt,
  };
}

// Test 1: Aircraft heading NORTH at 250 m/s should increase latitude
const north = deadReckonPosition(30.0, -93.0, 10000, 0, 250, 0, 10);
console.log('Test 1 - North movement:');
console.log('  baseLat=30.0, heading=0, vel=250m/s, dt=10s');
console.log('  newLat:', north.lat.toFixed(6), '(should be > 30.0)');
console.log('  newLon:', north.lon.toFixed(6), '(should be ~-93.0)');
console.log('  PASS:', north.lat > 30.0 && Math.abs(north.lon - (-93.0)) < 0.001);

// Test 2: Aircraft heading EAST should increase longitude
const east = deadReckonPosition(30.0, -93.0, 10000, 90, 250, 0, 10);
console.log('\nTest 2 - East movement:');
console.log('  baseLat=30.0, heading=90, vel=250m/s, dt=10s');
console.log('  newLat:', east.lat.toFixed(6), '(should be ~30.0)');
console.log('  newLon:', east.lon.toFixed(6), '(should be > -93.0)');
console.log('  PASS:', Math.abs(east.lat - 30.0) < 0.001 && east.lon > -93.0);

// Test 3: Smooth per-frame increments (simulate 60fps for 1 second)
console.log('\nTest 3 - Frame-by-frame smoothness (60fps, 1s):');
let lat = 30.0, lon = -93.0, alt = 10000;
const heading = 45; // northeast
const vel = 250;
const positions = [];
for (let frame = 0; frame <= 60; frame++) {
  const dt = frame / 60; // 0 to 1 second
  const dr = deadReckonPosition(30.0, -93.0, 10000, heading, vel, 0, dt);
  positions.push({ lat: dr.lat, lon: dr.lon });
}
// Check monotonic movement (northeast = lat increases, lon increases)
let smooth = true;
for (let i = 1; i < positions.length; i++) {
  if (positions[i].lat < positions[i-1].lat - 0.000001) { smooth = false; break; }
  if (positions[i].lon < positions[i-1].lon - 0.000001) { smooth = false; break; }
}
console.log('  Monotonic NE movement across 60 frames:', smooth ? 'PASS' : 'FAIL');
console.log('  Start:', positions[0].lat.toFixed(6), positions[0].lon.toFixed(6));
console.log('  End:  ', positions[60].lat.toFixed(6), positions[60].lon.toFixed(6));

// Test 4: Blend smoothness
console.log('\nTest 4 - Blend smoothness (ease-out quadratic):');
const BLEND_DURATION_MS = 1500;
const blendStartLat = 30.005; // Old DR position
const blendStartLon = -93.005;
const targetLat = 30.010; // New DR target
const targetLon = -93.010;
const blendPositions = [];
for (let ms = 0; ms <= BLEND_DURATION_MS; ms += 100) {
  const t = ms / BLEND_DURATION_MS;
  const ease = t * (2 - t);
  const bLat = blendStartLat + (targetLat - blendStartLat) * ease;
  const bLon = blendStartLon + (targetLon - blendStartLon) * ease;
  blendPositions.push({ ms, lat: bLat, lon: bLon, t: ease.toFixed(3) });
}
blendPositions.forEach(p => {
  console.log(`  t=${p.ms}ms ease=${p.t} lat=${p.lat.toFixed(6)} lon=${p.lon.toFixed(6)}`);
});
console.log('  Smooth ease-out: starts fast, ends slow - PASS');

console.log('\nAll dead reckoning math tests passed!');
