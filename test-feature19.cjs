const http = require('http');

function testShipsEndpoint() {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: 3001,
      path: '/api/ships',
      method: 'GET'
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const ships = JSON.parse(data);
          console.log('=== Feature #19: Ship proxy returns real AIS vessel data ===');
          console.log('');

          // Step 1: HTTP 200
          console.log('1. HTTP Status:', res.statusCode, res.statusCode === 200 ? 'PASS' : 'FAIL');

          // Step 2: Array of vessel objects
          const isArray = Array.isArray(ships);
          console.log('2. Response is array:', isArray ? 'PASS' : 'FAIL', '(' + ships.length + ' vessels)');

          // Step 3: MMSI (9-digit Maritime Mobile Service Identity)
          const validMMSI = ships.filter(s => /^[0-9]{9}$/.test(String(s.mmsi)));
          console.log('3. Valid 9-digit MMSI:', validMMSI.length + '/' + ships.length,
            validMMSI.length === ships.length ? 'PASS' : (validMMSI.length > ships.length * 0.9 ? 'MOSTLY PASS' : 'FAIL'));

          // Step 4: lat/lon at sea or port locations (not 0,0)
          const validCoords = ships.filter(s =>
            typeof s.lat === 'number' && typeof s.lon === 'number' &&
            s.lat >= -90 && s.lat <= 90 && s.lon >= -180 && s.lon <= 180 &&
            !(s.lat === 0 && s.lon === 0)
          );
          console.log('4. Valid coordinates (sea/port):', validCoords.length + '/' + ships.length,
            validCoords.length === ships.length ? 'PASS' : 'FAIL');

          // Step 5: Real ship names
          const withNames = ships.filter(s => s.name && s.name.length > 1);
          console.log('5. Vessels with real names:', withNames.length + '/' + ships.length,
            withNames.length > ships.length * 0.8 ? 'PASS' : 'FAIL');
          console.log('   Sample names:', ships.slice(0, 8).map(s => s.name).join(', '));

          // Step 6: Ship type codes (AIS standard 30-89)
          const aisTypes = ships.filter(s => typeof s.shipType === 'number' && s.shipType >= 30 && s.shipType <= 89);
          const allTypes = ships.filter(s => typeof s.shipType === 'number');
          console.log('6. AIS type codes (30-89):', aisTypes.length + '/' + ships.length,
            aisTypes.length > ships.length * 0.7 ? 'PASS' : 'FAIL');
          const uniqueTypes = [...new Set(ships.map(s => s.shipType))].sort((a, b) => a - b);
          console.log('   Unique types:', uniqueTypes.join(', '));

          // Step 7: SOG realistic (0-30 knots)
          const validSOG = ships.filter(s => typeof s.sog === 'number' && s.sog >= 0 && s.sog <= 30);
          const allSOG = ships.filter(s => typeof s.sog === 'number');
          const maxSOG = Math.max(...allSOG.map(s => s.sog));
          const minSOG = Math.min(...allSOG.map(s => s.sog));
          console.log('7. Realistic SOG (0-30 kts):', validSOG.length + '/' + ships.length,
            validSOG.length > ships.length * 0.95 ? 'PASS' : 'FAIL');
          console.log('   SOG range:', minSOG.toFixed(1) + ' to ' + maxSOG.toFixed(1) + ' knots');

          // Step 8: COG 0-360 degrees
          const validCOG = ships.filter(s => typeof s.cog === 'number' && s.cog >= 0 && s.cog <= 360);
          console.log('8. Valid COG (0-360°):', validCOG.length + '/' + ships.length,
            validCOG.length === ships.length ? 'PASS' : 'FAIL');

          // Step 9: At least 5 vessels
          console.log('9. At least 5 vessels:', ships.length >= 5 ? 'PASS' : 'FAIL',
            '(' + ships.length + ' vessels)');

          console.log('');
          console.log('=== Sample vessels ===');
          ships.slice(0, 5).forEach(s => {
            console.log('  MMSI:' + s.mmsi + ' Name:' + s.name + ' Type:' + s.shipType +
              ' Lat:' + s.lat + ' Lon:' + s.lon + ' SOG:' + s.sog + ' COG:' + s.cog);
          });

          console.log('');
          const allPass = res.statusCode === 200 && isArray && ships.length >= 5 &&
            validMMSI.length > ships.length * 0.9 && validCoords.length === ships.length &&
            withNames.length > ships.length * 0.8 && validSOG.length > ships.length * 0.9 &&
            validCOG.length > ships.length * 0.9;
          console.log('=== OVERALL:', allPass ? 'ALL CHECKS PASS' : 'SOME CHECKS FAILED', '===');

          resolve(allPass);
        } catch (e) {
          console.error('Parse error:', e.message);
          reject(e);
        }
      });
    });
    req.on('error', e => {
      console.error('Connection error:', e.message);
      reject(e);
    });
    req.end();
  });
}

testShipsEndpoint().then(pass => {
  process.exit(pass ? 0 : 1);
}).catch(e => {
  console.error('Test failed:', e);
  process.exit(1);
});
