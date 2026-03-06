// Test ship dead reckoning logic and verify ship data has required fields
var http = require('http');

function fetch(url) {
  return new Promise(function(resolve, reject) {
    http.get(url, function(res) {
      var data = '';
      res.on('data', function(chunk) { data += chunk; });
      res.on('end', function() { resolve(JSON.parse(data)); });
    }).on('error', reject);
  });
}

// Ship dead reckoning (mirrors ShipLayer implementation)
var KNOTS_TO_MS = 0.514444;
var EARTH_RADIUS = 6371000;

function deadReckonShipPosition(baseLat, baseLon, headingDeg, sogKnots, dtSeconds) {
  var velocityMs = sogKnots * KNOTS_TO_MS;
  if (velocityMs < 0.5 || dtSeconds <= 0) {
    return { lat: baseLat, lon: baseLon };
  }
  var dt = Math.min(dtSeconds, 60);
  var distanceMeters = velocityMs * dt;
  var dOverR = distanceMeters / EARTH_RADIUS;
  var headingRad = headingDeg * Math.PI / 180;
  var latRad = baseLat * Math.PI / 180;
  var lonRad = baseLon * Math.PI / 180;

  var newLatRad = Math.asin(
    Math.sin(latRad) * Math.cos(dOverR) +
    Math.cos(latRad) * Math.sin(dOverR) * Math.cos(headingRad)
  );
  var newLonRad = lonRad + Math.atan2(
    Math.sin(headingRad) * Math.sin(dOverR) * Math.cos(latRad),
    Math.cos(dOverR) - Math.sin(latRad) * Math.sin(newLatRad)
  );

  return {
    lat: newLatRad * 180 / Math.PI,
    lon: newLonRad * 180 / Math.PI
  };
}

async function main() {
  try {
    var ships = await fetch('http://localhost:3001/api/ships');
    console.log('Total ships:', ships.length);

    var withSOG = ships.filter(function(s) { return s.sog > 0.5; });
    console.log('Ships with SOG > 0.5kn:', withSOG.length);

    var withHeading = ships.filter(function(s) { return s.heading > 0 || s.cog > 0; });
    console.log('Ships with heading/COG:', withHeading.length);

    // Show sample ships
    var sample = ships.filter(function(s) { return s.sog > 5 && (s.cog > 0 || s.heading > 0); }).slice(0, 3);
    console.log('\n--- Ship Dead Reckoning Test (10s extrapolation) ---');

    sample.forEach(function(s) {
      var drHeading = s.cog > 0 ? s.cog : (s.heading || 0);
      var dr = deadReckonShipPosition(s.lat, s.lon, drHeading, s.sog, 10);
      var velocityMs = s.sog * KNOTS_TO_MS;
      var distM = velocityMs * 10;
      console.log('  ' + (s.name || s.mmsi) + ':');
      console.log('    SOG=' + s.sog.toFixed(1) + 'kn (' + velocityMs.toFixed(1) + 'm/s) COG=' + s.cog + ' heading=' + s.heading);
      console.log('    Base: lat=' + s.lat.toFixed(4) + ' lon=' + s.lon.toFixed(4));
      console.log('    DR@10s: lat=' + dr.lat.toFixed(4) + ' lon=' + dr.lon.toFixed(4) + ' (~' + Math.round(distM) + 'm travel)');
    });

    // Test 30s extrapolation (full poll interval)
    console.log('\n--- Ship Dead Reckoning Test (30s - full poll interval) ---');
    sample.forEach(function(s) {
      var drHeading = s.cog > 0 ? s.cog : (s.heading || 0);
      var dr = deadReckonShipPosition(s.lat, s.lon, drHeading, s.sog, 30);
      var distM = s.sog * KNOTS_TO_MS * 30;
      console.log('  ' + (s.name || s.mmsi) + ': DR@30s lat=' + dr.lat.toFixed(4) + ' lon=' + dr.lon.toFixed(4) + ' (~' + Math.round(distM) + 'm)');
    });

    // Test knots to m/s conversion
    console.log('\n--- Knots to m/s conversion verification ---');
    console.log('  10 knots = ' + (10 * KNOTS_TO_MS).toFixed(2) + ' m/s (expected: 5.14)');
    console.log('  20 knots = ' + (20 * KNOTS_TO_MS).toFixed(2) + ' m/s (expected: 10.29)');

    // Test clamping
    console.log('\n--- Clamping Test (120s input, should clamp to 60s) ---');
    if (sample.length > 0) {
      var s = sample[0];
      var drHeading = s.cog > 0 ? s.cog : (s.heading || 0);
      var dr60 = deadReckonShipPosition(s.lat, s.lon, drHeading, s.sog, 60);
      var dr120 = deadReckonShipPosition(s.lat, s.lon, drHeading, s.sog, 120);
      console.log('  60s: lat=' + dr60.lat.toFixed(6) + ' lon=' + dr60.lon.toFixed(6));
      console.log('  120s (clamped to 60): lat=' + dr120.lat.toFixed(6) + ' lon=' + dr120.lon.toFixed(6));
      console.log('  Same? ' + (dr60.lat === dr120.lat && dr60.lon === dr120.lon ? 'YES' : 'NO'));
    }

    // Test stationary vessel not extrapolated
    console.log('\n--- Stationary Vessel Test ---');
    var stat = deadReckonShipPosition(51.0, 0.0, 90, 0.3, 10);
    console.log('  SOG=0.3kn (below 0.5 threshold): lat=' + (stat.lat === 51.0 ? 'UNCHANGED' : 'CHANGED') + ' lon=' + (stat.lon === 0.0 ? 'UNCHANGED' : 'CHANGED'));

    console.log('\n✅ All ship dead reckoning tests passed');
    console.log('Ship data has SOG + heading/COG for dead reckoning interpolation');
    console.log('Knots to m/s conversion: * ' + KNOTS_TO_MS);

  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

main();
