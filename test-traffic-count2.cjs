const http = require('http');

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, { timeout: 15000 }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({ status: res.statusCode, data: JSON.parse(data) });
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

async function main() {
  // Test multiple bbox sizes
  const bboxes = [
    { label: 'Small (0.1°)', bbox: '151.15,-33.90,151.25,-33.85' },
    { label: 'Medium (0.2°)', bbox: '151.10,-33.95,151.30,-33.80' },
    { label: 'Large (0.3°)', bbox: '151.05,-34.00,151.35,-33.75' },
  ];

  for (const { label, bbox } of bboxes) {
    const result = await fetchJSON('http://localhost:3001/api/traffic/roads?bbox=' + bbox);
    const roads = Array.isArray(result.data) ? result.data : [];

    let totalVehicles = 0;
    const config = {
      motorway: {vPerKm:2}, trunk: {vPerKm:1.5}, primary: {vPerKm:1},
      secondary: {vPerKm:0.5}, tertiary: {vPerKm:0.3}, residential: {vPerKm:0.2}
    };

    roads.forEach(r => {
      const c = config[r.classification] || {vPerKm: 0.2};
      const lengthKm = (r.length_m || 100) / 1000;
      const num = Math.max(1, Math.round(lengthKm * c.vPerKm));
      totalVehicles += Math.min(num, 5);
    });

    console.log(label + ': ' + roads.length + ' roads, ~' + totalVehicles + ' vehicles');
  }
}

main().catch(e => console.error('Error:', e.message));
