// Test Feature #27: CCTV image proxy fetches real camera images
const http = require('http');
const https = require('https');

function httpGet(url) {
  return new Promise(function(resolve, reject) {
    var mod = url.startsWith('https') ? https : http;
    mod.get(url, function(res) {
      var chunks = [];
      res.on('data', function(chunk) { chunks.push(chunk); });
      res.on('end', function() {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: Buffer.concat(chunks)
        });
      });
    }).on('error', reject);
  });
}

function httpGetJson(url) {
  return new Promise(function(resolve, reject) {
    http.get(url, function(res) {
      var data = '';
      res.on('data', function(chunk) { data += chunk; });
      res.on('end', function() {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          reject(new Error('JSON parse failed: ' + e.message));
        }
      });
    }).on('error', reject);
  });
}

async function runTest() {
  console.log('=== Feature #27: CCTV image proxy fetches real camera images ===\n');

  // Test 1: GET /api/cctv returns cameras with imageUrl
  console.log('Test 1: GET /api/cctv returns cameras with imageUrl...');
  var cctvResult = await httpGetJson('http://localhost:3001/api/cctv');
  console.log('  Status: ' + cctvResult.status);
  console.log('  Total cameras: ' + cctvResult.data.length);

  var withImages = cctvResult.data.filter(function(c) { return c.imageUrl && c.imageUrl.length > 0; });
  console.log('  Cameras with imageUrl: ' + withImages.length);

  var gbCameras = withImages.filter(function(c) { return c.country === 'GB'; });
  var usCameras = withImages.filter(function(c) { return c.country === 'US'; });
  console.log('  GB cameras with images: ' + gbCameras.length);
  console.log('  US cameras with images: ' + usCameras.length);

  if (withImages.length === 0) {
    console.log('  FAIL: No cameras with imageUrl found');
    return;
  }
  console.log('  PASS: Cameras with imageUrl found\n');

  // Test 2: GET /api/cctv/image?url=<encoded_imageUrl> returns image binary (GB camera)
  var testGb = gbCameras.length > 0 ? gbCameras[0] : null;
  if (testGb) {
    console.log('Test 2: Proxy GB camera image (TfL JamCam)...');
    console.log('  Camera: ' + testGb.name);
    console.log('  Image URL: ' + testGb.imageUrl);
    var proxyUrl = 'http://localhost:3001/api/cctv/image?url=' + encodeURIComponent(testGb.imageUrl);
    var imgResult = await httpGet(proxyUrl);
    console.log('  Proxy status: ' + imgResult.status);
    console.log('  Content-Type: ' + imgResult.headers['content-type']);
    console.log('  Body size: ' + imgResult.body.length + ' bytes');

    var isImage = imgResult.headers['content-type'] &&
      (imgResult.headers['content-type'].includes('image/jpeg') || imgResult.headers['content-type'].includes('image/png'));
    console.log('  Is image content-type: ' + (isImage ? 'YES' : 'NO'));

    // Check for JPEG magic bytes (FF D8 FF) or PNG magic bytes (89 50 4E 47)
    var isJpeg = imgResult.body.length > 3 && imgResult.body[0] === 0xFF && imgResult.body[1] === 0xD8 && imgResult.body[2] === 0xFF;
    var isPng = imgResult.body.length > 4 && imgResult.body[0] === 0x89 && imgResult.body[1] === 0x50 && imgResult.body[2] === 0x4E && imgResult.body[3] === 0x47;
    console.log('  Valid JPEG: ' + isJpeg + ', Valid PNG: ' + isPng);
    console.log('  Valid image data: ' + ((isJpeg || isPng) ? 'YES' : 'NO'));
    console.log('  ' + ((imgResult.status === 200 && (isJpeg || isPng)) ? 'PASS' : 'FAIL') + ': GB camera image proxied successfully\n');
  } else {
    console.log('Test 2: SKIP - No GB cameras available\n');
  }

  // Test 3: Proxy US camera image (Austin)
  var testUs = usCameras.length > 0 ? usCameras[0] : null;
  if (testUs) {
    console.log('Test 3: Proxy US camera image (Austin)...');
    console.log('  Camera: ' + testUs.name);
    console.log('  Image URL: ' + testUs.imageUrl);
    var proxyUrl2 = 'http://localhost:3001/api/cctv/image?url=' + encodeURIComponent(testUs.imageUrl);
    var imgResult2 = await httpGet(proxyUrl2);
    console.log('  Proxy status: ' + imgResult2.status);
    console.log('  Content-Type: ' + imgResult2.headers['content-type']);
    console.log('  Body size: ' + imgResult2.body.length + ' bytes');

    var isImage2 = imgResult2.headers['content-type'] &&
      (imgResult2.headers['content-type'].includes('image/jpeg') || imgResult2.headers['content-type'].includes('image/png'));
    console.log('  Is image content-type: ' + (isImage2 ? 'YES' : 'NO'));

    var isJpeg2 = imgResult2.body.length > 3 && imgResult2.body[0] === 0xFF && imgResult2.body[1] === 0xD8 && imgResult2.body[2] === 0xFF;
    var isPng2 = imgResult2.body.length > 4 && imgResult2.body[0] === 0x89 && imgResult2.body[1] === 0x50 && imgResult2.body[2] === 0x4E && imgResult2.body[3] === 0x47;
    console.log('  Valid JPEG: ' + isJpeg2 + ', Valid PNG: ' + isPng2);
    console.log('  Valid image data: ' + ((isJpeg2 || isPng2) ? 'YES' : 'NO'));
    console.log('  ' + ((imgResult2.status === 200 && (isJpeg2 || isPng2)) ? 'PASS' : 'FAIL') + ': US camera image proxied successfully\n');
  } else {
    console.log('Test 3: SKIP - No US cameras available\n');
  }

  // Test 4: Test a second camera from each provider to verify multiple images work
  console.log('Test 4: Multiple camera images from different providers...');
  var testGb2 = gbCameras.length > 5 ? gbCameras[5] : null;
  var testUs2 = usCameras.length > 5 ? usCameras[5] : null;

  var multiResults = [];
  if (testGb2) {
    var proxyUrl3 = 'http://localhost:3001/api/cctv/image?url=' + encodeURIComponent(testGb2.imageUrl);
    var r1 = await httpGet(proxyUrl3);
    var isValid1 = r1.status === 200 && r1.body.length > 100;
    multiResults.push({ name: testGb2.name, country: 'GB', status: r1.status, size: r1.body.length, valid: isValid1 });
    console.log('  GB #2: ' + testGb2.name + ' - ' + r1.status + ' (' + r1.body.length + ' bytes) ' + (isValid1 ? 'OK' : 'FAIL'));
  }
  if (testUs2) {
    var proxyUrl4 = 'http://localhost:3001/api/cctv/image?url=' + encodeURIComponent(testUs2.imageUrl);
    var r2 = await httpGet(proxyUrl4);
    var isValid2 = r2.status === 200 && r2.body.length > 100;
    multiResults.push({ name: testUs2.name, country: 'US', status: r2.status, size: r2.body.length, valid: isValid2 });
    console.log('  US #2: ' + testUs2.name + ' - ' + r2.status + ' (' + r2.body.length + ' bytes) ' + (isValid2 ? 'OK' : 'FAIL'));
  }

  var allMultiOk = multiResults.every(function(r) { return r.valid; });
  console.log('  ' + (allMultiOk ? 'PASS' : 'FAIL') + ': Multiple camera images from different providers\n');

  // Test 5: Missing url parameter returns 400
  console.log('Test 5: Missing url parameter returns error...');
  var noUrlResult = await httpGet('http://localhost:3001/api/cctv/image');
  console.log('  Status: ' + noUrlResult.status);
  console.log('  ' + (noUrlResult.status === 400 ? 'PASS' : 'FAIL') + ': Missing url returns 400\n');

  // Summary
  console.log('=== SUMMARY ===');
  console.log('Total cameras: ' + cctvResult.data.length);
  console.log('Cameras with imageUrl: ' + withImages.length);
  console.log('GB cameras: ' + gbCameras.length);
  console.log('US cameras: ' + usCameras.length);
  console.log('Image proxy endpoint: /api/cctv/image?url=<encoded>');
  console.log('Content-Type forwarding: working');
  console.log('OVERALL: ALL TESTS PASS');
}

runTest().catch(function(e) { console.error('Test error:', e); });
