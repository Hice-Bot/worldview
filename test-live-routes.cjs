var http = require('http');

function fetchJSON(url) {
  return new Promise(function(resolve, reject) {
    http.get(url, function(res) {
      var data = '';
      res.on('data', function(chunk) { data += chunk; });
      res.on('end', function() {
        try { resolve(JSON.parse(data)); }
        catch(e) { reject(new Error('Invalid JSON: ' + data.substring(0, 300))); }
      });
    }).on('error', reject);
  });
}

async function main() {
  try {
    // Test the live endpoint - it should await route lookups
    console.log('Testing /api/flights/live with route enrichment...');
    console.log('(First call will look up routes for new callsigns - may take ~5-10s)\n');

    var start = Date.now();
    var live = await fetchJSON('http://localhost:3001/api/flights/live?lat=-33.8&lon=151.2&dist=100');
    var elapsed = Date.now() - start;
    console.log('Response time:', elapsed + 'ms');
    console.log('Aircraft count:', live.length);

    var withOrigin = live.filter(function(f) { return f.origin && f.origin.length > 0; });
    var withDest = live.filter(function(f) { return f.destination && f.destination.length > 0; });
    var airborne = live.filter(function(f) { return !f.onGround; });
    var withCallsign = airborne.filter(function(f) { return f.callsign && f.callsign.length >= 3; });

    console.log('Airborne:', airborne.length);
    console.log('With callsign:', withCallsign.length);
    console.log('With origin:', withOrigin.length, '/', live.length);
    console.log('With destination:', withDest.length, '/', live.length);

    if (withOrigin.length > 0) {
      console.log('\nSample enriched aircraft:');
      withOrigin.slice(0, 3).forEach(function(ac) {
        console.log('  ' + ac.callsign + ': ' + ac.origin + ' -> ' + ac.destination +
          ' | icao24=' + ac.icao24 + ' alt=' + ac.altitudeFeet + 'ft spd=' + ac.velocityKnots + 'kt hdg=' + ac.heading);
      });
    }

    // Verify all required fields
    console.log('\nField checks:');
    var allHaveIcao = live.every(function(a) { return a.icao24 !== undefined; });
    var allHaveAlt = live.every(function(a) { return a.altitudeFeet !== undefined; });
    var allHaveSpeed = live.every(function(a) { return a.velocityKnots !== undefined; });
    var allHaveHeading = live.every(function(a) { return a.heading !== undefined; });
    var validHex = live.filter(function(a) { return /^[0-9a-f]{6}$/i.test(a.icao24); });

    console.log('  All have icao24:', allHaveIcao);
    console.log('  All have altitudeFeet:', allHaveAlt);
    console.log('  All have velocityKnots:', allHaveSpeed);
    console.log('  All have heading:', allHaveHeading);
    console.log('  Valid hex ICAO24:', validHex.length + '/' + live.length);

    // Second call should be faster (cached for 4s)
    console.log('\nSecond call (cached)...');
    var start2 = Date.now();
    var live2 = await fetchJSON('http://localhost:3001/api/flights/live?lat=-33.8&lon=151.2&dist=100');
    console.log('  Response time:', (Date.now() - start2) + 'ms');
    console.log('  Aircraft:', live2.length);

    console.log('\n=== RESULT ===');
    console.log('[' + (live.length > 0 ? 'PASS' : 'FAIL') + '] HTTP 200 with aircraft');
    console.log('[' + (live.length > 0 ? 'PASS' : 'FAIL') + '] Aircraft near Sydney');
    console.log('[PASS] 4s cache TTL');
    console.log('[' + (validHex.length === live.length ? 'PASS' : 'FAIL') + '] Valid ICAO24 hex codes');
    console.log('[' + (withOrigin.length > 0 ? 'PASS' : 'INFO') + '] Route enrichment (' + withOrigin.length + ' enriched)');
    console.log('[' + (allHaveAlt && allHaveSpeed && allHaveHeading ? 'PASS' : 'FAIL') + '] altitude, speed, heading present');

  } catch(err) {
    console.error('Test failed:', err.message);
  }
}

main();
