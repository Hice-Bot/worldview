// Check if verticalRate field exists in flight data
var http = require('http');

http.get('http://localhost:3001/api/flights', function(res) {
  var data = '';
  res.on('data', function(chunk) { data += chunk; });
  res.on('end', function() {
    var flights = JSON.parse(data);
    var sample = flights.slice(0, 5);
    sample.forEach(function(f) {
      console.log(f.callsign || f.icao24, '- verticalRate:', f.verticalRate, '- keys:', Object.keys(f).join(', '));
    });
    var hasVR = flights.filter(function(f) { return f.verticalRate && f.verticalRate !== 0; });
    console.log('Flights with non-zero verticalRate:', hasVR.length, '/', flights.length);
  });
}).on('error', function(e) { console.error(e); });
