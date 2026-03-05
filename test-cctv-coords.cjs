var http = require('http');

http.get('http://localhost:3001/api/cctv', function(res) {
  var data = '';
  res.on('data', function(chunk) { data += chunk; });
  res.on('end', function() {
    var cameras = JSON.parse(data);
    var zeroCams = cameras.filter(function(c) { return c.lat === 0 && c.lon === 0; });
    console.log('Cameras at (0,0):', zeroCams.length, '/', cameras.length);
    if (zeroCams.length > 0) {
      console.log('Sample zero-coord cameras:');
      zeroCams.slice(0, 5).forEach(function(c) {
        console.log('  ' + c.id + ' | ' + c.name + ' | country:' + c.country + ' | region:' + c.region);
      });
    }

    var validCams = cameras.filter(function(c) { return c.lat !== 0 || c.lon !== 0; });
    console.log('\nValid (non-zero) cameras:', validCams.length);

    // US cameras with valid coords
    var usValid = validCams.filter(function(c) { return c.country === 'US'; });
    console.log('US cameras with valid coords:', usValid.length);
    if (usValid.length > 0) {
      console.log('Sample US camera:', usValid[0].name, 'at (' + usValid[0].lat + ', ' + usValid[0].lon + ')');
    }
  });
}).on('error', function(e) {
  console.log('Error:', e.message);
});
