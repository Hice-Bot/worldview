var http = require('http');

function fetchJSON(url) {
  return new Promise(function(resolve, reject) {
    http.get(url, function(res) {
      var data = '';
      res.on('data', function(chunk) { data += chunk; });
      res.on('end', function() {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    }).on('error', reject);
  });
}

async function main() {
  var result = await fetchJSON('http://localhost:3001/api/flights');
  var data = result.body;

  if (!Array.isArray(data)) {
    process.stderr.write('ERROR: flights response is not an array\n');
    process.exit(1);
  }

  var total = data.length;
  var badIcao = 0;
  var badLat = 0;
  var badLon = 0;
  var nanAlt = 0;
  var nanVel = 0;
  var nanHdg = 0;
  var badHdgRange = 0;
  var missingFields = 0;

  for (var i = 0; i < data.length; i++) {
    var a = data[i];
    // Step 1: Every aircraft has icao24 (6-char hex)
    if (!a.icao24 || typeof a.icao24 !== 'string' || a.icao24.trim().length === 0) badIcao++;
    // Step 2: lat/lon within valid range
    if (typeof a.lat !== 'number' || isNaN(a.lat) || a.lat < -90 || a.lat > 90) badLat++;
    if (typeof a.lon !== 'number' || isNaN(a.lon) || a.lon < -180 || a.lon > 180) badLon++;
    // Step 3: altitudeFeet is numeric (non-NaN)
    if (typeof a.altitudeFeet !== 'number' || isNaN(a.altitudeFeet)) nanAlt++;
    // Step 4: velocityKnots is numeric (non-NaN)
    if (typeof a.velocityKnots !== 'number' || isNaN(a.velocityKnots)) nanVel++;
    // Step 5: heading is 0-360 or null
    if (a.heading !== null && a.heading !== undefined) {
      if (typeof a.heading !== 'number' || isNaN(a.heading)) nanHdg++;
      else if (a.heading < 0 || a.heading > 360) badHdgRange++;
    }
    // Step 6: Missing fields check
    if (!('icao24' in a) || !('lat' in a) || !('lon' in a) || !('altitudeFeet' in a) || !('velocityKnots' in a) || !('heading' in a)) missingFields++;
  }

  process.stderr.write('=== Flight Data Field Validation (Post-fix) ===\n');
  process.stderr.write('Total aircraft: ' + total + '\n');
  process.stderr.write('Step 1 - Bad icao24 (empty): ' + badIcao + ' -> ' + (badIcao === 0 ? 'PASS' : 'FAIL') + '\n');
  process.stderr.write('Step 2 - Bad lat: ' + badLat + ', Bad lon: ' + badLon + ' -> ' + (badLat === 0 && badLon === 0 ? 'PASS' : 'FAIL') + '\n');
  process.stderr.write('Step 3 - NaN altitudeFeet: ' + nanAlt + ' -> ' + (nanAlt === 0 ? 'PASS' : 'FAIL') + '\n');
  process.stderr.write('Step 4 - NaN velocityKnots: ' + nanVel + ' -> ' + (nanVel === 0 ? 'PASS' : 'FAIL') + '\n');
  process.stderr.write('Step 5 - NaN heading: ' + nanHdg + ', Out of range: ' + badHdgRange + ' -> ' + (nanHdg === 0 && badHdgRange === 0 ? 'PASS' : 'FAIL') + '\n');
  process.stderr.write('Step 6 - Missing fields: ' + missingFields + ' -> ' + (missingFields === 0 ? 'PASS' : 'FAIL') + '\n');

  // Also test via Vite proxy
  var viteResult = await fetchJSON('http://localhost:5173/api/flights');
  var viteOk = viteResult.status === 200 && Array.isArray(viteResult.body) && viteResult.body.length > 0;
  process.stderr.write('Vite proxy: ' + (viteOk ? 'PASS' : 'FAIL') + ' (' + (Array.isArray(viteResult.body) ? viteResult.body.length : 'N/A') + ' flights)\n');

  var allPass = badIcao === 0 && badLat === 0 && badLon === 0 && nanAlt === 0 && nanVel === 0 && nanHdg === 0 && badHdgRange === 0 && missingFields === 0 && viteOk;
  process.stderr.write('\n=== ALL TESTS ' + (allPass ? 'PASSED' : 'SOME FAILED') + ' ===\n');
}

main().catch(function(err) {
  process.stderr.write('Error: ' + err.message + '\n');
  process.exit(1);
});
