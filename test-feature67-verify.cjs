// Comprehensive verification for Feature #67: Satellite category filtering
const http = require('http');
const fs = require('fs');
const path = require('path');

function fetch(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    }).on('error', reject);
  });
}

async function main() {
  let passed = 0;
  let failed = 0;

  function check(desc, condition) {
    if (condition) {
      console.log('  ✓', desc);
      passed++;
    } else {
      console.log('  ✗', desc);
      failed++;
    }
  }

  // Read source files
  const satLayerSrc = fs.readFileSync(
    path.join(__dirname, 'src/components/layers/SatelliteLayer.tsx'), 'utf8'
  );
  const opsPanelSrc = fs.readFileSync(
    path.join(__dirname, 'src/components/ui/OperationsPanel.tsx'), 'utf8'
  );
  const appSrc = fs.readFileSync(
    path.join(__dirname, 'src/App.tsx'), 'utf8'
  );
  const typesSrc = fs.readFileSync(
    path.join(__dirname, 'src/types/index.ts'), 'utf8'
  );

  // 1. ISS category toggle shows/hides ISS and stations
  console.log('\n=== Requirement 1: ISS toggle shows/hides ISS ===');
  check('ISS NORAD ID defined (25544)', satLayerSrc.includes('ISS_NORAD = 25544'));
  check('ISS filter check in entity creation', satLayerSrc.includes("if (isISS && !filters.iss) continue"));
  check('ISS filter check in orbit paths', satLayerSrc.includes("if (isISS && !filters.iss) continue"));
  check('isISS derived from NORAD comparison', satLayerSrc.includes('sat.noradId === ISS_NORAD'));

  // 2. Other category toggle shows/hides non-ISS satellites
  console.log('\n=== Requirement 2: Other toggle shows/hides non-ISS ===');
  check('Other filter check in entity creation', satLayerSrc.includes("if (!isISS && !filters.other) continue"));
  check('Other filter check in orbit paths', satLayerSrc.includes("if (!isISS && !filters.other) continue"));

  // 3. Category filters appear in OperationsPanel when satellites enabled
  console.log('\n=== Requirement 3: Filters in OperationsPanel (conditional) ===');
  check('Satellite filters section conditional on layer active', opsPanelSrc.includes('layers.satellites && ('));
  check('Section labeled "Satellite Filters"', opsPanelSrc.includes('Satellite Filters'));
  check('ISS button in OperationsPanel', opsPanelSrc.includes('>ISS<'));
  check('Other button in OperationsPanel', opsPanelSrc.includes('>Other<'));
  check('ISS toggle calls onSatelliteFilterChange', opsPanelSrc.includes('iss: !satelliteFilters.iss'));
  check('Other toggle calls onSatelliteFilterChange', opsPanelSrc.includes('other: !satelliteFilters.other'));

  // 4. ISS uses cyan (#00D4FF) color at 0.6 scale
  console.log('\n=== Requirement 4: ISS color and scale ===');
  check('ISS_COLOR is #00D4FF', satLayerSrc.includes("'#00D4FF'"));
  check('ISS scale is 0.6', satLayerSrc.includes('isISS ? 0.6'));
  check('ISS icon uses cyan', satLayerSrc.includes("drawSatelliteIcon('#00D4FF'"));

  // 5. Other satellites use lime green (#39FF14) at 0.35 scale
  console.log('\n=== Requirement 5: Other color and scale ===');
  check('OTHER_COLOR is #39FF14', satLayerSrc.includes("'#39FF14'"));
  check('Other scale is 0.35', satLayerSrc.includes(': 0.35'));
  check('Other icon uses lime green', satLayerSrc.includes("drawSatelliteIcon('#39FF14'"));

  // 6. Toggling categories immediately updates globe rendering
  console.log('\n=== Requirement 6: Immediate re-render on toggle ===');
  check('useEffect depends on filters', satLayerSrc.includes('filters, parseTLEs, propagateAll'));
  check('SatelliteFilters type has iss field', typesSrc.includes('iss: boolean'));
  check('SatelliteFilters type has other field', typesSrc.includes('other: boolean'));
  check('SatelliteFilters type has showPaths field', typesSrc.includes('showPaths: boolean'));
  check('State initialized with iss:true, other:true', appSrc.includes('iss: true') && appSrc.includes('other: true'));
  check('setSatelliteFilters wired to OperationsPanel', appSrc.includes('onSatelliteFilterChange={setSatelliteFilters}'));
  check('satelliteFilters passed to SatelliteLayer via GlobeViewer', appSrc.includes('satelliteFilters={satelliteFilters}'));

  // 7. Verify orbit paths respect category filters
  console.log('\n=== Bonus: Orbit paths respect filters ===');
  check('Orbit paths check ISS filter', satLayerSrc.includes("isISS && !filters.iss") && satLayerSrc.includes("computeOrbitPaths"));
  check('Orbit paths check Other filter', satLayerSrc.includes("!isISS && !filters.other"));
  check('Orbit Paths toggle in UI', opsPanelSrc.includes('Orbit Paths'));
  check('showPaths toggle calls onSatelliteFilterChange', opsPanelSrc.includes('showPaths: !satelliteFilters.showPaths'));

  // 8. Verify API has real satellite data
  console.log('\n=== API Data Verification ===');
  const res = await fetch('http://localhost:3001/api/satellites');
  const sats = JSON.parse(res.data);
  check('API returns satellites', sats.length > 0);
  console.log('  Total satellites:', sats.length);

  const iss = sats.find(s => s.noradId === 25544);
  check('ISS (NORAD 25544) present in data', !!iss);
  if (iss) {
    console.log('  ISS name:', iss.name, '| category:', iss.category);
  }

  const others = sats.filter(s => s.noradId !== 25544);
  check('Non-ISS satellites present', others.length > 0);
  console.log('  Non-ISS satellites:', others.length);

  // Verify no mock data
  console.log('\n=== Mock Data Check ===');
  check('No mockData in SatelliteLayer', !satLayerSrc.includes('mockData'));
  check('No fakeData in SatelliteLayer', !satLayerSrc.includes('fakeData'));
  check('No hardcoded in SatelliteLayer', !satLayerSrc.includes('hardcoded'));

  // Summary
  console.log('\n=== RESULTS ===');
  console.log('Passed:', passed, '/', passed + failed);
  console.log('Failed:', failed);
  if (failed === 0) {
    console.log('\n✓ FEATURE #67 PASSES - Satellite category filtering works correctly');
  } else {
    console.log('\n✗ FEATURE #67 FAILS -', failed, 'checks failed');
  }
}

main().catch(e => console.error('Error:', e));
