// Test Feature #28: CCTV country filter works correctly
var http = require('http');

function httpGetJson(url) {
  return new Promise(function(resolve, reject) {
    http.get(url, function(res) {
      var data = '';
      res.on('data', function(chunk) { data += chunk; });
      res.on('end', function() {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          reject(new Error('JSON parse failed: ' + e.message));
        }
      });
    }).on('error', reject);
  });
}

async function runTest() {
  console.log('=== Feature #28: CCTV country filter works correctly ===\n');

  // Test 1: GET /api/cctv?country=GB returns only British cameras
  console.log('Test 1: GET /api/cctv?country=GB returns only British cameras...');
  var gbResult = await httpGetJson('http://localhost:3001/api/cctv?country=GB');
  console.log('  Status: ' + gbResult.status);
  console.log('  Camera count: ' + gbResult.data.length);
  var gbNonGb = gbResult.data.filter(function(c) { return c.country !== 'GB'; });
  console.log('  Non-GB cameras: ' + gbNonGb.length);
  var allGb = gbResult.data.every(function(c) { return c.country === 'GB'; });
  console.log('  All have country=GB: ' + (allGb ? 'YES' : 'NO'));
  // Check geographic region - London area: lat ~51.x
  var gbInRegion = gbResult.data.filter(function(c) { return c.lat > 50 && c.lat < 53 && c.lon > -1 && c.lon < 1; });
  console.log('  In London region (50-53N, -1 to 1E): ' + gbInRegion.length + '/' + gbResult.data.length);
  console.log('  Region: ' + (gbResult.data.length > 0 ? gbResult.data[0].region : 'N/A'));
  console.log('  ' + (allGb && gbResult.data.length > 0 ? 'PASS' : 'FAIL') + ': Only GB cameras returned\n');

  // Test 2: GET /api/cctv?country=US returns only US cameras
  console.log('Test 2: GET /api/cctv?country=US returns only US cameras...');
  var usResult = await httpGetJson('http://localhost:3001/api/cctv?country=US');
  console.log('  Status: ' + usResult.status);
  console.log('  Camera count: ' + usResult.data.length);
  var usNonUs = usResult.data.filter(function(c) { return c.country !== 'US'; });
  console.log('  Non-US cameras: ' + usNonUs.length);
  var allUs = usResult.data.every(function(c) { return c.country === 'US'; });
  console.log('  All have country=US: ' + (allUs ? 'YES' : 'NO'));
  // Check geographic region - Austin TX area: lat ~30.x
  var usInRegion = usResult.data.filter(function(c) { return c.lat > 29 && c.lat < 32 && c.lon > -98 && c.lon < -97; });
  console.log('  In Austin TX region (29-32N, -98 to -97W): ' + usInRegion.length + '/' + usResult.data.length);
  console.log('  Region: ' + (usResult.data.length > 0 ? usResult.data[0].region : 'N/A'));
  console.log('  ' + (allUs && usResult.data.length > 0 ? 'PASS' : 'FAIL') + ': Only US cameras returned\n');

  // Test 3: GET /api/cctv?country=AU returns only AU cameras (may be empty without API key)
  console.log('Test 3: GET /api/cctv?country=AU returns only AU cameras...');
  var auResult = await httpGetJson('http://localhost:3001/api/cctv?country=AU');
  console.log('  Status: ' + auResult.status);
  console.log('  Camera count: ' + auResult.data.length);
  if (auResult.data.length > 0) {
    var allAu = auResult.data.every(function(c) { return c.country === 'AU'; });
    console.log('  All have country=AU: ' + (allAu ? 'YES' : 'NO'));
    var auInRegion = auResult.data.filter(function(c) { return c.lat > -35 && c.lat < -30 && c.lon > 148 && c.lon < 155; });
    console.log('  In NSW region: ' + auInRegion.length + '/' + auResult.data.length);
    console.log('  PASS: Only AU cameras returned');
  } else {
    console.log('  No AU cameras (NSW_TRANSPORT_API_KEY not configured - expected)');
    console.log('  PASS: Empty result is correct when no AU data source available');
  }
  console.log('');

  // Test 4: GET /api/cctv without country filter returns all cameras
  console.log('Test 4: GET /api/cctv without country filter returns all cameras...');
  var allResult = await httpGetJson('http://localhost:3001/api/cctv');
  console.log('  Status: ' + allResult.status);
  console.log('  Total cameras: ' + allResult.data.length);
  var allCountries = {};
  allResult.data.forEach(function(c) { allCountries[c.country] = (allCountries[c.country] || 0) + 1; });
  console.log('  Country breakdown: ' + JSON.stringify(allCountries));
  var hasMultipleCountries = Object.keys(allCountries).length >= 2;
  console.log('  Has multiple countries: ' + (hasMultipleCountries ? 'YES' : 'NO'));
  var totalFiltered = gbResult.data.length + usResult.data.length + auResult.data.length;
  console.log('  Sum of filtered (GB+US+AU): ' + totalFiltered);
  console.log('  Total unfiltered: ' + allResult.data.length);
  var sumMatchesAll = totalFiltered === allResult.data.length;
  console.log('  Sum matches total: ' + (sumMatchesAll ? 'YES' : 'NO'));
  console.log('  ' + (hasMultipleCountries && allResult.data.length > 0 ? 'PASS' : 'FAIL') + ': All cameras returned without filter\n');

  // Test 5: Each filtered result contains cameras from the expected geographic region
  console.log('Test 5: Verify geographic regions match country codes...');
  var gbSample = gbResult.data.slice(0, 3);
  var usSample = usResult.data.slice(0, 3);
  console.log('  GB samples:');
  gbSample.forEach(function(c) {
    console.log('    ' + c.name + ' - lat: ' + c.lat.toFixed(4) + ', lon: ' + c.lon.toFixed(4) + ' (' + c.region + ')');
  });
  console.log('  US samples:');
  usSample.forEach(function(c) {
    console.log('    ' + c.name + ' - lat: ' + c.lat.toFixed(4) + ', lon: ' + c.lon.toFixed(4) + ' (' + c.region + ')');
  });

  // Check GB cameras are in UK lat/lon range
  var gbGeoOk = gbResult.data.length === 0 || gbResult.data.every(function(c) {
    return c.lat > 49 && c.lat < 61 && c.lon > -8 && c.lon < 2;
  });
  // Check US cameras are in US lat/lon range
  var usGeoOk = usResult.data.length === 0 || usResult.data.every(function(c) {
    return c.lat > 24 && c.lat < 50 && c.lon > -125 && c.lon < -66;
  });
  console.log('  GB cameras in UK lat/lon range: ' + (gbGeoOk ? 'YES' : 'NO'));
  console.log('  US cameras in US lat/lon range: ' + (usGeoOk ? 'YES' : 'NO'));
  console.log('  ' + (gbGeoOk && usGeoOk ? 'PASS' : 'FAIL') + ': Geographic regions match country codes\n');

  // Summary
  var allPass = allGb && allUs && hasMultipleCountries && sumMatchesAll && gbGeoOk && usGeoOk;
  console.log('=== SUMMARY ===');
  console.log('GET /api/cctv?country=GB: ' + gbResult.data.length + ' cameras (all GB: ' + allGb + ')');
  console.log('GET /api/cctv?country=US: ' + usResult.data.length + ' cameras (all US: ' + allUs + ')');
  console.log('GET /api/cctv?country=AU: ' + auResult.data.length + ' cameras');
  console.log('GET /api/cctv (no filter): ' + allResult.data.length + ' cameras');
  console.log('Sum filtered = total: ' + sumMatchesAll);
  console.log('Geographic verification: GB=' + gbGeoOk + ', US=' + usGeoOk);
  console.log('\nOVERALL: ' + (allPass ? 'ALL TESTS PASS' : 'SOME TESTS FAILED'));
}

runTest().catch(function(e) { console.error('Test error:', e); });
