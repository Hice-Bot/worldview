const http = require('http');

http.get('http://localhost:3001/api/cctv', { timeout: 10000 }, (res) => {
  var data = '';
  res.on('data', function(c) { data += c; });
  res.on('end', function() {
    var cams = JSON.parse(data);
    var withImg = cams.filter(function(c) { return c.imageUrl; });
    console.log('Total cameras:', cams.length);
    console.log('With imageUrl:', withImg.length);
    if (withImg.length > 0) {
      console.log('Sample URL:', withImg[0].imageUrl);
      // Now test proxying this real URL
      var encoded = encodeURIComponent(withImg[0].imageUrl);
      http.get('http://localhost:3001/api/cctv/image?url=' + encoded, { timeout: 10000 }, function(imgRes) {
        var chunks = [];
        imgRes.on('data', function(c) { chunks.push(c); });
        imgRes.on('end', function() {
          var buf = Buffer.concat(chunks);
          console.log('Proxy status:', imgRes.statusCode);
          console.log('Content-Type:', imgRes.headers['content-type']);
          console.log('Image size:', buf.length, 'bytes');
          console.log(imgRes.statusCode === 200 && buf.length > 100 ? '✓ Real CCTV image proxied successfully' : '⚠ Issue with real image proxy');
        });
      }).on('error', function(e) { console.log('Proxy error:', e.message); });
    }
  });
}).on('error', function(e) { console.log('Error:', e.message); });
