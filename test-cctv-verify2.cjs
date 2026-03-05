const http = require('http');

http.get('http://localhost:3001/api/cctv', (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    const data = JSON.parse(body);

    // Check image URLs are real
    const tflSample = data.filter(c => c.country === 'GB').slice(0, 3);
    const usSample = data.filter(c => c.country === 'US').slice(0, 3);

    process.stdout.write('=== TfL Image URL Samples ===\n');
    tflSample.forEach(c => {
      process.stdout.write(c.name + ': ' + c.imageUrl + '\n');
    });

    process.stdout.write('\n=== US Image URL Samples ===\n');
    usSample.forEach(c => {
      process.stdout.write(c.name + ': ' + c.imageUrl + '\n');
    });

    // Verify all URLs are real (not mock/placeholder)
    const mockPatterns = ['mock', 'fake', 'sample', 'dummy', 'placeholder', 'example.com', 'test'];
    let mockHits = 0;
    data.forEach(c => {
      const url = (c.imageUrl || '').toLowerCase();
      const name = (c.name || '').toLowerCase();
      mockPatterns.forEach(p => {
        if (url.includes(p) || name.includes(p)) mockHits++;
      });
    });
    process.stdout.write('\nMock pattern hits in URLs/names: ' + mockHits + '\n');

    // Verify unique camera names (not generated)
    const uniqueNames = new Set(data.map(c => c.name));
    process.stdout.write('Unique names: ' + uniqueNames.size + ' / ' + data.length + '\n');

    // Verify real TfL JamCam URL pattern
    const tflUrlPattern = data.filter(c => c.country === 'GB' && c.imageUrl.includes('jamcams.tfl.gov.uk'));
    process.stdout.write('TfL JamCam URLs: ' + tflUrlPattern.length + '\n');

    // Verify real Austin URL pattern
    const austinUrlPattern = data.filter(c => c.country === 'US' && (c.imageUrl.includes('austin') || c.imageUrl.includes('cctv')));
    process.stdout.write('Austin CCTV URLs: ' + austinUrlPattern.length + '\n');

    process.stdout.write('\nHTTP Status: ' + res.statusCode + '\n');
  });
}).on('error', (e) => {
  process.stdout.write('Error: ' + e.message + '\n');
});
