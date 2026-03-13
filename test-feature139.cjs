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
  const BASE = 'http://localhost:3001/api/traffic/roads';

  // Test 1: Valid bbox returns road data
  const t1 = await fetchJSON(`${BASE}?south=51.49&west=-0.14&north=51.52&east=-0.10`);
  const t1ok = t1.status === 200 && Array.isArray(t1.body) && t1.body.length > 0;
  process.stdout.write(`Test 1 - Valid bbox: ${t1ok ? 'PASS' : 'FAIL'} (${t1.status}, ${Array.isArray(t1.body) ? t1.body.length + ' roads' : typeof t1.body})\n`);

  // Test 2: Missing bbox falls back to default
  const t2 = await fetchJSON(BASE);
  const t2ok = t2.status === 200 && Array.isArray(t2.body) && t2.body.length > 0;
  process.stdout.write(`Test 2 - Missing bbox fallback: ${t2ok ? 'PASS' : 'FAIL'} (${t2.status}, ${Array.isArray(t2.body) ? t2.body.length + ' roads' : typeof t2.body})\n`);

  // Test 2b: Partial bbox (missing east) falls back
  const t2b = await fetchJSON(`${BASE}?south=51.49&west=-0.14&north=51.52`);
  const t2bok = t2b.status === 200 && Array.isArray(t2b.body) && t2b.body.length > 0;
  process.stdout.write(`Test 2b - Partial bbox fallback: ${t2bok ? 'PASS' : 'FAIL'} (${t2b.status}, ${Array.isArray(t2b.body) ? t2b.body.length + ' roads' : typeof t2b.body})\n`);

  // Test 3: Extremely small bbox returns fewer roads
  const t3 = await fetchJSON(`${BASE}?south=51.5000&west=-0.1300&north=51.5010&east=-0.1290`);
  const t3ok = t3.status === 200 && Array.isArray(t3.body) && t3.body.length < (Array.isArray(t1.body) ? t1.body.length : 999);
  process.stdout.write(`Test 3 - Small bbox fewer roads: ${t3ok ? 'PASS' : 'FAIL'} (${t3.status}, ${Array.isArray(t3.body) ? t3.body.length + ' roads' : typeof t3.body})\n`);

  // Test 4: Extremely large bbox returns reasonable data (clamped)
  const t4 = await fetchJSON(`${BASE}?south=-90&west=-180&north=90&east=180`);
  const t4ok = t4.status === 200 && Array.isArray(t4.body);
  process.stdout.write(`Test 4 - Large bbox clamped: ${t4ok ? 'PASS' : 'FAIL'} (${t4.status}, ${Array.isArray(t4.body) ? t4.body.length + ' roads' : typeof t4.body})\n`);

  // Test 5: Invalid coordinates (non-numeric) return 400
  const t5 = await fetchJSON(`${BASE}?south=abc&west=xyz&north=foo&east=bar`);
  const t5ok = t5.status === 400 && t5.body && t5.body.error;
  process.stdout.write(`Test 5 - Invalid coords error: ${t5ok ? 'PASS' : 'FAIL'} (${t5.status}, ${JSON.stringify(t5.body).substring(0, 120)})\n`);

  // Test 5b: Partially invalid coordinates
  const t5b = await fetchJSON(`${BASE}?south=51.49&west=-0.14&north=foo&east=-0.10`);
  const t5bok = t5b.status === 400 && t5b.body && t5b.body.error;
  process.stdout.write(`Test 5b - Partial invalid coords: ${t5bok ? 'PASS' : 'FAIL'} (${t5b.status}, ${JSON.stringify(t5b.body).substring(0, 120)})\n`);

  // Test 6: Inverted bbox (south > north) handled gracefully
  const t6 = await fetchJSON(`${BASE}?south=51.52&west=-0.10&north=51.49&east=-0.14`);
  const t6ok = t6.status === 200 && Array.isArray(t6.body);
  process.stdout.write(`Test 6 - Inverted bbox handled: ${t6ok ? 'PASS' : 'FAIL'} (${t6.status}, ${Array.isArray(t6.body) ? t6.body.length + ' roads' : typeof t6.body})\n`);

  // Test 7: Out-of-range but numeric coords are clamped
  const t7 = await fetchJSON(`${BASE}?south=-200&west=-400&north=200&east=400`);
  const t7ok = t7.status === 200 && Array.isArray(t7.body);
  process.stdout.write(`Test 7 - Out-of-range clamped: ${t7ok ? 'PASS' : 'FAIL'} (${t7.status}, ${Array.isArray(t7.body) ? t7.body.length + ' roads' : typeof t7.body})\n`);

  const allPass = t1ok && t2ok && t2bok && t3ok && t4ok && t5ok && t5bok && t6ok && t7ok;
  process.stdout.write(`\n=== ALL TESTS ${allPass ? 'PASSED' : 'SOME FAILED'} ===\n`);
}

main().catch(err => {
  process.stderr.write('Error: ' + err.message + '\n');
  process.exit(1);
});
