const http = require('http');

// Test through Vite proxy (same as frontend fetch)
const url = 'http://localhost:5173/api/traffic/roads?south=-33.88&west=151.19&north=-33.86&east=151.22';

http.get(url, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    try {
      const data = JSON.parse(body);
      process.stdout.write('Status: ' + res.statusCode + '\n');
      process.stdout.write('Total roads: ' + data.length + '\n');
      process.stdout.write('Is array: ' + Array.isArray(data) + '\n');

      if (data.length > 0) {
        const classifications = {};
        let withLength = 0;
        data.forEach(r => {
          classifications[r.classification] = (classifications[r.classification] || 0) + 1;
          if (r.length > 0) withLength++;
        });
        process.stdout.write('Classifications: ' + JSON.stringify(classifications) + '\n');
        process.stdout.write('Roads with length > 0: ' + withLength + '\n');
        process.stdout.write('Sample road: ' + data[0].name + ' (' + data[0].classification + ') len=' + Math.round(data[0].length) + 'm\n');
      }
    } catch (e) {
      process.stdout.write('Parse error: ' + e.message + '\n');
      process.stdout.write('Body: ' + body.substring(0, 500) + '\n');
    }
  });
}).on('error', (e) => {
  process.stdout.write('Error: ' + e.message + '\n');
});
