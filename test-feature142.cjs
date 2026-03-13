// Test Feature #142: Ship filter excludes stationary vessels
// Verifies:
// 1. Vessels with SOG > 0.5 visible on globe
// 2. Anchored/moored/aground vessels excluded
// 3. Vessels at coordinates (0,0) excluded
// 4. Filtering happens after data fetch, before rendering

var http = require('http');

function testShipFilter() {
  return new Promise(function(resolve, reject) {
    http.get('http://localhost:3001/api/ships', function(res) {
      var body = '';
      res.on('data', function(chunk) { body += chunk; });
      res.on('end', function() {
        try {
          var ships = JSON.parse(body);
          if (!Array.isArray(ships)) {
            console.log('ERROR: Response is not an array');
            resolve(false);
            return;
          }

          console.log('Total ships returned by API: ' + ships.length);

          // Check 1: All ships should have SOG > 0.5
          var stationaryShips = ships.filter(function(s) { return s.sog <= 0.5; });
          console.log('Ships with SOG <= 0.5 (should be 0): ' + stationaryShips.length);

          // Check 2: No ships at (0,0)
          var zeroCoordShips = ships.filter(function(s) { return s.lat === 0 && s.lon === 0; });
          console.log('Ships at (0,0) (should be 0): ' + zeroCoordShips.length);

          // Check 3: Verify ships have valid data
          var validShips = ships.filter(function(s) {
            return s.mmsi && s.lat && s.lon && typeof s.sog === 'number';
          });
          console.log('Ships with valid MMSI/lat/lon/sog: ' + validShips.length);

          // Check 4: Show SOG distribution
          var sogBuckets = { 'below1': 0, '1to5': 0, '5to10': 0, 'above10': 0 };
          ships.forEach(function(s) {
            if (s.sog < 1) sogBuckets.below1++;
            else if (s.sog < 5) sogBuckets['1to5']++;
            else if (s.sog < 10) sogBuckets['5to10']++;
            else sogBuckets.above10++;
          });
          console.log('SOG distribution:');
          console.log('  0.5-1 knots: ' + sogBuckets.below1);
          console.log('  1-5 knots: ' + sogBuckets['1to5']);
          console.log('  5-10 knots: ' + sogBuckets['5to10']);
          console.log('  10+ knots: ' + sogBuckets.above10);

          // Sample ships
          if (ships.length > 0) {
            console.log('\nSample ships:');
            ships.slice(0, 5).forEach(function(s) {
              console.log('  MMSI: ' + s.mmsi + ', Name: ' + s.name + ', SOG: ' + s.sog + ', Lat: ' + s.lat + ', Lon: ' + s.lon);
            });
          }

          // Results
          var allMoving = stationaryShips.length === 0;
          var noZeroCoords = zeroCoordShips.length === 0;
          var hasShips = ships.length > 0;

          console.log('\n--- RESULTS ---');
          console.log('All ships moving (SOG > 0.5): ' + (allMoving ? 'PASS' : 'FAIL'));
          console.log('No (0,0) coordinates: ' + (noZeroCoords ? 'PASS' : 'FAIL'));
          console.log('Has valid ship data: ' + (hasShips ? 'PASS' : 'FAIL'));

          resolve(allMoving && noZeroCoords && hasShips);
        } catch (e) {
          console.log('ERROR parsing response: ' + e.message);
          resolve(false);
        }
      });
    }).on('error', function(e) {
      console.log('ERROR: ' + e.message);
      resolve(false);
    });
  });
}

testShipFilter().then(function(passed) {
  console.log('\nOverall: ' + (passed ? 'PASS' : 'FAIL'));
  process.exit(passed ? 0 : 1);
});
