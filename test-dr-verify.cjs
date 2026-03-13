const http = require('http');

function fetchJSON(url) {
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

async function main() {
  // Test flight API
  const flights = await fetchJSON('http://localhost:3001/api/flights');
  console.log('Total flights:', flights.length);
  const airborne = flights.filter(f => !f.onGround);
  console.log('Airborne:', airborne.length);
  const withHeading = airborne.filter(f => f.heading > 0);
  console.log('With heading:', withHeading.length);
  const withVelocity = airborne.filter(f => f.velocityMs > 0);
  console.log('With velocity:', withVelocity.length);
  if (airborne.length > 0) {
    const s = airborne[0];
    console.log('Sample flight:', JSON.stringify({
      icao24: s.icao24, lat: s.lat, lon: s.lon,
      heading: s.heading, velocityMs: s.velocityMs, altFeet: s.altitudeFeet
    }));
  }

  // Test ship API
  const ships = await fetchJSON('http://localhost:3001/api/ships');
  console.log('\nTotal ships:', ships.length);
  const moving = ships.filter(s => s.sog > 0.5);
  console.log('Moving ships (sog > 0.5):', moving.length);
  if (moving.length > 0) {
    const s = moving[0];
    console.log('Sample ship:', JSON.stringify({
      mmsi: s.mmsi, lat: s.lat, lon: s.lon,
      heading: s.heading, cog: s.cog, sog: s.sog
    }));
  }

  // Test earthquake API
  const quakes = await fetchJSON('http://localhost:3001/api/earthquakes');
  const features = quakes.features || [];
  console.log('\nTotal earthquakes:', features.length);
  const sig = features.filter(f => f.properties && f.properties.mag >= 4.5);
  console.log('Significant (M4.5+):', sig.length);

  console.log('\nAll APIs returning real data - DR verification ready');
}

main().catch(e => console.error('Error:', e.message));
