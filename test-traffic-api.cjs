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
  var result = await fetchJSON('http://localhost:3001/api/traffic/roads?south=-33.90&west=151.15&north=-33.85&east=151.25');
  var roads = Array.isArray(result.data) ? result.data : [];
  console.log('Roads returned:', roads.length);

  var totalVehicles = 0;
  var cfg = {
    motorway: 2, trunk: 1.5, primary: 1,
    secondary: 0.5, tertiary: 0.3, residential: 0.2
  };
  var classCounts = {};

  roads.forEach(function(r) {
    classCounts[r.classification] = (classCounts[r.classification] || 0) + 1;
    var vPerKm = cfg[r.classification] || 0.2;
    var lengthKm = (r.length || 100) / 1000;
    var num = Math.max(1, Math.round(lengthKm * vPerKm));
    totalVehicles += Math.min(num, 5);
  });

  console.log('Classification:', JSON.stringify(classCounts));
  console.log('Estimated vehicles (cap 5/road):', totalVehicles);

  // Now test with larger area
  var result2 = await fetchJSON('http://localhost:3001/api/traffic/roads?south=-33.95&west=151.05&north=-33.80&east=151.35');
  var roads2 = Array.isArray(result2.data) ? result2.data : [];
  var v2 = 0;
  roads2.forEach(function(r) {
    var vPerKm = cfg[r.classification] || 0.2;
    var lengthKm = (r.length || 100) / 1000;
    v2 += Math.min(Math.max(1, Math.round(lengthKm * vPerKm)), 5);
  });
  console.log('Larger bbox roads:', roads2.length, 'vehicles:', v2);

  // Test with no bbox (Sydney fallback)
  var result3 = await fetchJSON('http://localhost:3001/api/traffic/roads');
  var roads3 = Array.isArray(result3.data) ? result3.data : [];
  var v3 = 0;
  roads3.forEach(function(r) {
    var vPerKm = cfg[r.classification] || 0.2;
    var lengthKm = (r.length || 100) / 1000;
    v3 += Math.min(Math.max(1, Math.round(lengthKm * vPerKm)), 5);
  });
  console.log('Sydney fallback roads:', roads3.length, 'vehicles:', v3);
}

main().catch(function(e) { console.error('Error:', e.message); });
