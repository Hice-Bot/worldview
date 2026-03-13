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
  // Fetch traffic roads for Sydney area
  const result = await fetchJSON('http://localhost:3001/api/traffic/roads?bbox=151.15,-33.90,151.25,-33.85');
  const roads = Array.isArray(result.data) ? result.data : [];
  console.log('Roads returned:', roads.length);

  // Estimate vehicle count based on road configs
  let totalVehicles = 0;
  const config = {
    motorway: {vPerKm:2}, trunk: {vPerKm:1.5}, primary: {vPerKm:1},
    secondary: {vPerKm:0.5}, tertiary: {vPerKm:0.3}, residential: {vPerKm:0.2}
  };
  const defaultVPerKm = 0.2;
  const classCounts = {};

  roads.forEach(r => {
    classCounts[r.classification] = (classCounts[r.classification] || 0) + 1;
    const c = config[r.classification] || {vPerKm: defaultVPerKm};
    const lengthKm = (r.length_m || 100) / 1000;
    const num = Math.max(1, Math.round(lengthKm * c.vPerKm));
    totalVehicles += Math.min(num, 5);
  });

  console.log('Classification distribution:', JSON.stringify(classCounts));
  console.log('Estimated vehicles (with cap 5/road):', totalVehicles);

  if (roads.length > 0) {
    console.log('Sample road:', JSON.stringify({
      name: roads[0].name,
      classification: roads[0].classification,
      length: roads[0].length_m,
      points: roads[0].geometry ? roads[0].geometry.length : 0
    }));
  }
}

main().catch(e => console.error('Error:', e.message));
