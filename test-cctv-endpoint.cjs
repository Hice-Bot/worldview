const http = require('http');

http.get('http://localhost:3001/api/cctv', (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    const data = JSON.parse(body);
    const results = {
      total: data.length,
      fields: Object.keys(data[0] || {}),
      sample: data.slice(0, 3),
      byCountry: {},
      londonCount: 0,
      austinCount: 0,
      withImageUrl: 0,
      withNames: 0,
      withRegion: 0,
      withId: 0,
      tflCount: 0
    };

    data.forEach(c => {
      const country = c.country || 'unknown';
      results.byCountry[country] = (results.byCountry[country] || 0) + 1;
      if (c.lat > 51 && c.lat < 52 && c.lon > -1 && c.lon < 1) results.londonCount++;
      if (c.lat > 30 && c.lat < 31 && c.lon > -98 && c.lon < -97) results.austinCount++;
      if (c.imageUrl && c.imageUrl.length > 0) results.withImageUrl++;
      if (c.name && c.name.length > 0) results.withNames++;
      if (c.region) results.withRegion++;
      if (c.id) results.withId++;
      if (c.source === 'tfl' || country === 'GB') results.tflCount++;
    });

    const out = JSON.stringify(results, null, 2);
    require('fs').writeFileSync('/tmp/cctv_results.json', out);
    process.stdout.write(out + '\n');
  });
}).on('error', (e) => {
  process.stdout.write('Error: ' + e.message + '\n');
});
