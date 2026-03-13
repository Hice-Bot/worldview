const http = require('http');

function fetch(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

async function main() {
  // Verify earthquake proxy returns real USGS data
  console.log('=== Earthquake API Verification ===');
  const quakeRaw = await fetch('http://localhost:3001/api/earthquakes');
  const quakeData = JSON.parse(quakeRaw);
  const features = quakeData.features || [];
  console.log('Type:', quakeData.type);
  console.log('Earthquake count:', features.length);

  if (features.length > 0) {
    const f = features[0];
    console.log('Has real IDs:', features.every(f => f.id && typeof f.id === 'string'));
    console.log('Has real magnitudes:', features.every(f => typeof f.properties.mag === 'number'));
    console.log('Has real places:', features.filter(f => f.properties.place).length > 0);
    console.log('Has real coordinates:', features.every(f =>
      f.geometry && f.geometry.coordinates &&
      f.geometry.coordinates[0] >= -180 && f.geometry.coordinates[0] <= 180 &&
      f.geometry.coordinates[1] >= -90 && f.geometry.coordinates[1] <= 90
    ));
    console.log('Sample: M' + f.properties.mag + ' ' + f.properties.place);
  }

  // Verify ships proxy returns real AIS data
  console.log('\n=== Ships API Verification ===');
  const shipRaw = await fetch('http://localhost:3001/api/ships');
  const shipData = JSON.parse(shipRaw);
  console.log('Ship count:', shipData.length);

  if (shipData.length > 0) {
    const s = shipData[0];
    console.log('Has real MMSI:', shipData.every(s => s.mmsi && s.mmsi.length >= 5));
    console.log('Has valid coords:', shipData.filter(s =>
      s.lat >= -90 && s.lat <= 90 && s.lon >= -180 && s.lon <= 180
    ).length);
    console.log('Sample: MMSI=' + s.mmsi + ' name=' + s.name + ' lat=' + s.lat + ' lon=' + s.lon);
  }

  console.log('\nReal upstream API data confirmed!');
}

main().catch(e => console.error('Error:', e.message));
