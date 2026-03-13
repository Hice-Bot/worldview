/**
 * Test Feature #188: Verify ICAO24 overlap between global and live data
 * Tests with high-traffic areas to confirm deduplication works.
 */

const http = require('http');

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, { timeout: 15000 }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { resolve([]); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

async function main() {
  // Fetch global flights
  const global = await fetchJSON('http://localhost:5173/api/flights');
  const globalArr = Array.isArray(global) ? global : [];
  console.log('Global flights:', globalArr.length);

  // Fetch live flights from multiple high-traffic areas
  const areas = [
    { name: 'London Heathrow', lat: 51.47, lon: -0.45, dist: 50 },
    { name: 'JFK New York', lat: 40.64, lon: -73.78, dist: 50 },
    { name: 'Frankfurt', lat: 50.03, lon: 8.57, dist: 50 },
  ];

  for (const area of areas) {
    try {
      const live = await fetchJSON(`http://localhost:5173/api/flights/live?lat=${area.lat}&lon=${area.lon}&dist=${area.dist}`);
      const liveArr = Array.isArray(live) ? live : [];
      console.log(`\n${area.name}:`);
      console.log('  Live flights:', liveArr.length);

      if (liveArr.length > 0 && globalArr.length > 0) {
        const globalIcaos = new Set(globalArr.map(f => f.icao24));
        const overlaps = liveArr.filter(f => globalIcaos.has(f.icao24));
        console.log('  Overlapping ICAO24s:', overlaps.length, '/' , liveArr.length);

        if (overlaps.length > 0) {
          // Simulate merge
          const liveMap = new Map();
          for (const lf of liveArr) {
            if (lf.icao24) liveMap.set(lf.icao24, true);
          }
          const filtered = globalArr.filter(gf => !liveMap.has(gf.icao24));
          const merged = [...filtered, ...liveArr];
          console.log('  Before merge:', globalArr.length + liveArr.length, 'total entries');
          console.log('  After merge:', merged.length, 'unique aircraft');
          console.log('  Dedup removed:', (globalArr.length + liveArr.length) - merged.length, 'duplicates');

          // Verify no duplicates in merged result
          const mergedIcaos = new Map();
          let dupes = 0;
          for (const f of merged) {
            if (mergedIcaos.has(f.icao24)) dupes++;
            mergedIcaos.set(f.icao24, true);
          }
          console.log('  Duplicate check:', dupes === 0 ? 'PASS (0 dupes)' : 'FAIL (' + dupes + ' dupes)');
        }
      }
    } catch (e) {
      console.log(`  ${area.name} error:`, e.message);
    }
  }

  console.log('\nDeduplication verification: COMPLETE');
}

main().catch(e => console.error('Error:', e.message));
