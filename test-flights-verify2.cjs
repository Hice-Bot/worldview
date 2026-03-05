var http = require('http');

http.get('http://localhost:3001/api/flights', function(res) {
  var data = '';
  res.on('data', function(chunk) { data += chunk; });
  res.on('end', function() {
    var flights = JSON.parse(data);

    // Check negative altitudes
    console.log('--- Aircraft with negative altitudes ---');
    var negAlt = flights.filter(function(f) { return f.altitudeFeet < 0; });
    negAlt.slice(0, 10).forEach(function(f) {
      console.log('  ' + f.icao24 + ' | ' + f.callsign + ' | alt:' + f.altitudeFeet + 'ft | onGround:' + f.onGround);
    });
    console.log('Total negative alt:', negAlt.length);

    // Check high velocity
    console.log('\n--- Aircraft with velocity > 600 kts ---');
    var highVel = flights.filter(function(f) { return f.velocityKnots > 600; });
    highVel.forEach(function(f) {
      console.log('  ' + f.icao24 + ' | ' + f.callsign + ' | vel:' + f.velocityKnots + 'kts | alt:' + f.altitudeFeet + 'ft');
    });

    // Check altitude > 45000
    console.log('\n--- Aircraft above 45000 ft ---');
    var highAlt = flights.filter(function(f) { return f.altitudeFeet > 45000; });
    console.log('Count:', highAlt.length);
    highAlt.slice(0, 10).forEach(function(f) {
      console.log('  ' + f.icao24 + ' | ' + f.callsign + ' | alt:' + f.altitudeFeet + 'ft');
    });

    // Check data refresh - take second sample in 15s
    console.log('\n--- Data quality summary ---');
    console.log('onGround true count:', flights.filter(function(f) { return f.onGround === true; }).length);
    console.log('onGround false count:', flights.filter(function(f) { return f.onGround === false; }).length);
    console.log('With registration:', flights.filter(function(f) { return f.registration && f.registration.length > 0; }).length);
    console.log('With origin:', flights.filter(function(f) { return f.origin && f.origin.length > 0; }).length);
    console.log('With destination:', flights.filter(function(f) { return f.destination && f.destination.length > 0; }).length);
  });
}).on('error', function(e) {
  console.log('Error:', e.message);
});
