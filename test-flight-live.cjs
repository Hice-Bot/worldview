const http = require('http');

// Use Sydney coords for the live endpoint
http.get('http://localhost:3001/api/flights/live?lat=-33.9&lon=151.2&dist=250', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const flights = JSON.parse(data);
      console.log('Live flights:', flights.length);
      const withRoutes = flights.filter(f => f.origin && f.destination);
      console.log('With routes:', withRoutes.length);
      withRoutes.slice(0, 8).forEach(f => {
        console.log('  ' + (f.callsign || f.icao24) + ': ' + f.origin + ' -> ' + f.destination);
      });
    } catch(e) {
      console.error('Parse error:', e.message);
    }
  });
}).on('error', e => console.error('Request error:', e.message));
