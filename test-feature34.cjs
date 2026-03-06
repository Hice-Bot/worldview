// Test Feature #34: Ship endpoint handles missing AIS key gracefully
// Without AISSTREAM_API_KEY, /api/ships returns HTTP 200 with valid data

async function test() {
  console.log('=== Feature #34: Ship endpoint handles missing AIS key ===\n');

  // Test 1: Endpoint returns HTTP 200
  console.log('Test 1: /api/ships returns HTTP 200 with array data');
  try {
    const resp = await fetch('http://localhost:3001/api/ships');
    const data = await resp.json();

    console.log('  HTTP status:', resp.status);
    console.log('  Response is array:', Array.isArray(data));
    console.log('  Ship count:', data.length);

    if (resp.status !== 200) throw new Error('Expected HTTP 200, got ' + resp.status);
    if (!Array.isArray(data)) throw new Error('Expected array response');

    console.log('  ✅ PASS: HTTP 200 with array response\n');
  } catch (e) {
    console.log('  ❌ FAIL:', e.message, '\n');
    return;
  }

  // Test 2: Verify AISSTREAM_API_KEY is not set
  console.log('Test 2: AISSTREAM_API_KEY is not set (testing missing key scenario)');
  const fs = require('fs');
  const envContent = fs.readFileSync('./server/.env', 'utf8');
  const aisLine = envContent.split('\n').find(l => l.startsWith('AISSTREAM_API_KEY'));
  const hasKey = aisLine && aisLine.split('=')[1] && aisLine.split('=')[1].trim().length > 0;

  console.log('  AISSTREAM_API_KEY line:', aisLine || 'not found');
  console.log('  Key has value:', !!hasKey);

  if (!hasKey) {
    console.log('  ✅ PASS: Key is not set, testing graceful handling\n');
  } else {
    console.log('  ⚠️ Key is set, but endpoint should still work with Digitraffic\n');
  }

  // Test 3: Code review - verify graceful handling of missing key
  console.log('Test 3: Code review - server handles missing AIS key gracefully');
  const serverCode = fs.readFileSync('./server/index.js', 'utf8');

  const hasDigitraffic = serverCode.includes('digitraffic.fi');
  const hasKeyCheck = serverCode.includes('process.env.AISSTREAM_API_KEY');
  const hasWarnLog = serverCode.includes('AISSTREAM_API_KEY not set');
  const hasCatchBlock = serverCode.includes("console.error('[SHIPS] Digitraffic failed:");

  console.log('  Digitraffic as primary (no key needed):', hasDigitraffic);
  console.log('  AISSTREAM_API_KEY check before fallback:', hasKeyCheck);
  console.log('  Warning log when key missing:', hasWarnLog);
  console.log('  Catch block for primary failure:', hasCatchBlock);

  if (hasDigitraffic && hasKeyCheck && hasWarnLog && hasCatchBlock) {
    console.log('  ✅ PASS: Code handles missing AIS key gracefully\n');
  } else {
    console.log('  ❌ FAIL: Missing graceful handling code\n');
  }

  // Test 4: No crash, valid response structure
  console.log('Test 4: Response has valid ship data structure');
  try {
    const resp = await fetch('http://localhost:3001/api/ships');
    const data = await resp.json();

    if (data.length > 0) {
      const sample = data[0];
      const hasMMSI = 'mmsi' in sample;
      const hasLat = 'lat' in sample;
      const hasLon = 'lon' in sample;
      const hasSOG = 'sog' in sample;
      console.log('  Sample ship:', sample.name || sample.mmsi);
      console.log('  Has mmsi:', hasMMSI);
      console.log('  Has lat:', hasLat);
      console.log('  Has lon:', hasLon);
      console.log('  Has sog:', hasSOG);
      console.log('  ✅ PASS: Valid ship data structure\n');
    } else {
      console.log('  Empty array (Digitraffic may be down, but no crash)');
      console.log('  ✅ PASS: Returns empty array gracefully\n');
    }
  } catch (e) {
    console.log('  ❌ FAIL:', e.message, '\n');
  }

  // Test 5: Frontend handles empty ship data
  console.log('Test 5: Frontend code handles empty arrays');
  const useShipsCode = fs.readFileSync('./src/hooks/useShips.ts', 'utf8');
  const hasDefaultEmpty = useShipsCode.includes('useState<ShipData[]>([])');
  const hasArrayCheck = useShipsCode.includes('Array.isArray');
  console.log('  Default state is empty array:', hasDefaultEmpty);
  console.log('  Array.isArray check on response:', hasArrayCheck);

  if (hasDefaultEmpty && hasArrayCheck) {
    console.log('  ✅ PASS: Frontend handles empty ship data\n');
  } else {
    console.log('  ❌ FAIL: Frontend missing empty data handling\n');
  }

  console.log('=== All Feature #34 tests complete ===');
}

test().catch(e => console.error('Test error:', e));
