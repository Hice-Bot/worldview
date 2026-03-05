const http = require('http');

// Test without bbox params - should return Sydney CBD fallback
const url = 'http://localhost:3001/api/traffic/roads';

http.get(url, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    const data = JSON.parse(body);
    process.stdout.write('Status: ' + res.statusCode + '\n');
    process.stdout.write('Total roads: ' + data.length + '\n');
    if (data.length > 0) {
      process.stdout.write('First road: ' + JSON.stringify(data[0]).substring(0, 200) + '\n');
    }
  });
}).on('error', (e) => {
  process.stdout.write('Error: ' + e.message + '\n');
});
