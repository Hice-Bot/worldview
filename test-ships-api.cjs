const fs = require('fs');
const data = JSON.parse(fs.readFileSync('/tmp/ships_test.json', 'utf8'));

console.log('Type:', data.type);
console.log('Updated:', data.dataUpdatedTime);
console.log('Total features:', data.features.length);

// Sample first 3 features
for (let i = 0; i < 3 && i < data.features.length; i++) {
  const f = data.features[i];
  console.log('---');
  console.log('MMSI:', f.mmsi);
  console.log('Geometry:', JSON.stringify(f.geometry));
  console.log('Properties:', JSON.stringify(f.properties));
}

// Count navigation statuses
const navStats = {};
data.features.forEach(f => {
  const ns = f.properties.navStat;
  navStats[ns] = (navStats[ns] || 0) + 1;
});
console.log('---');
console.log('Nav statuses:', JSON.stringify(navStats));

// Count by heading available
const withHeading = data.features.filter(f => f.properties.heading !== 511).length;
console.log('With real heading:', withHeading, '/', data.features.length);

// Check coordinate ranges
let minLat = 90, maxLat = -90, minLon = 180, maxLon = -180;
data.features.forEach(f => {
  const [lon, lat] = f.geometry.coordinates;
  if (lat < minLat) minLat = lat;
  if (lat > maxLat) maxLat = lat;
  if (lon < minLon) minLon = lon;
  if (lon > maxLon) maxLon = lon;
});
console.log('Lat range:', minLat.toFixed(2), 'to', maxLat.toFixed(2));
console.log('Lon range:', minLon.toFixed(2), 'to', maxLon.toFixed(2));
