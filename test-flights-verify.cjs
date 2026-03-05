var http = require('http');

http.get('http://localhost:3001/api/flights', function(res) {
  var data = '';
  res.on('data', function(chunk) { data += chunk; });
  res.on('end', function() {
    var flights = JSON.parse(data);
    console.log('HTTP Status:', res.statusCode);
    console.log('Total aircraft:', flights.length);

    if (flights.length > 0) {
      var s = flights[0];
      console.log('\nSample aircraft:');
      console.log(JSON.stringify(s, null, 2));

      // Check required fields
      console.log('\n--- Field checks ---');
      console.log('Has icao24:', 'icao24' in s, '| value:', s.icao24);
      console.log('Has lat:', 'lat' in s, '| value:', s.lat);
      console.log('Has lon:', 'lon' in s, '| value:', s.lon);
      console.log('Has callsign:', 'callsign' in s, '| value:', s.callsign);
      console.log('Has altitudeFeet:', 'altitudeFeet' in s, '| value:', s.altitudeFeet);
      console.log('Has velocityKnots:', 'velocityKnots' in s, '| value:', s.velocityKnots);
      console.log('Has heading:', 'heading' in s, '| value:', s.heading);

      // Validate ICAO24 codes (6-char hex)
      var validIcao = 0;
      var invalidIcao = 0;
      var icaoSamples = [];
      flights.forEach(function(f) {
        if (f.icao24 && /^[0-9a-f]{6}$/i.test(f.icao24)) {
          validIcao++;
          if (icaoSamples.length < 10) icaoSamples.push(f.icao24);
        } else {
          invalidIcao++;
        }
      });
      console.log('\n--- ICAO24 validation ---');
      console.log('Valid 6-char hex:', validIcao);
      console.log('Invalid:', invalidIcao);
      console.log('Samples:', icaoSamples.join(', '));

      // Validate lat/lon ranges
      var validCoords = 0;
      var invalidCoords = 0;
      flights.forEach(function(f) {
        if (f.lat >= -90 && f.lat <= 90 && f.lon >= -180 && f.lon <= 180) {
          validCoords++;
        } else {
          invalidCoords++;
        }
      });
      console.log('\n--- Coordinate validation ---');
      console.log('Valid coords:', validCoords);
      console.log('Invalid coords:', invalidCoords);

      // Validate altitude (0-45000 feet)
      var validAlt = 0;
      var invalidAlt = 0;
      var altSamples = [];
      flights.forEach(function(f) {
        var alt = f.altitudeFeet || 0;
        if (alt >= 0 && alt <= 55000) {
          validAlt++;
        } else {
          invalidAlt++;
          if (altSamples.length < 5) altSamples.push(alt);
        }
      });
      console.log('\n--- Altitude validation ---');
      console.log('Valid altitude (0-55000ft):', validAlt);
      console.log('Invalid altitude:', invalidAlt);
      if (invalidAlt > 0) console.log('Invalid samples:', altSamples.join(', '));

      // Validate velocity (0-600 knots)
      var validVel = 0;
      var invalidVel = 0;
      flights.forEach(function(f) {
        var vel = f.velocityKnots || 0;
        if (vel >= 0 && vel <= 700) {
          validVel++;
        } else {
          invalidVel++;
        }
      });
      console.log('\n--- Velocity validation ---');
      console.log('Valid velocity (0-700kts):', validVel);
      console.log('Invalid velocity:', invalidVel);

      // Validate heading (0-360)
      var validHdg = 0;
      var invalidHdg = 0;
      flights.forEach(function(f) {
        var hdg = f.heading;
        if (hdg === null || hdg === undefined || (hdg >= 0 && hdg <= 360)) {
          validHdg++;
        } else {
          invalidHdg++;
        }
      });
      console.log('\n--- Heading validation ---');
      console.log('Valid heading (0-360):', validHdg);
      console.log('Invalid heading:', invalidHdg);

      // Check callsign format
      var withCallsign = 0;
      var callsignSamples = [];
      flights.forEach(function(f) {
        if (f.callsign && f.callsign.trim().length > 0) {
          withCallsign++;
          if (callsignSamples.length < 10) callsignSamples.push(f.callsign);
        }
      });
      console.log('\n--- Callsign check ---');
      console.log('With callsign:', withCallsign, '/', flights.length);
      console.log('Samples:', callsignSamples.join(', '));

      // Summary
      console.log('\n=== SUMMARY ===');
      console.log('Total aircraft:', flights.length);
      console.log('Min 100 aircraft:', flights.length >= 100 ? 'PASS' : 'FAIL');
      console.log('Valid ICAO24 codes:', validIcao === flights.length ? 'ALL PASS' : validIcao + '/' + flights.length);
      console.log('Valid coordinates:', validCoords === flights.length ? 'ALL PASS' : validCoords + '/' + flights.length);
      console.log('Valid altitudes:', validAlt === flights.length ? 'ALL PASS' : validAlt + '/' + flights.length);
      console.log('Valid velocities:', validVel === flights.length ? 'ALL PASS' : validVel + '/' + flights.length);
      console.log('Valid headings:', validHdg === flights.length ? 'ALL PASS' : validHdg + '/' + flights.length);
    }
  });
}).on('error', function(e) {
  console.log('Error:', e.message);
});
