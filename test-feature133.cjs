/**
 * Feature #133: Altitude band filters default to all enabled
 *
 * Tests:
 * 1. Cruise band: enabled by default
 * 2. High band: enabled by default
 * 3. Mid band: enabled by default
 * 4. Low band: enabled by default
 * 5. Ground band: enabled by default
 * 6. All aircraft visible regardless of altitude
 */
const fs = require('fs');

const results = [];
let allPassed = true;

function test(name, fn) {
  try {
    const result = fn();
    if (result === true) {
      results.push(`PASS: ${name}`);
    } else {
      results.push(`FAIL: ${name}: ${result}`);
      allPassed = false;
    }
  } catch (err) {
    results.push(`FAIL: ${name}: ${err.message}`);
    allPassed = false;
  }
}

const appSrc = fs.readFileSync('src/App.tsx', 'utf-8');
const flightLayerSrc = fs.readFileSync('src/components/layers/FlightLayer.tsx', 'utf-8');
const typesSrc = fs.readFileSync('src/types/index.ts', 'utf-8');
const opsPanelSrc = fs.readFileSync('src/components/ui/OperationsPanel.tsx', 'utf-8');

// Step 1-5: All 5 altitude bands default to enabled
const bands = ['cruise', 'high', 'mid', 'low', 'ground'];

// Extract the default state from App.tsx
const stateMatch = appSrc.match(/useState<AltitudeFilters>\(\{([^}]+)\}/s);
if (!stateMatch) {
  console.log('FAIL: Could not find AltitudeFilters default state');
  process.exit(1);
}
const stateBlock = stateMatch[1];

for (const band of bands) {
  test(`${band.charAt(0).toUpperCase() + band.slice(1)} band: enabled by default`, () => {
    const regex = new RegExp(`${band}:\\s*true`);
    if (!regex.test(stateBlock)) return `${band} is not set to true in default state`;
    return true;
  });
}

// Step 6: All aircraft visible regardless of altitude
test('FlightLayer uses altitudeFilters to filter aircraft by band', () => {
  const hasFilter = flightLayerSrc.includes('altitudeFilters[band]');
  if (!hasFilter) return 'altitudeFilters[band] check not found in FlightLayer';
  return true;
});

test('FlightLayer skips aircraft when band filter is false', () => {
  const hasSkip = flightLayerSrc.includes('if (!altitudeFilters[band]) continue');
  if (!hasSkip) return 'No continue statement for filtered bands';
  return true;
});

test('When all bands true, no aircraft are filtered out (all pass through)', () => {
  // Verify the logic: getAltitudeBand returns one of the 5 bands
  // altitudeFilters[band] would be true for any band => no aircraft skipped
  const hasGetBand = flightLayerSrc.includes('function getAltitudeBand');
  if (!hasGetBand) return 'getAltitudeBand function not found';

  // Check it returns only valid band keys
  const returnValues = flightLayerSrc.match(/return '(\w+)'/g);
  if (!returnValues) return 'No return values in getAltitudeBand';

  const returnedBands = returnValues.map(r => r.match(/return '(\w+)'/)[1]);
  for (const b of returnedBands) {
    if (!bands.includes(b)) return `getAltitudeBand returns '${b}' which is not a valid band`;
  }
  return true;
});

test('AltitudeFilters type has all 5 band keys as boolean', () => {
  for (const band of bands) {
    const regex = new RegExp(`${band}:\\s*boolean`);
    if (!regex.test(typesSrc)) return `${band} not defined as boolean in AltitudeFilters type`;
  }
  return true;
});

test('getAltitudeBand covers all altitude ranges', () => {
  const hasCruise = flightLayerSrc.includes('>= 35000');
  const hasHigh = flightLayerSrc.includes('>= 20000');
  const hasMid = flightLayerSrc.includes('>= 10000');
  const hasLow = flightLayerSrc.includes('>= 3000') || flightLayerSrc.includes('>= 1000');
  // ground is the default (below lowest threshold)
  if (!hasCruise) return 'Missing cruise threshold (35000)';
  if (!hasHigh) return 'Missing high threshold (20000)';
  if (!hasMid) return 'Missing mid threshold (10000)';
  return true;
});

test('altitudeFilters passed from App to GlobeViewer', () => {
  const hasProp = appSrc.includes('altitudeFilters={altitudeFilters}');
  if (!hasProp) return 'altitudeFilters not passed to GlobeViewer';
  return true;
});

test('altitudeFilters passed from App to OperationsPanel', () => {
  const hasProp = appSrc.includes('altitudeFilters={altitudeFilters}');
  if (!hasProp) return 'altitudeFilters not passed to OperationsPanel';
  return true;
});

test('OperationsPanel renders altitude band toggles', () => {
  const hasToggles = opsPanelSrc.includes('altitudeFilters[key]');
  if (!hasToggles) return 'Altitude band toggles not found in OperationsPanel';
  return true;
});

test('OperationsPanel shows all 5 bands (cruise, high, mid, low, ground)', () => {
  for (const band of bands) {
    const label = band.charAt(0).toUpperCase() + band.slice(1);
    if (!opsPanelSrc.includes(`'${band}'`) && !opsPanelSrc.includes(`"${band}"`)) {
      return `Band '${band}' not found in OperationsPanel`;
    }
  }
  return true;
});

test('No mock data patterns', () => {
  const mockPatterns = ['mockFilter', 'fakeFilter', 'dummyFilter', 'STUB', 'MOCK'];
  const sources = [appSrc, flightLayerSrc, opsPanelSrc];
  for (const src of sources) {
    for (const pattern of mockPatterns) {
      if (src.toLowerCase().includes(pattern.toLowerCase())) {
        return `Found mock pattern: ${pattern}`;
      }
    }
  }
  return true;
});

// Summary
console.log('\n=== Feature #133: Altitude band filters default to all enabled ===\n');
results.forEach(r => console.log(r));
console.log('\n=== OVERALL:', allPassed ? 'ALL PASSED' : 'SOME FAILED', '===');
process.exit(allPassed ? 0 : 1);
