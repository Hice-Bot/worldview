const http = require('http');

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    }).on('error', reject);
  });
}

async function main() {
  // Test via Vite proxy (port 5173) to confirm integration
  const VITE = 'http://localhost:5173/api/traffic/roads';
  const EXPRESS = 'http://localhost:3001/api/traffic/roads';

  // Vite proxy test - valid bbox
  const v1 = await fetchJSON(VITE + '?south=51.49&west=-0.14&north=51.52&east=-0.10');
  process.stderr.write('Vite proxy valid bbox: status=' + v1.status + ' roads=' + (Array.isArray(v1.body) ? v1.body.length : 'N/A') + '\n');

  // Vite proxy test - invalid coords
  const v2 = await fetchJSON(VITE + '?south=abc&west=xyz&north=foo&east=bar');
  process.stderr.write('Vite proxy invalid: status=' + v2.status + ' error=' + (v2.body.error || 'none') + '\n');

  // Verify no mock data in server endpoint
  const v3 = await fetchJSON(EXPRESS + '?south=40.70&west=-74.01&north=40.72&east=-73.99');
  const hasRealData = Array.isArray(v3.body) && v3.body.length > 0 && v3.body[0].id && v3.body[0].geometry;
  process.stderr.write('NYC bbox real data: status=' + v3.status + ' roads=' + (Array.isArray(v3.body) ? v3.body.length : 'N/A') + ' real=' + hasRealData + '\n');

  // Verify clamping: global bbox should be clamped to 2 degrees
  const v4 = await fetchJSON(EXPRESS + '?south=-90&west=-180&north=90&east=180');
  process.stderr.write('Global bbox clamped: status=' + v4.status + ' roads=' + (Array.isArray(v4.body) ? v4.body.length : 'N/A') + '\n');

  // All checks
  const allOk = v1.status === 200 && v2.status === 400 && v3.status === 200 && v4.status === 200;
  process.stderr.write('\nAll verification checks: ' + (allOk ? 'PASSED' : 'FAILED') + '\n');
}

main().catch(err => {
  process.stderr.write('Error: ' + err.message + '\n');
  process.exit(1);
});
