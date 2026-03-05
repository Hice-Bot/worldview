var http = require('http');

function fetchFlights(cb) {
  http.get('http://localhost:3001/api/flights', function(res) {
    var data = '';
    res.on('data', function(chunk) { data += chunk; });
    res.on('end', function() { cb(JSON.parse(data)); });
  });
}

console.log('Fetching first sample...');
fetchFlights(function(first) {
  var firstMap = {};
  first.forEach(function(f) { firstMap[f.icao24] = f; });
  console.log('First sample: ' + first.length + ' aircraft');
  console.log('Waiting 35 seconds for cache refresh...');

  setTimeout(function() {
    console.log('Fetching second sample...');
    fetchFlights(function(second) {
      console.log('Second sample: ' + second.length + ' aircraft');

      var moved = 0;
      var same = 0;
      var newAircraft = 0;
      var disappeared = 0;
      var examples = [];

      second.forEach(function(f) {
        if (firstMap[f.icao24]) {
          var prev = firstMap[f.icao24];
          if (prev.lat !== f.lat || prev.lon !== f.lon) {
            moved++;
            if (examples.length < 5) {
              examples.push(f.icao24 + ': (' + prev.lat + ',' + prev.lon + ') -> (' + f.lat + ',' + f.lon + ')');
            }
          } else {
            same++;
          }
        } else {
          newAircraft++;
        }
      });

      var secondMap = {};
      second.forEach(function(f) { secondMap[f.icao24] = true; });
      first.forEach(function(f) {
        if (!secondMap[f.icao24]) disappeared++;
      });

      console.log('\n--- Position change analysis ---');
      console.log('Moved:', moved);
      console.log('Same position:', same);
      console.log('New aircraft:', newAircraft);
      console.log('Disappeared:', disappeared);
      console.log('\nMovement examples:');
      examples.forEach(function(e) { console.log('  ' + e); });
      console.log('\nData refreshes show position changes:', moved > 0 ? 'PASS' : 'FAIL');
    });
  }, 35000);
});
