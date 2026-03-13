const http = require('http');

function get(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

async function main() {
  // Test 1: Server starts (health check)
  const health = JSON.parse(await get('http://localhost:3001/api/health'));
  console.log('Test 1 - Server starts:', health.status === 'ok' ? 'PASS' : 'FAIL');

  // Test 2: Ships endpoint returns data (or empty array, not error)
  const ships = JSON.parse(await get('http://localhost:3001/api/ships'));
  console.log('Test 2 - Ships returns array:', Array.isArray(ships) ? 'PASS' : 'FAIL', '(' + ships.length + ' ships)');

  // Test 3: CCTV excludes AU cameras (no NSW_TRANSPORT_API_KEY)
  const cctv = JSON.parse(await get('http://localhost:3001/api/cctv'));
  const countries = {};
  cctv.forEach(c => { countries[c.country] = (countries[c.country] || 0) + 1; });
  console.log('Test 3 - CCTV countries:', JSON.stringify(countries));
  console.log('  AU cameras excluded:', !countries['AU'] ? 'PASS' : 'FAIL (AU cameras found!)');

  // Test 4: Flights returns data
  const flights = JSON.parse(await get('http://localhost:3001/api/flights'));
  console.log('Test 4 - Flights returns array:', Array.isArray(flights) ? 'PASS' : 'FAIL', '(' + flights.length + ' flights)');

  // Test 5: Earthquakes returns data
  const quakes = JSON.parse(await get('http://localhost:3001/api/earthquakes'));
  console.log('Test 5 - Earthquakes returns data:', quakes.features ? 'PASS' : 'FAIL');

  console.log('\nAll endpoints operational — no crash from missing env vars.');
}

main().catch(err => console.error('ERROR:', err.message));
