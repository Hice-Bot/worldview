var https = require('https');

https.get('https://data.austintexas.gov/resource/b4k4-adkb.json', function(res) {
  var data = '';
  res.on('data', function(chunk) { data += chunk; });
  res.on('end', function() {
    var cams = JSON.parse(data);
    console.log('Total Austin cameras:', cams.length);
    if (cams.length > 0) {
      console.log('\nAll fields in first camera:');
      console.log(JSON.stringify(cams[0], null, 2));

      // Check what lat/lon fields exist
      var keys = Object.keys(cams[0]);
      console.log('\nField names:', keys.join(', '));

      // Try to find lat/lon fields
      keys.forEach(function(k) {
        var v = cams[0][k];
        if (typeof v === 'object' && v !== null) {
          console.log('\nObject field "' + k + '":', JSON.stringify(v));
        }
      });
    }
  });
}).on('error', function(e) {
  console.log('Error:', e.message);
});
