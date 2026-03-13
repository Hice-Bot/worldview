const http = require('http');

function get(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    }).on('error', reject);
  });
}

async function main() {
  console.log('=== Feature #146: Bounding Box Parameter Validation ===\n');
  const base = 'http://localhost:3001/api/traffic/roads';

  // Test 1: south > north returns 400
  console.log('Test 1: south > north returns 400 error');
  const t1 = await get(`${base}?south=50&north=40&west=10&east=20`);
  console.log('  Status:', t1.status, t1.status === 400 ? 'PASS' : 'FAIL');
  console.log('  Body:', t1.body.substring(0, 100));

  // Test 2: south == north returns 400
  console.log('\nTest 2: south == north returns 400 error');
  const t2 = await get(`${base}?south=50&north=50&west=10&east=20`);
  console.log('  Status:', t2.status, t2.status === 400 ? 'PASS' : 'FAIL');

  // Test 3: west > east (date line wrap) - should NOT error, should handle gracefully
  console.log('\nTest 3: west > east (date line wrap) handled gracefully');
  const t3 = await get(`${base}?south=30&north=40&west=170&east=-170`);
  console.log('  Status:', t3.status, t3.status === 200 ? 'PASS' : 'FAIL');

  // Test 4: Latitude out of range returns 400
  console.log('\nTest 4: Latitude out of range (-91) returns 400');
  const t4 = await get(`${base}?south=-91&north=40&west=10&east=20`);
  console.log('  Status:', t4.status, t4.status === 400 ? 'PASS' : 'FAIL');
  console.log('  Body:', t4.body.substring(0, 100));

  // Test 5: Latitude out of range (91) returns 400
  console.log('\nTest 5: Latitude out of range (91) returns 400');
  const t5 = await get(`${base}?south=40&north=91&west=10&east=20`);
  console.log('  Status:', t5.status, t5.status === 400 ? 'PASS' : 'FAIL');

  // Test 6: Longitude out of range returns 400
  console.log('\nTest 6: Longitude out of range (-181) returns 400');
  const t6 = await get(`${base}?south=30&north=40&west=-181&east=20`);
  console.log('  Status:', t6.status, t6.status === 400 ? 'PASS' : 'FAIL');
  console.log('  Body:', t6.body.substring(0, 100));

  // Test 7: Longitude out of range (181) returns 400
  console.log('\nTest 7: Longitude out of range (181) returns 400');
  const t7 = await get(`${base}?south=30&north=40&west=10&east=181`);
  console.log('  Status:', t7.status, t7.status === 400 ? 'PASS' : 'FAIL');

  // Test 8: Non-numeric values return 400
  console.log('\nTest 8: Non-numeric values return 400');
  const t8 = await get(`${base}?south=abc&north=40&west=10&east=20`);
  console.log('  Status:', t8.status, t8.status === 400 ? 'PASS' : 'FAIL');
  console.log('  Body:', t8.body.substring(0, 100));

  // Test 9: Valid params return 200
  console.log('\nTest 9: Valid params return 200');
  const t9 = await get(`${base}?south=-33.87&north=-33.86&west=151.20&east=151.21`);
  console.log('  Status:', t9.status, t9.status === 200 ? 'PASS' : 'FAIL');

  // Test 10: Missing params (no bbox) returns Sydney fallback 200
  console.log('\nTest 10: Missing params return Sydney fallback 200');
  const t10 = await get(`${base}`);
  console.log('  Status:', t10.status, t10.status === 200 ? 'PASS' : 'FAIL');

  console.log('\n=== All validation tests complete ===');
}

main().catch(err => console.error('ERROR:', err.message));
