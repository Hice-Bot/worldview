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
  // Step 1: Call live endpoint (this triggers route lookups)
  console.log('Step 1: First call to live endpoint...');
  var start = Date.now();
  var live1 = await fetchJSON('http://localhost:3001/api/flights/live?lat=-33.8&lon=151.2&dist=100');
  console.log('  Time:', (Date.now() - start) + 'ms');
  console.log('  Count:', live1.data.length);
  var enriched1 = live1.data.filter(function(a) { return a.origin && a.origin.length > 0; });
  console.log('  Enriched:', enriched1.length);
  if (enriched1.length > 0) {
    enriched1.forEach(function(a) {
      console.log('    ' + a.callsign + ': ' + a.origin + ' -> ' + a.destination);
    });
  }

  // Let's manually check if QLK435D is in the results
  var qlk = live1.data.filter(function(a) { return a.callsign && a.callsign.indexOf('QLK') === 0; });
  console.log('\n  QantasLink flights:', qlk.map(function(a) { return a.callsign + ' (origin=' + a.origin + ')'; }).join(', '));

  var voz = live1.data.filter(function(a) { return a.callsign && a.callsign.indexOf('VOZ') === 0; });
  console.log('  Virgin flights:', voz.map(function(a) { return a.callsign + ' (origin=' + a.origin + ')'; }).join(', '));

  // Step 2: Wait for cache to expire and call again
  console.log('\nStep 2: Waiting 5s for cache expiry...');
  await new Promise(function(r) { setTimeout(r, 5000); });

  console.log('Step 3: Second call to live endpoint...');
  var start2 = Date.now();
  var live2 = await fetchJSON('http://localhost:3001/api/flights/live?lat=-33.8&lon=151.2&dist=100');
  console.log('  Time:', (Date.now() - start2) + 'ms');
  console.log('  Count:', live2.data.length);
  var enriched2 = live2.data.filter(function(a) { return a.origin && a.origin.length > 0; });
  console.log('  Enriched:', enriched2.length);
  if (enriched2.length > 0) {
    enriched2.forEach(function(a) {
      console.log('    ' + a.callsign + ': ' + a.origin + ' -> ' + a.destination);
    });
  }

  // Step 3: Try different region (Europe) which may have more routes
  console.log('\nStep 4: Testing with London coordinates (more international traffic)...');
  var london = await fetchJSON('http://localhost:3001/api/flights/live?lat=51.5&lon=-0.1&dist=100');
  console.log('  Count:', london.data.length);
  var londonEnriched = london.data.filter(function(a) { return a.origin && a.origin.length > 0; });
  console.log('  Enriched:', londonEnriched.length);
  if (londonEnriched.length > 0) {
    londonEnriched.slice(0, 5).forEach(function(a) {
      console.log('    ' + a.callsign + ': ' + a.origin + ' -> ' + a.destination);
    });
  }
}

main().catch(function(e) { console.error(e); });
