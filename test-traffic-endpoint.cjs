const http = require('http');

// Test with Sydney CBD bbox
const url = 'http://localhost:3001/api/traffic/roads?south=-33.88&west=151.19&north=-33.86&east=151.22';

http.get(url, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    const data = JSON.parse(body);
    const results = {
      status: res.statusCode,
      totalRoads: data.length,
      sample: data.slice(0, 3).map(r => ({
        id: r.id,
        classification: r.classification,
        name: r.name,
        length: r.length,
        geometryPoints: r.geometry.length,
      })),
      byClassification: {},
      withLength: 0,
      withGeometry: 0,
      avgLength: 0,
    };

    let totalLen = 0;
    data.forEach(r => {
      results.byClassification[r.classification] = (results.byClassification[r.classification] || 0) + 1;
      if (r.length > 0) results.withLength++;
      if (r.geometry && r.geometry.length >= 2) results.withGeometry++;
      totalLen += r.length || 0;
    });
    results.avgLength = data.length > 0 ? Math.round(totalLen / data.length) : 0;

    require('fs').writeFileSync('/tmp/traffic_results.json', JSON.stringify(results, null, 2));
    process.stdout.write(JSON.stringify(results, null, 2) + '\n');
  });
}).on('error', (e) => {
  process.stdout.write('Error: ' + e.message + '\n');
});
