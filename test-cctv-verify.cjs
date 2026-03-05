var http = require('http');

http.get('http://localhost:3001/api/cctv', function(res) {
  var data = '';
  res.on('data', function(chunk) { data += chunk; });
  res.on('end', function() {
    try {
      var cameras = JSON.parse(data);
      console.log('HTTP Status:', res.statusCode);
      console.log('Total cameras:', cameras.length);
      if (cameras.length > 0) {
        console.log('\nSample camera:');
        console.log(JSON.stringify(cameras[0], null, 2));

        // Count by country
        var countries = {};
        cameras.forEach(function(c) {
          var country = c.country || 'unknown';
          countries[country] = (countries[country] || 0) + 1;
        });
        console.log('\nBy country:', JSON.stringify(countries));

        // Check fields
        var withLat = cameras.filter(function(c) { return typeof c.lat === 'number'; }).length;
        var withLon = cameras.filter(function(c) { return typeof c.lon === 'number'; }).length;
        var withName = cameras.filter(function(c) { return c.name && c.name.length > 0; }).length;
        var withImage = cameras.filter(function(c) { return c.imageUrl && c.imageUrl.length > 0; }).length;
        console.log('\nField coverage:');
        console.log('  With lat:', withLat + '/' + cameras.length);
        console.log('  With lon:', withLon + '/' + cameras.length);
        console.log('  With name:', withName + '/' + cameras.length);
        console.log('  With imageUrl:', withImage + '/' + cameras.length);
      }
    } catch(e) {
      console.log('Parse error:', e.message);
      console.log('Raw response (first 500):', data.substring(0, 500));
    }
  });
}).on('error', function(e) {
  console.log('Error:', e.message);
});
