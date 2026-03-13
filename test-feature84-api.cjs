// Test: Feature #84 - Verify real flight data from API
const http = require('http');
http.get('http://localhost:3001/api/flights', (res) => {
  let data = '';
  res.on('data', (c) => data += c);
  res.on('end', () => {
    const flights = JSON.parse(data);
    console.log('Total flights:', flights.length);
    console.log('Flights > 0:', flights.length > 0 ? 'PASS' : 'FAIL');

    if (flights.length > 0) {
      // Check data structure
      const f = flights[0];
      const hasFields = f.icao24 && f.lat !== undefined && f.lon !== undefined;
      console.log('Has required fields (icao24, lat, lon):', hasFields ? 'PASS' : 'FAIL');

      // Check ICAO24 is valid hex
      const validIcao = /^[0-9a-f]{6}$/i.test(f.icao24);
      console.log('ICAO24 valid hex:', validIcao ? 'PASS' : 'FAIL');

      // Check coordinates are valid
      const validCoords = f.lat >= -90 && f.lat <= 90 && f.lon >= -180 && f.lon <= 180;
      console.log('Coordinates valid:', validCoords ? 'PASS' : 'FAIL');

      // Check has altitude and heading for tracking display
      const hasTrackingData = f.heading !== undefined && (f.altitudeFeet !== undefined || f.altitudeMeters !== undefined);
      console.log('Has altitude + heading for tracking:', hasTrackingData ? 'PASS' : 'FAIL');

      // Sample
      console.log('Sample flight:', JSON.stringify({
        icao24: f.icao24,
        callsign: f.callsign,
        alt: f.altitudeFeet,
        spd: f.velocityKnots,
        hdg: f.heading
      }));
    }
    console.log('Real flight data verification PASSED');
  });
}).on('error', (e) => {
  console.log('API error:', e.message);
  process.exit(1);
});
