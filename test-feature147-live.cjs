var http = require('http');

function getJson(url) {
  return new Promise(function(resolve, reject) {
    http.get(url, function(res) {
      var body = '';
      res.on('data', function(chunk) { body += chunk; });
      res.on('end', function() { resolve(JSON.parse(body)); });
    }).on('error', reject);
  });
}

getJson('http://localhost:3001/api/cctv').then(function(cameras) {
  var cam = cameras.find(function(c) { return c.imageUrl && c.imageUrl.length > 10; });
  if (!cam) {
    console.log('No camera with imageUrl found');
    return;
  }
  console.log('Testing real image URL: ' + cam.imageUrl.slice(0, 80));

  var proxyUrl = 'http://localhost:3001/api/cctv/image?url=' + encodeURIComponent(cam.imageUrl);
  http.get(proxyUrl, function(res) {
    var chunks = [];
    res.on('data', function(c) { chunks.push(c); });
    res.on('end', function() {
      var size = Buffer.concat(chunks).length;
      console.log('Proxy response: status=' + res.statusCode + ' content-type=' + res.headers['content-type'] + ' size=' + size);
      if (res.statusCode === 200 && size > 100) {
        console.log('PASS: Real CCTV image proxy works');
      } else {
        console.log('WARN: Unexpected response');
      }
    });
  });
});
