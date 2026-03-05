const http = require('http');

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(body) }); }
        catch (e) { reject(new Error('JSON parse error')); }
      });
    }).on('error', reject);
  });
}

async function main() {
  console.log('=== Ship Layer Feature #75 Verification ===\n');

  // 1. Test /api/ships endpoint
  console.log('1. Testing /api/ships endpoint...');
  const { status, data } = await fetchJSON('http://localhost:3001/api/ships');
  console.log('   HTTP Status:', status);
  console.log('   PASS:', status === 200 ? 'YES' : 'NO');

  console.log('\n2. Response is array of ship objects...');
  console.log('   Is array:', Array.isArray(data));
  console.log('   Total ships:', data.length);
  console.log('   PASS:', Array.isArray(data) && data.length > 0 ? 'YES' : 'NO');

  // Check required fields
  console.log('\n3. Required ShipData fields present...');
  const requiredFields = ['mmsi', 'name', 'lat', 'lon', 'sog', 'cog', 'heading', 'shipType'];
  const sample = data[0];
  requiredFields.forEach(f => {
    const present = sample[f] !== undefined;
    console.log('   ' + f + ':', present ? 'present' : 'MISSING');
  });
  const allPresent = requiredFields.every(f => sample[f] !== undefined);
  console.log('   PASS:', allPresent ? 'YES' : 'NO');

  // Check filtering: no (0,0) coordinates
  console.log('\n4. No (0,0) coordinate ships...');
  const zeroCoords = data.filter(s => s.lat === 0 && s.lon === 0);
  console.log('   Ships at (0,0):', zeroCoords.length);
  console.log('   PASS:', zeroCoords.length === 0 ? 'YES' : 'NO');

  // Check filtering: only moving vessels (SOG > 0.5)
  console.log('\n5. Only moving vessels (SOG > 0.5 knots)...');
  const stopped = data.filter(s => s.sog <= 0.5);
  console.log('   Stopped vessels:', stopped.length);
  console.log('   PASS:', stopped.length === 0 ? 'YES' : 'NO');

  // Check ship type distribution
  console.log('\n6. Ship type classification...');
  const typeCategories = { cargo: 0, tanker: 0, passenger: 0, highspeed: 0, fishing: 0, tug: 0, other: 0 };
  data.forEach(s => {
    const t = s.shipType;
    if (t >= 70 && t <= 79) typeCategories.cargo++;
    else if (t >= 80 && t <= 89) typeCategories.tanker++;
    else if (t >= 60 && t <= 69) typeCategories.passenger++;
    else if (t >= 40 && t <= 49) typeCategories.highspeed++;
    else if (t === 30) typeCategories.fishing++;
    else if (t === 31 || t === 32 || t === 52) typeCategories.tug++;
    else typeCategories.other++;
  });
  Object.entries(typeCategories).forEach(([k, v]) => {
    console.log('   ' + k + ':', v);
  });
  console.log('   Has multiple types:', Object.values(typeCategories).filter(v => v > 0).length > 1 ? 'YES' : 'NO');

  // Check real data (coordinates in valid ranges)
  console.log('\n7. Coordinates valid...');
  const validCoords = data.every(s => s.lat >= -90 && s.lat <= 90 && s.lon >= -180 && s.lon <= 180);
  console.log('   All valid:', validCoords);
  console.log('   PASS:', validCoords ? 'YES' : 'NO');

  // Check heading values
  console.log('\n8. Heading/rotation values...');
  const withHeading = data.filter(s => s.heading > 0 && s.heading <= 360);
  console.log('   Ships with valid heading:', withHeading.length, '/', data.length);
  console.log('   PASS:', withHeading.length > data.length * 0.5 ? 'YES' : 'NO');

  // Check named ships
  console.log('\n9. Named vessels...');
  const named = data.filter(s => s.name && s.name.trim().length > 0);
  console.log('   Named:', named.length, '/', data.length, '(' + (100*named.length/data.length).toFixed(1) + '%)');
  console.log('   Sample names:', named.slice(0, 5).map(s => s.name).join(', '));
  console.log('   PASS:', named.length > data.length * 0.5 ? 'YES' : 'NO');

  // Check no mock data
  console.log('\n10. No mock data patterns...');
  const str = JSON.stringify(data).toLowerCase();
  const mockPatterns = ['mockdata', 'fakedata', 'sampledata', 'dummydata', 'testdata', 'placeholder'];
  const foundMock = mockPatterns.filter(p => str.includes(p));
  console.log('   Mock patterns found:', foundMock.length === 0 ? 'none' : foundMock.join(', '));
  console.log('   PASS:', foundMock.length === 0 ? 'YES' : 'NO');

  console.log('\n=== Summary ===');
  console.log('Total vessels:', data.length);
  console.log('Real upstream API: Finnish Digitraffic (meri.digitraffic.fi)');
}

main().catch(err => console.error('Test failed:', err.message));
