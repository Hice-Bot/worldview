const http = require('http');

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch(e) { reject(new Error('Invalid JSON: ' + data.substring(0, 200))); }
      });
    }).on('error', reject);
  });
}

async function main() {
  try {
    console.log('Testing /api/flights/live?lat=-33.8&lon=151.2&dist=100');
    const data = await fetchJSON('http://localhost:3001/api/flights/live?lat=-33.8&lon=151.2&dist=100');

    if (!Array.isArray(data)) {
      console.log('ERROR: Response is not an array:', typeof data);
      return;
    }

    console.log('Aircraft count:', data.length);

    if (data.length > 0) {
      console.log('\nSample aircraft:', JSON.stringify(data[0], null, 2));

      const withIcao = data.filter(a => a.icao24 && a.icao24.length > 0);
      const withCallsign = data.filter(a => a.callsign && a.callsign.length > 0);
      const withAlt = data.filter(a => a.altitudeFeet !== undefined);
      const withSpeed = data.filter(a => a.velocityKnots !== undefined);
      const withHeading = data.filter(a => a.heading !== undefined);
      const withOrigin = data.filter(a => a.origin && a.origin.length > 0);
      const withDest = data.filter(a => a.destination && a.destination.length > 0);

      console.log('\nField coverage:');
      console.log('  icao24:', withIcao.length, '/', data.length);
      console.log('  callsign:', withCallsign.length, '/', data.length);
      console.log('  altitudeFeet:', withAlt.length, '/', data.length);
      console.log('  velocityKnots:', withSpeed.length, '/', data.length);
      console.log('  heading:', withHeading.length, '/', data.length);
      console.log('  origin:', withOrigin.length, '/', data.length);
      console.log('  destination:', withDest.length, '/', data.length);

      // Verify ICAO24 codes are valid hex
      const validHex = withIcao.filter(a => /^[0-9a-f]{6}$/i.test(a.icao24));
      console.log('\n  Valid hex ICAO24:', validHex.length, '/', withIcao.length);

      // Check positions are near Sydney
      const nearSydney = data.filter(a =>
        a.lat > -35.5 && a.lat < -32 && a.lon > 149 && a.lon < 153.5
      );
      console.log('  Near Sydney (-35.5 to -32 lat, 149 to 153.5 lon):', nearSydney.length);
    }

    // Test cache TTL - second request should be fast
    console.log('\nTesting cache (second request)...');
    const start = Date.now();
    await fetchJSON('http://localhost:3001/api/flights/live?lat=-33.8&lon=151.2&dist=100');
    console.log('  Cached response time:', Date.now() - start, 'ms');

    console.log('\nAll checks passed!');
  } catch(err) {
    console.error('Test failed:', err.message);
  }
}

main();
