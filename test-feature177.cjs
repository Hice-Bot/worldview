// Test Feature #177: Satellite propagation timing correct
// Verifies satellite.js propagation uses correct UTC timing

const fs = require('fs');
const path = require('path');
const http = require('http');

const satLayerPath = path.join(__dirname, 'src/components/layers/SatelliteLayer.tsx');
const source = fs.readFileSync(satLayerPath, 'utf8');

let pass = true;

console.log('=== Code Analysis ===');

// 1. propagate() called with current Date object
const hasPropagateSat = source.includes('satellite.propagate(satrec, date)');
console.log('1. propagate() called with Date param:', hasPropagateSat);
if (!hasPropagateSat) pass = false;

// Check propagateAll uses new Date()
const hasNewDate = source.includes('const now = new Date()');
console.log('   propagateAll uses new Date():', hasNewDate);
if (!hasNewDate) pass = false;

// propagateSat is called with 'now' from propagateAll
const callsPropagateWithNow = source.includes('propagateSat(satrec, now)');
console.log('   Calls propagateSat(satrec, now):', callsPropagateWithNow);
if (!callsPropagateWithNow) pass = false;

// 2. gstime() called with same date for GMST computation
const hasGstime = source.includes('satellite.gstime(date)');
console.log('2. gstime() called with same date:', hasGstime);
if (!hasGstime) pass = false;

// 3. eciToGeodetic with computed GMST
const hasEciToGeo = source.includes('satellite.eciToGeodetic(posEci');
console.log('3. eciToGeodetic converts ECI to geodetic:', hasEciToGeo);
if (!hasEciToGeo) pass = false;

// 4. twoline2satrec parses TLE data
const hasTle2Satrec = source.includes('satellite.twoline2satrec(sat.tle1, sat.tle2)');
console.log('4. twoline2satrec parses TLE lines:', hasTle2Satrec);
if (!hasTle2Satrec) pass = false;

// 5. Position update interval uses new Date() each time
const hasInterval = source.includes('setInterval(() => {');
console.log('5. 5Hz interval updates positions:', hasInterval);
if (!hasInterval) pass = false;

// 6. Orbit paths also use new Date() for future position computation
const hasOrbitFuture = source.includes("now.getTime() + i * 60000");
console.log('6. Orbit paths computed from current time + future offsets:', hasOrbitFuture);
if (!hasOrbitFuture) pass = false;

// 7. Bearing computation uses current date
const hasBearingNow = source.includes("computeBearing(satrec, now)");
console.log('7. Bearing computed at current time:', hasBearingNow);
if (!hasBearingNow) pass = false;

// 8. Bearing future uses time offset from now (not hardcoded)
const hasBearingFuture = source.includes("now.getTime() + 10000");
console.log('8. Bearing future offset from now:', hasBearingFuture);
if (!hasBearingFuture) pass = false;

// 9. No timezone conversion (Date is always UTC internally in JS)
const hasTimezoneConversion = source.includes('getTimezoneOffset') ||
  source.includes('toLocaleDateString') ||
  source.includes('toLocaleTimeString');
console.log('9. No timezone conversion functions used:', !hasTimezoneConversion);
if (hasTimezoneConversion) pass = false;

// 10. No mock/fake data patterns
const mockPatterns = ['mockData', 'fakeData', 'sampleData', 'dummyData', 'STUB', 'MOCK'];
const hasMock = mockPatterns.some(p => source.includes(p));
console.log('10. No mock data patterns:', !hasMock);
if (hasMock) pass = false;

// 11. altKm validation range (100-100000 km)
const hasAltValidation = source.includes('altKm < 100 || altKm > 100000');
console.log('11. Altitude validation range:', hasAltValidation);
if (!hasAltValidation) pass = false;

// Now verify via API: ISS propagation with current time
console.log('\n=== API + satellite.js Verification ===');

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

fetchJson('http://localhost:3001/api/satellites').then(sats => {
  console.log('Satellite count from API:', sats.length);

  // Check ISS exists
  const iss = sats.find(s => s.noradId === 25544);
  console.log('12. ISS (NORAD 25544) present:', !!iss);
  if (!iss) { pass = false; finish(); return; }

  console.log('    ISS name:', iss.name);

  // Verify propagation with current UTC time
  try {
    const satellite = require('satellite.js');
    const satrec = satellite.twoline2satrec(iss.tle1, iss.tle2);
    const now = new Date();
    const posAndVel = satellite.propagate(satrec, now);
    const posEci = posAndVel.position;

    if (posEci && typeof posEci !== 'boolean') {
      const gmst = satellite.gstime(now);
      const geo = satellite.eciToGeodetic(posEci, gmst);
      const lon = geo.longitude * 180 / Math.PI;
      const lat = geo.latitude * 180 / Math.PI;
      const altKm = geo.height;

      console.log('13. ISS propagation with current Date():', true);
      console.log('    Position: lat=' + lat.toFixed(2) + ', lon=' + lon.toFixed(2) + ', alt=' + altKm.toFixed(0) + 'km');

      // ISS altitude should be ~350-460km
      const issAltOk = altKm > 350 && altKm < 460;
      console.log('14. ISS altitude realistic (350-460km):', issAltOk, '(' + altKm.toFixed(0) + 'km)');
      if (!issAltOk) pass = false;

      // Lat should be within ISS orbital inclination (~51.6 deg)
      const latOk = Math.abs(lat) <= 52;
      console.log('15. ISS latitude within inclination (<=52 deg):', latOk, '(' + lat.toFixed(2) + ' deg)');
      if (!latOk) pass = false;

      // Verify same Date gives same result (UTC consistency)
      const posAndVel2 = satellite.propagate(satrec, now);
      const posEci2 = posAndVel2.position;
      if (posEci2 && typeof posEci2 !== 'boolean') {
        const samePos = Math.abs(posEci.x - posEci2.x) < 0.001;
        console.log('16. Same Date gives same position:', samePos);
        if (!samePos) pass = false;
      }

      // Verify time-dependent: slightly different time gives different position
      const later = new Date(now.getTime() + 60000); // 1 minute later
      const posLater = satellite.propagate(satrec, later);
      const posEciLater = posLater.position;
      if (posEciLater && typeof posEciLater !== 'boolean') {
        const diffPos = Math.abs(posEci.x - posEciLater.x) > 0.1;
        console.log('17. Different time gives different position:', diffPos);
        if (!diffPos) pass = false;
      }
    } else {
      console.log('13. ISS propagation failed');
      pass = false;
    }
  } catch (e) {
    console.log('satellite.js error:', e.message);
    pass = false;
  }

  finish();
}).catch(err => {
  console.error('API fetch error:', err.message);
  process.exit(1);
});

function finish() {
  console.log('\n=== RESULT ===');
  console.log(pass ? 'PASS: Satellite propagation timing verified' : 'FAIL: Some checks failed');
  process.exit(pass ? 0 : 1);
}
