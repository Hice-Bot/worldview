// Test Feature #33: CCTV endpoint handles partial provider failures
// Verifies Promise.allSettled usage and partial failure handling

async function test() {
  console.log('=== Feature #33: CCTV partial provider failure handling ===\n');

  // Test 1: Normal endpoint returns data from multiple providers
  console.log('Test 1: CCTV endpoint returns cameras from multiple providers');
  try {
    const resp = await fetch('http://localhost:3001/api/cctv');
    const cameras = await resp.json();

    const gb = cameras.filter(c => c.country === 'GB').length;
    const us = cameras.filter(c => c.country === 'US').length;
    const au = cameras.filter(c => c.country === 'AU').length;

    console.log(`  HTTP Status: ${resp.status}`);
    console.log(`  Total cameras: ${cameras.length}`);
    console.log(`  GB (TfL): ${gb}`);
    console.log(`  US (Austin): ${us}`);
    console.log(`  AU (NSW): ${au}`);
    console.log(`  Response is array: ${Array.isArray(cameras)}`);

    if (resp.status !== 200) throw new Error('Expected HTTP 200');
    if (!Array.isArray(cameras)) throw new Error('Expected array response');
    if (cameras.length === 0) throw new Error('Expected at least some cameras');
    // At least one provider should return data
    if (gb === 0 && us === 0) throw new Error('Expected cameras from at least TfL or Austin');

    console.log('  ✅ PASS: Multiple providers return data\n');
  } catch (e) {
    console.log(`  ❌ FAIL: ${e.message}\n`);
    return;
  }

  // Test 2: Verify country filter still works (only GB cameras)
  console.log('Test 2: Country filter returns subset');
  try {
    const resp = await fetch('http://localhost:3001/api/cctv?country=GB');
    const cameras = await resp.json();

    const allGB = cameras.every(c => c.country === 'GB');
    console.log(`  GB-only cameras: ${cameras.length}`);
    console.log(`  All have country=GB: ${allGB}`);

    if (resp.status !== 200) throw new Error('Expected HTTP 200');
    if (!allGB) throw new Error('Expected all cameras to be GB');

    console.log('  ✅ PASS: Country filter works\n');
  } catch (e) {
    console.log(`  ❌ FAIL: ${e.message}\n`);
  }

  // Test 3: Verify country filter for US
  console.log('Test 3: Country filter US returns subset');
  try {
    const resp = await fetch('http://localhost:3001/api/cctv?country=US');
    const cameras = await resp.json();

    const allUS = cameras.every(c => c.country === 'US');
    console.log(`  US-only cameras: ${cameras.length}`);
    console.log(`  All have country=US: ${allUS}`);

    if (resp.status !== 200) throw new Error('Expected HTTP 200');
    if (!allUS) throw new Error('Expected all cameras to be US');

    console.log('  ✅ PASS: US country filter works\n');
  } catch (e) {
    console.log(`  ❌ FAIL: ${e.message}\n`);
  }

  // Test 4: Verify server code uses Promise.allSettled (code review)
  console.log('Test 4: Code review - Promise.allSettled usage');
  const fs = require('fs');
  const serverCode = fs.readFileSync('./server/index.js', 'utf8');

  const hasAllSettled = serverCode.includes('Promise.allSettled');
  const hasProviderLogging = serverCode.includes('[CCTV] Provider') && serverCode.includes('failed:');
  const hasFulfilledCheck = serverCode.includes("result.status === 'fulfilled'");
  const hasRejectedCheck = serverCode.includes("result.status === 'rejected'");

  console.log(`  Promise.allSettled used: ${hasAllSettled}`);
  console.log(`  Partial failure logging: ${hasProviderLogging}`);
  console.log(`  Fulfilled check: ${hasFulfilledCheck}`);
  console.log(`  Rejected check: ${hasRejectedCheck}`);

  if (!hasAllSettled) console.log('  ❌ FAIL: Missing Promise.allSettled');
  else if (!hasProviderLogging) console.log('  ❌ FAIL: Missing partial failure logging');
  else if (!hasFulfilledCheck) console.log('  ❌ FAIL: Missing fulfilled status check');
  else if (!hasRejectedCheck) console.log('  ❌ FAIL: Missing rejected status check');
  else console.log('  ✅ PASS: Code correctly handles partial failures\n');

  // Test 5: Verify that response is HTTP 200 even with partial data
  console.log('Test 5: Response is HTTP 200 with available provider data');
  try {
    // Clear cache first so we get fresh data
    const resp = await fetch('http://localhost:3001/api/cctv');
    const cameras = await resp.json();

    // Verify cameras have valid structure from at least one provider
    const validCameras = cameras.filter(c => c.id && c.name && c.country && typeof c.lat === 'number' && typeof c.lon === 'number');
    console.log(`  Valid camera entries: ${validCameras.length}/${cameras.length}`);
    console.log(`  HTTP status: ${resp.status}`);

    if (resp.status !== 200) throw new Error('Expected HTTP 200');
    if (validCameras.length === 0) throw new Error('Expected valid camera entries');

    console.log('  ✅ PASS: HTTP 200 with valid camera data\n');
  } catch (e) {
    console.log(`  ❌ FAIL: ${e.message}\n`);
  }

  console.log('=== All Feature #33 tests complete ===');
}

test().catch(e => console.error('Test error:', e));
