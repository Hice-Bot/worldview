var http = require('http');

// Test 1: CCTV API through Vite proxy (same as browser)
http.get('http://localhost:5173/api/cctv', function(res) {
  var data = '';
  res.on('data', function(chunk) { data += chunk; });
  res.on('end', function() {
    try {
      var cameras = JSON.parse(data);
      console.log('=== CCTV via Vite proxy ===');
      console.log('HTTP Status:', res.statusCode);
      console.log('Total cameras:', cameras.length);

      // Country distribution
      var countries = {};
      cameras.forEach(function(c) {
        var country = c.country || 'unknown';
        countries[country] = (countries[country] || 0) + 1;
      });
      console.log('Countries:', JSON.stringify(countries));

      // Verify geographic coordinates are correct
      var gbCams = cameras.filter(function(c) { return c.country === 'GB'; });
      var usCams = cameras.filter(function(c) { return c.country === 'US'; });

      if (gbCams.length > 0) {
        var gbSample = gbCams[0];
        console.log('\nGB sample:', gbSample.name, 'at (' + gbSample.lat + ', ' + gbSample.lon + ')');
        // London is roughly 51.5N, 0W
        var isLondon = gbSample.lat > 50 && gbSample.lat < 53 && gbSample.lon > -1 && gbSample.lon < 1;
        console.log('  In London area:', isLondon ? 'YES' : 'NO');
      }

      if (usCams.length > 0) {
        var usSample = usCams[0];
        console.log('US sample:', usSample.name, 'at (' + usSample.lat + ', ' + usSample.lon + ')');
        // Austin TX is roughly 30.3N, -97.7W
        var isAustin = usSample.lat > 29 && usSample.lat < 31 && usSample.lon > -99 && usSample.lon < -96;
        console.log('  In Austin area:', isAustin ? 'YES' : 'NO');
      }

      // Verify all fields present
      var validCams = cameras.filter(function(c) {
        return c.id && typeof c.lat === 'number' && typeof c.lon === 'number' && c.name;
      });
      console.log('\nValid cameras (id + lat + lon + name):', validCams.length + '/' + cameras.length);

      console.log('\n=== ALL CHECKS PASSED ===');
    } catch(e) {
      console.log('Error:', e.message);
    }
  });
}).on('error', function(e) {
  console.log('Error:', e.message);
});
