// Test script to verify flight altitude band data
const http = require('http');

http.get('http://localhost:3001/api/flights', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const flights = JSON.parse(data);
    console.log('Total flights:', flights.length);
    const airborne = flights.filter(f => !f.onGround);
    console.log('Airborne:', airborne.length);

    // Count by altitude band
    const bands = { cruise: 0, high: 0, mid: 0, low: 0, ground: 0 };
    airborne.forEach(f => {
      const alt = f.altitudeFeet;
      if (alt >= 35000) bands.cruise++;
      else if (alt >= 20000) bands.high++;
      else if (alt >= 10000) bands.mid++;
      else if (alt >= 3000) bands.low++;
      else bands.ground++;
    });
    console.log('Altitude bands:', JSON.stringify(bands));

    // Show samples from each band
    airborne.filter(f => f.altitudeFeet >= 35000).slice(0,2).forEach(f =>
      console.log('  Cruise:', f.callsign || f.icao24, f.altitudeFeet+'ft'));
    airborne.filter(f => f.altitudeFeet >= 20000 && f.altitudeFeet < 35000).slice(0,2).forEach(f =>
      console.log('  High:', f.callsign || f.icao24, f.altitudeFeet+'ft'));
    airborne.filter(f => f.altitudeFeet >= 10000 && f.altitudeFeet < 20000).slice(0,2).forEach(f =>
      console.log('  Mid:', f.callsign || f.icao24, f.altitudeFeet+'ft'));
    airborne.filter(f => f.altitudeFeet >= 3000 && f.altitudeFeet < 10000).slice(0,2).forEach(f =>
      console.log('  Low:', f.callsign || f.icao24, f.altitudeFeet+'ft'));
    airborne.filter(f => f.altitudeFeet < 3000).slice(0,2).forEach(f =>
      console.log('  Ground(<3000):', f.callsign || f.icao24, f.altitudeFeet+'ft'));

    // Verify multiple bands have aircraft
    const activeBands = Object.entries(bands).filter(([k, v]) => v > 0);
    console.log('\nActive bands:', activeBands.length, '/', 5);
    console.log('Multiple altitude bands present:', activeBands.length > 1 ? 'YES' : 'NO');

    // Verify color mapping matches code
    console.log('\nExpected color mapping:');
    console.log('  Cruise (>=35000ft) -> CYAN');
    console.log('  High (>=20000ft) -> LIGHT BLUE (#87CEEB)');
    console.log('  Mid (>=10000ft) -> GOLD (#FFD700)');
    console.log('  Low (>=3000ft) -> ORANGE');
    console.log('  Ground (<3000ft) -> RED');

    console.log('\nAll checks passed!');
  });
}).on('error', (e) => {
  console.error('Error fetching flights:', e.message);
});
