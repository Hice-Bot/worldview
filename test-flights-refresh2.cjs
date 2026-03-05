var http = require('http');

function fetchFlights(cb) {
  http.get('http://localhost:3001/api/flights', function(res) {
    var data = '';
    res.on('data', function(chunk) { data += chunk; });
    res.on('end', function() {
      try {
        cb(null, JSON.parse(data));
      } catch(e) {
        cb(e, null);
      }
    });
  }).on('error', function(e) { cb(e, null); });
}

console.log('Fetching first sample...');
fetchFlights(function(err, first) {
  if (err) { console.log('Error on first fetch:', err.message); return; }
  var firstMap = {};
  first.forEach(function(f) { firstMap[f.icao24] = f; });
  console.log('First sample: ' + first.length + ' aircraft');

  // Pick 5 specific aircraft to track
  var tracked = first.filter(function(f) { return !f.onGround && f.velocityKnots > 100; }).slice(0, 5);
  console.log('Tracking ' + tracked.length + ' aircraft:');
  tracked.forEach(function(f) {
    console.log('  ' + f.icao24 + ' (' + f.callsign + ') at (' + f.lat + ', ' + f.lon + ') hdg:' + f.heading + ' vel:' + f.velocityKnots + 'kts');
  });

  console.log('\nWaiting 35 seconds for cache expiry + fresh upstream fetch...');
  setTimeout(function() {
    console.log('Fetching second sample...');
    fetchFlights(function(err2, second) {
      if (err2) { console.log('Error on second fetch:', err2.message); return; }
      console.log('Second sample: ' + second.length + ' aircraft');

      var secondMap = {};
      second.forEach(function(f) { secondMap[f.icao24] = f; });

      console.log('\nPosition changes for tracked aircraft:');
      var changeCount = 0;
      tracked.forEach(function(f) {
        var updated = secondMap[f.icao24];
        if (updated) {
          var latDiff = Math.abs(updated.lat - f.lat);
          var lonDiff = Math.abs(updated.lon - f.lon);
          var moved = latDiff > 0.001 || lonDiff > 0.001;
          if (moved) changeCount++;
          console.log('  ' + f.icao24 + ': (' + f.lat + ',' + f.lon + ') -> (' + updated.lat + ',' + updated.lon + ') ' + (moved ? 'MOVED' : 'SAME'));
        } else {
          console.log('  ' + f.icao24 + ': DISAPPEARED');
        }
      });

      // Also count global changes
      var globalMoved = 0;
      second.forEach(function(f) {
        if (firstMap[f.icao24]) {
          var prev = firstMap[f.icao24];
          if (Math.abs(prev.lat - f.lat) > 0.001 || Math.abs(prev.lon - f.lon) > 0.001) {
            globalMoved++;
          }
        }
      });

      console.log('\nGlobal: ' + globalMoved + ' aircraft changed position out of ' + second.length);
      console.log('Data refresh shows position changes: ' + (globalMoved > 100 ? 'PASS' : 'FAIL'));
    });
  }, 35000);
});
