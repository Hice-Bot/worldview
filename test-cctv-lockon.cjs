// Test: CCTV lock-on directional offset computation
// Verifies the compass direction to ViewFrom offset math

const COMPASS_TO_HEADING = {
  N: 0, NE: 45, E: 90, SE: 135,
  S: 180, SW: 225, W: 270, NW: 315,
};

function computeCctvViewFromOffset(direction) {
  const headingDeg = COMPASS_TO_HEADING[direction.toUpperCase()];
  if (headingDeg === undefined) {
    return { x: 0, y: -150, z: 80 };
  }
  const distance = 150;
  const elevation = 80;
  const headingRad = (headingDeg + 180) * Math.PI / 180;
  const offsetX = distance * Math.sin(headingRad);
  const offsetY = distance * Math.cos(headingRad);
  return { x: Math.round(offsetX * 100) / 100, y: Math.round(offsetY * 100) / 100, z: elevation };
}

let passed = 0;
let failed = 0;

function assert(name, actual, expected) {
  const match = Math.abs(actual - expected) < 1;
  if (match) {
    passed++;
  } else {
    failed++;
    console.log('FAIL: ' + name + ' expected=' + expected + ' actual=' + actual);
  }
}

// East-facing camera: viewer should be WEST of camera (negative X) to look East
const east = computeCctvViewFromOffset('E');
assert('E: offsetX < 0 (viewer west of camera)', east.x, -150); // sin(270deg) = -1
assert('E: offsetY ~ 0', east.y, 0);
assert('E: elevation', east.z, 80);

// North-facing camera: viewer should be SOUTH of camera (negative Y)
const north = computeCctvViewFromOffset('N');
assert('N: offsetX ~ 0', north.x, 0);
assert('N: offsetY < 0 (viewer south)', north.y, -150); // cos(180deg) = -1
assert('N: elevation', north.z, 80);

// West-facing camera: viewer should be EAST (positive X)
const west = computeCctvViewFromOffset('W');
assert('W: offsetX > 0 (viewer east)', west.x, 150);
assert('W: offsetY ~ 0', west.y, 0);
assert('W: elevation', west.z, 80);

// South-facing camera: viewer should be NORTH (positive Y)
const south = computeCctvViewFromOffset('S');
assert('S: offsetX ~ 0', south.x, 0);
assert('S: offsetY > 0 (viewer north)', south.y, 150);
assert('S: elevation', south.z, 80);

// No direction: default offset
const none = computeCctvViewFromOffset('');
assert('default: offsetX', none.x, 0);
assert('default: offsetY', none.y, -150);
assert('default: elevation', none.z, 80);

// NE-facing: viewer SW (negative X, negative Y)
const ne = computeCctvViewFromOffset('NE');
const expected = 150 * Math.sin(225 * Math.PI / 180); // ~-106
assert('NE: offsetX < 0', ne.x, Math.round(expected * 100) / 100);

console.log('Passed: ' + passed + '/' + (passed + failed));
if (failed === 0) {
  console.log('All directional offset tests PASSED');
} else {
  console.log(failed + ' tests FAILED');
  process.exit(1);
}
