const http = require('http');

http.get('http://localhost:3001/api/flights', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const flights = JSON.parse(data);
      console.log('Total flights:', flights.length);
      const withRoutes = flights.filter(f => f.origin && f.destination);
      console.log('With routes:', withRoutes.length);
      withRoutes.slice(0, 8).forEach(f => {
        console.log('  ' + (f.callsign || f.icao24) + ': ' + f.origin + ' -> ' + f.destination + ' alt:' + f.altitudeFeet + 'ft vel:' + f.velocityKnots + 'kts');
      });
      console.log('Sample without routes:');
      flights.filter(f => !f.origin || !f.destination).slice(0, 3).forEach(f => {
        console.log('  ' + (f.callsign || f.icao24) + ' origin:"' + f.origin + '" dest:"' + f.destination + '"');
      });
    } catch(e) {
      console.error('Parse error:', e.message);
    }
  });
}).on('error', e => console.error('Request error:', e.message));
