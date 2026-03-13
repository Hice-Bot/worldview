const http = require('http');

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
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
  // Fetch flights from Express proxy
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
  var badAlt = 0;
  var badVel = 0;
  var badHdg = 0;
  var missingFields = 0;
  var nanAlt = 0;
  var nanVel = 0;
  var nanHdg = 0;

  for (var i = 0; i < data.length; i++) {
    var a = data[i];
    if (!a.icao24 || !/^[0-9a-f]{6}$/i.test(a.icao24)) badIcao++;
    if (typeof a.lat !== 'number' || isNaN(a.lat) || a.lat < -90 || a.lat > 90) badLat++;
    if (typeof a.lon !== 'number' || isNaN(a.lon) || a.lon < -180 || a.lon > 180) badLon++;
    if (typeof a.altitudeFeet !== 'number') badAlt++;
    if (typeof a.altitudeFeet === 'number' && isNaN(a.altitudeFeet)) nanAlt++;
    if (typeof a.velocityKnots !== 'number') badVel++;
    if (typeof a.velocityKnots === 'number' && isNaN(a.velocityKnots)) nanVel++;
    if (a.heading !== null && a.heading !== undefined) {
      if (typeof a.heading !== 'number') badHdg++;
      if (typeof a.heading === 'number' && isNaN(a.heading)) nanHdg++;
    }
    if (!('icao24' in a) || !('lat' in a) || !('lon' in a) || !('altitudeFeet' in a)) missingFields++;
  }

  process.stderr.write('=== Flight Data Field Validation ===\n');
  process.stderr.write('Total aircraft: ' + total + '\n');
  process.stderr.write('Bad icao24 (not 6-char hex): ' + badIcao + '\n');
  process.stderr.write('Bad lat (out of range/-90..90): ' + badLat + '\n');
  process.stderr.write('Bad lon (out of range/-180..180): ' + badLon + '\n');
  process.stderr.write('Bad altitudeFeet (not number): ' + badAlt + ', NaN: ' + nanAlt + '\n');
  process.stderr.write('Bad velocityKnots (not number): ' + badVel + ', NaN: ' + nanVel + '\n');
  process.stderr.write('Bad heading (not number): ' + badHdg + ', NaN: ' + nanHdg + '\n');
  process.stderr.write('Missing required fields: ' + missingFields + '\n');
  process.stderr.write('\n');

  // Show a sample
  if (data.length > 0) {
    process.stderr.write('Sample aircraft: ' + JSON.stringify(data[0]).substring(0, 250) + '\n\n');
  }

  // Check if these need server-side fixing or if the data is already clean enough
  var issues = badIcao > 0 || badLat > 0 || badLon > 0 || nanAlt > 0 || nanVel > 0 || nanHdg > 0 || missingFields > 0;
  process.stderr.write('Data quality issues found: ' + issues + '\n');

  // Also test via Vite proxy
  var viteResult = await fetchJSON('http://localhost:5173/api/flights');
  process.stderr.write('Vite proxy flights: status=' + viteResult.status + ' count=' + (Array.isArray(viteResult.body) ? viteResult.body.length : 'N/A') + '\n');
}

main().catch(function(err) {
  process.stderr.write('Error: ' + err.message + '\n');
  process.exit(1);
});
