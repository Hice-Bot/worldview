var http = require('http');

// First get a camera with an imageUrl
http.get('http://localhost:3001/api/cctv', function(res) {
  var data = '';
  res.on('data', function(chunk) { data += chunk; });
  res.on('end', function() {
    var cameras = JSON.parse(data);

    // Find cameras with imageUrls
    var withImage = cameras.filter(function(c) { return c.imageUrl && c.imageUrl.length > 0; });
    console.log('Cameras with images:', withImage.length);

    if (withImage.length > 0) {
      var testCam = withImage[0];
      console.log('Testing image proxy for:', testCam.name);
      console.log('Original URL:', testCam.imageUrl);

      var proxyUrl = '/api/cctv/image?url=' + encodeURIComponent(testCam.imageUrl);
      console.log('Proxy URL:', proxyUrl);

      // Test the proxy endpoint
      http.get('http://localhost:3001' + proxyUrl, function(imgRes) {
        console.log('\nImage proxy response:');
        console.log('  Status:', imgRes.statusCode);
        console.log('  Content-Type:', imgRes.headers['content-type']);

        var size = 0;
        imgRes.on('data', function(chunk) { size += chunk.length; });
        imgRes.on('end', function() {
          console.log('  Content size:', size, 'bytes');
          console.log('  Is image:', imgRes.headers['content-type'] && imgRes.headers['content-type'].indexOf('image') >= 0 ? 'YES' : 'NO');
          console.log('\nImage proxy: ' + (imgRes.statusCode === 200 ? 'PASS' : 'FAIL'));
        });
      }).on('error', function(e) {
        console.log('Image proxy error:', e.message);
      });
    }
  });
}).on('error', function(e) {
  console.log('Error:', e.message);
});
