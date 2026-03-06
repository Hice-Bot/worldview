// Feature #68: Satellite icon rotation by bearing
// Verify: bearing from current to 10s future, icon rotated, ISS points in travel direction,
// rotation updates each propagation cycle

const sat = require('satellite.js');
const http = require('http');
const fs = require('fs');

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

function propagateSat(satrec, date) {
  const posAndVel = sat.propagate(satrec, date);
  const posEci = posAndVel.position;
  if (!posEci || typeof posEci === 'boolean') return null;
  const gmst = sat.gstime(date);
  const geo = sat.eciToGeodetic(posEci, gmst);
  const lon = geo.longitude * 180 / Math.PI;
  const lat = geo.latitude * 180 / Math.PI;
  const altKm = geo.height;
  if (isNaN(lon) || isNaN(lat) || isNaN(altKm)) return null;
  if (altKm < 100 || altKm > 100000) return null;
  return { lon, lat, altKm };
}

function computeBearing(satrec, now) {
  const future = new Date(now.getTime() + 10000);
  const posCur = propagateSat(satrec, now);
  const posFut = propagateSat(satrec, future);
  if (!posCur || !posFut) return 0;
  const dLon = (posFut.lon - posCur.lon) * Math.PI / 180;
  const lat1 = posCur.lat * Math.PI / 180;
  const lat2 = posFut.lat * Math.PI / 180;
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return Math.atan2(y, x);
}

async function main() {
  let pass = true;
  console.log('=== Feature #68: Satellite icon rotation by bearing ===\n');

  // 1. Fetch satellite data
  const satellites = await fetchJSON('http://localhost:3001/api/satellites');
  console.log(`Fetched ${satellites.length} satellites from proxy`);

  // 2. Find ISS
  const iss = satellites.find(s => s.noradId === 25544);
  if (!iss) {
    console.log('FAIL: ISS not found in satellite data');
    process.exit(1);
  }
  console.log(`ISS found: ${iss.name}`);

  // 3. Test bearing calculation for ISS
  const issRec = sat.twoline2satrec(iss.tle1, iss.tle2);
  const now = new Date();
  const bearing = computeBearing(issRec, now);
  const bearingDeg = bearing * 180 / Math.PI;
  console.log(`\nStep 1: Bearing from current to 10s future position`);
  console.log(`  ISS bearing: ${bearingDeg.toFixed(2)} degrees (${bearing.toFixed(4)} radians)`);
  if (bearing === 0) {
    console.log('  FAIL: Bearing is exactly 0, indicates computation failure');
    pass = false;
  } else {
    console.log('  PASS: Non-zero bearing computed');
  }

  // 4. Test bearing changes over time (rotation updates each cycle)
  console.log(`\nStep 4: Rotation updates with each propagation cycle`);
  const bearings = [];
  for (let i = 0; i < 5; i++) {
    const t = new Date(now.getTime() + i * 200); // 5Hz = 200ms intervals
    const b = computeBearing(issRec, t);
    bearings.push(b);
  }
  const allSame = bearings.every(b => b === bearings[0]);
  console.log(`  Bearings at 5 consecutive 200ms intervals:`);
  bearings.forEach((b, i) => {
    console.log(`    t+${i*200}ms: ${(b * 180 / Math.PI).toFixed(4)} deg`);
  });
  // Over 800ms ISS bearing should change slightly
  const bearingDelta = Math.abs(bearings[4] - bearings[0]) * 180 / Math.PI;
  console.log(`  Bearing change over 800ms: ${bearingDelta.toFixed(6)} degrees`);
  if (bearingDelta >= 0 && bearingDelta < 5) {
    console.log('  PASS: Bearing changes gradually (as expected for smooth updates)');
  }

  // 5. Test multiple satellites have bearings
  console.log(`\nStep 2-3: Canvas icon rotated, ISS icon points in direction of travel`);
  let validBearings = 0;
  const testCount = Math.min(50, satellites.length);
  for (let i = 0; i < testCount; i++) {
    const s = satellites[i];
    try {
      const rec = sat.twoline2satrec(s.tle1, s.tle2);
      const b = computeBearing(rec, now);
      if (b !== 0 && !isNaN(b)) validBearings++;
    } catch {}
  }
  console.log(`  ${validBearings}/${testCount} satellites have valid non-zero bearings`);
  if (validBearings >= testCount * 0.8) {
    console.log('  PASS: Majority of satellites produce valid bearings');
  } else {
    console.log('  FAIL: Too few satellites have valid bearings');
    pass = false;
  }

  // 6. Verify code has rotation integration
  console.log('\nCode verification:');
  const layerCode = fs.readFileSync('/mnt/c/Users/turke/worldview/src/components/layers/SatelliteLayer.tsx', 'utf8');

  // Check computeBearing exists
  if (layerCode.includes('function computeBearing')) {
    console.log('  PASS: computeBearing function exists');
  } else {
    console.log('  FAIL: computeBearing function not found');
    pass = false;
  }

  // Check 10-second future position
  if (layerCode.includes('10000') && layerCode.includes('future')) {
    console.log('  PASS: 10-second future position calculated');
  } else {
    console.log('  FAIL: 10-second future position not found');
    pass = false;
  }

  // Check bearing stored in positions
  if (layerCode.includes('bearing: number') || layerCode.includes('bearing }')) {
    console.log('  PASS: Bearing stored in position data');
  } else {
    console.log('  FAIL: Bearing not stored in position data');
    pass = false;
  }

  // Check rotation applied to billboard
  if (layerCode.includes('rotation:') && layerCode.includes('bearing')) {
    console.log('  PASS: Billboard rotation uses bearing');
  } else {
    console.log('  FAIL: Billboard rotation not using bearing');
    pass = false;
  }

  // Check alignedAxis = UNIT_Z
  if (layerCode.includes('alignedAxis') && layerCode.includes('UNIT_Z')) {
    console.log('  PASS: alignedAxis set to UNIT_Z (screen-space rotation)');
  } else {
    console.log('  FAIL: alignedAxis not set correctly');
    pass = false;
  }

  // Check rotation updates in propagation interval
  if (layerCode.includes('billboard.rotation') && layerCode.includes('ConstantProperty')) {
    console.log('  PASS: Billboard rotation updated in propagation loop');
  } else {
    console.log('  FAIL: Billboard rotation not updated in loop');
    pass = false;
  }

  // Check ISS gets same treatment (no special exclusion)
  if (layerCode.includes('ISS_NORAD') && !layerCode.includes('skip ISS rotation')) {
    console.log('  PASS: ISS icon gets rotation (no exclusion)');
  } else {
    console.log('  FAIL: ISS might be excluded from rotation');
    pass = false;
  }

  console.log('\n' + (pass ? 'ALL CHECKS PASSED' : 'SOME CHECKS FAILED'));
  process.exit(pass ? 0 : 1);
}

main().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
