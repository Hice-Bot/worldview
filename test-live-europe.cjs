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
  // Test with European airspace (more international flights)
  console.log('Testing with Frankfurt area (busy European hub)...');
  var live = await fetchJSON('http://localhost:3001/api/flights/live?lat=50.0&lon=8.5&dist=150');
  console.log('Aircraft count:', live.length);

  var airborne = live.filter(function(f) { return !f.onGround; });
  var withCallsign = airborne.filter(function(f) { return f.callsign && f.callsign.length >= 3; });
  var withOrigin = live.filter(function(f) { return f.origin && f.origin.length > 0; });
  var withDest = live.filter(function(f) { return f.destination && f.destination.length > 0; });

  console.log('Airborne:', airborne.length);
  console.log('With callsign:', withCallsign.length);
  console.log('With origin:', withOrigin.length);
  console.log('With destination:', withDest.length);

  if (withOrigin.length > 0) {
    console.log('\nEnriched flights:');
    withOrigin.slice(0, 10).forEach(function(a) {
      console.log('  ' + a.callsign + ': ' + a.origin + ' -> ' + a.destination +
        ' | icao24=' + a.icao24 + ' alt=' + a.altitudeFeet + 'ft');
    });
  }

  // Now wait for cache expiry and try again to see if more routes got cached
  console.log('\nWaiting 5s for cache expiry...');
  await new Promise(function(r) { setTimeout(r, 5000); });

  var live2 = await fetchJSON('http://localhost:3001/api/flights/live?lat=50.0&lon=8.5&dist=150');
  var withOrigin2 = live2.filter(function(f) { return f.origin && f.origin.length > 0; });
  console.log('2nd call - enriched:', withOrigin2.length + '/' + live2.length);
  if (withOrigin2.length > withOrigin.length) {
    console.log('More routes found on 2nd call!');
  }
}

main().catch(function(e) { console.error(e); });
