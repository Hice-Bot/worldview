// Test: Feature #83 - Camera lock-on with type-specific viewFrom offsets
// Verifies the VIEW_FROM_OFFSETS values match spec requirements

const fs = require('fs');
const path = require('path');

const content = fs.readFileSync(path.join(__dirname, 'src/components/globe/EntityClickHandler.tsx'), 'utf-8');

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

// Check satellite offset (0, -500000, 500000) ~700km
check('Satellite viewFrom (0, -500000, 500000)',
  content.includes('satellite: new Cartesian3(0, -500000, 500000)'));

// Check aircraft offset (0, -30000, 30000) ~42km
check('Aircraft viewFrom (0, -30000, 30000)',
  content.includes('aircraft: new Cartesian3(0, -30000, 30000)'));

// Check ship offset (0, -1200, 2100) ~2.4km
check('Ship viewFrom (0, -1200, 2100)',
  content.includes('ship: new Cartesian3(0, -1200, 2100)'));

// Check earthquake/default offset (0, -200000, 200000) ~280km
check('Earthquake viewFrom (0, -200000, 200000)',
  content.includes('earthquake: new Cartesian3(0, -200000, 200000)'));

// Check offsets are applied via VIEW_FROM_OFFSETS[entityType]
check('Offset applied for billboard picks',
  content.includes('viewFrom: VIEW_FROM_OFFSETS[entityType]'));

// Check offset applied for Cesium entity picks
check('Offset applied for Cesium entity picks',
  content.includes('.viewFrom = VIEW_FROM_OFFSETS[entityType]'));

// Check viewer.trackedEntity is set (smooth transition)
check('viewer.trackedEntity set for smooth transition',
  content.includes('viewer.trackedEntity = trackEntity') || content.includes('viewer.trackedEntity = cesiumEntity'));

// Check all entity types have offsets
check('All EntityType keys present',
  content.includes('satellite:') && content.includes('aircraft:') &&
  content.includes('ship:') && content.includes('earthquake:') && content.includes('cctv:'));

console.log('Passed: ' + passed + '/' + (passed + failed));
if (failed === 0) {
  console.log('Feature #83 - All viewFrom offset checks PASSED');
} else {
  console.log(failed + ' checks FAILED');
  process.exit(1);
}
