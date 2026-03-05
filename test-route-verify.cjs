var http = require('http');
var https = require('https');

function fetchJSON(url) {
  var mod = url.startsWith('https') ? https : http;
  return new Promise(function(resolve, reject) {
    mod.get(url, function(res) {
      var data = '';
      res.on('data', function(chunk) { data += chunk; });
      res.on('end', function() {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch(e) { resolve({ status: res.statusCode, data: data.substring(0, 200) }); }
      });
    }).on('error', reject);
  });
}

async function main() {
  // Get all callsigns near Sydney
  var live = await fetchJSON('http://localhost:3001/api/flights/live?lat=-33.8&lon=151.2&dist=100');
  var aircraft = live.data;
  var airborne = aircraft.filter(function(a) { return !a.onGround && a.callsign && a.callsign.length >= 3; });

  // Try ALL callsigns
  var found = 0;
  var total = airborne.length;
  console.log('Looking up routes for all ' + total + ' callsigns...');

  for (var i = 0; i < total; i++) {
    var cs = airborne[i].callsign;
    try {
      var result = await fetchJSON('https://opensky-network.org/api/routes?callsign=' + cs);
      if (result.status === 200 && result.data.route && result.data.route.length >= 2) {
        found++;
        var route = result.data.route;
        console.log('  FOUND: ' + cs + ' -> ' + route.join(' > '));
      }
    } catch(e) {}
  }

  console.log('\nRoutes found: ' + found + '/' + total);

  // Now also test: after waiting for 4s cache expiry, call live again
  console.log('\nWaiting 5s for cache expiry, then retesting...');
  await new Promise(function(r) { setTimeout(r, 5000); });

  var live2 = await fetchJSON('http://localhost:3001/api/flights/live?lat=-33.8&lon=151.2&dist=100');
  var enriched = live2.data.filter(function(a) { return a.origin && a.origin.length > 0; });
  console.log('Enriched aircraft on 2nd call:', enriched.length);
  enriched.forEach(function(a) {
    console.log('  ' + a.callsign + ': ' + a.origin + ' -> ' + a.destination);
  });
}

main().catch(function(e) { console.error(e); });
