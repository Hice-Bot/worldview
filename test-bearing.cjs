const sat = require('satellite.js');
// ISS TLE from API
const tle1 = '1 25544U 98067A   26064.70570909  .00008837  00000+0  17141-3 0  9997';
const tle2 = '2 25544  51.6315  92.0530 0008143 160.3826 199.7477 15.48463204555718';
const satrec = sat.twoline2satrec(tle1, tle2);
const now = new Date();
const future = new Date(now.getTime() + 10000);

function propagateSat(satrec, date) {
  const posAndVel = sat.propagate(satrec, date);
  const posEci = posAndVel.position;
  if (!posEci || typeof posEci === 'boolean') return null;
  const gmst = sat.gstime(date);
  const geo = sat.eciToGeodetic(posEci, gmst);
  const lon = geo.longitude * 180 / Math.PI;
  const lat = geo.latitude * 180 / Math.PI;
  const altKm = geo.height;
  return { lon, lat, altKm };
}

const posCur = propagateSat(satrec, now);
const posFut = propagateSat(satrec, future);
console.log('ISS current position:', JSON.stringify(posCur));
console.log('ISS 10s future position:', JSON.stringify(posFut));

if (posCur && posFut) {
  const dLon = (posFut.lon - posCur.lon) * Math.PI / 180;
  const lat1 = posCur.lat * Math.PI / 180;
  const lat2 = posFut.lat * Math.PI / 180;
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  const bearing = Math.atan2(y, x);
  console.log('Bearing (radians):', bearing);
  console.log('Bearing (degrees):', bearing * 180 / Math.PI);
  console.log('Negated for Cesium rotation:', -bearing, 'radians');
  console.log('Distance moved (deg):', Math.sqrt(Math.pow(posFut.lon - posCur.lon, 2) + Math.pow(posFut.lat - posCur.lat, 2)).toFixed(4));
  console.log('PASS: Bearing calculation produces valid non-zero result:', bearing !== 0);
}
