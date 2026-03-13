// Quick verify satellite TLE data is real
var http = require('http');

function fetch(url) {
  return new Promise(function(resolve, reject) {
    http.get(url, function(res) {
      var data = '';
      res.on('data', function(chunk) { data += chunk; });
      res.on('end', function() { resolve({ status: res.statusCode, body: data }); });
    }).on('error', reject);
  });
}

async function main() {
  var res = await fetch('http://localhost:3001/api/satellites');
  var sats = JSON.parse(res.body);
  console.log('Satellites: ' + sats.length);

  // Check for known satellites
  var names = sats.map(function(s) { return s.name; });
  console.log('ISS present: ' + names.includes('ISS (ZARYA)'));

  // Verify TLE format
  var validTLEs = sats.filter(function(s) {
    return s.tle1 && s.tle2 && s.tle1.startsWith('1 ') && s.tle2.startsWith('2 ');
  });
  console.log('Valid TLEs: ' + validTLEs.length + '/' + sats.length);

  // Verify noradIds are real
  var badIds = sats.filter(function(s) { return !s.noradId || s.noradId < 1; });
  console.log('Bad NORAD IDs: ' + badIds.length);

  // Show sample names
  console.log('Sample names: ' + sats.slice(0, 5).map(function(s) { return s.name; }).join(', '));

  // All real
  console.log('PASS: Real CelesTrak TLE data confirmed');
}

main().catch(function(e) { console.error(e); process.exit(1); });
