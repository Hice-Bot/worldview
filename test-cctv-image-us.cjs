var http = require('http');

http.get('http://localhost:3001/api/cctv', function(res) {
  var data = '';
  res.on('data', function(chunk) { data += chunk; });
  res.on('end', function() {
    var cameras = JSON.parse(data);
    var usCams = cameras.filter(function(c) { return c.country === 'US' && c.imageUrl; });
    console.log('US cameras with images:', usCams.length);

    if (usCams.length > 0) {
      var testCam = usCams[0];
      console.log('Testing:', testCam.name, '| URL:', testCam.imageUrl);

      var proxyUrl = '/api/cctv/image?url=' + encodeURIComponent(testCam.imageUrl);
      http.get('http://localhost:3001' + proxyUrl, function(imgRes) {
        var size = 0;
        imgRes.on('data', function(chunk) { size += chunk.length; });
        imgRes.on('end', function() {
          console.log('Status:', imgRes.statusCode, '| Type:', imgRes.headers['content-type'], '| Size:', size, 'bytes');
          console.log('US image proxy: ' + (imgRes.statusCode === 200 && size > 0 ? 'PASS' : 'FAIL'));
        });
      }).on('error', function(e) { console.log('Error:', e.message); });
    }
  });
}).on('error', function(e) { console.log('Error:', e.message); });
