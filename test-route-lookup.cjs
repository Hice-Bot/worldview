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
  // First get the live flights near Sydney
  var live = await fetchJSON('http://localhost:3001/api/flights/live?lat=-33.8&lon=151.2&dist=100');
  var aircraft = live.data;
  var airborne = aircraft.filter(function(a) { return !a.onGround && a.callsign && a.callsign.length >= 3; });

  console.log('Airborne with callsigns near Sydney:', airborne.length);
  console.log('Callsigns:', airborne.map(function(a) { return a.callsign; }).join(', '));

  // Try looking up routes for first 5 callsigns
  console.log('\nRoute lookups:');
  for (var i = 0; i < Math.min(5, airborne.length); i++) {
    var cs = airborne[i].callsign;
    var result = await fetchJSON('https://opensky-network.org/api/routes?callsign=' + cs);
    console.log('  ' + cs + ': status=' + result.status + ' data=' + JSON.stringify(result.data));
  }

  // Also try some known international callsigns
  console.log('\nKnown callsign tests:');
  var known = ['QFA1', 'UAL842', 'SIA221', 'BAW15'];
  for (var k = 0; k < known.length; k++) {
    var result2 = await fetchJSON('https://opensky-network.org/api/routes?callsign=' + known[k]);
    console.log('  ' + known[k] + ': status=' + result2.status + ' route=' + JSON.stringify(result2.data.route || 'none'));
  }
}

main().catch(function(e) { console.error(e); });
