const fs = require('fs');
const http = require('http');

function fetchShips() {
  return new Promise((resolve, reject) => {
    http.get('http://localhost:3001/api/ships', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function fetchHealth() {
  return new Promise((resolve, reject) => {
    http.get('http://localhost:3001/api/health', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

async function main() {
  console.log('=== Feature #205: Ship cache returns same data within TTL ===\n');

  // Get initial health stats
  const healthBefore = await fetchHealth();
  console.log('Cache stats before:', JSON.stringify(healthBefore.cache.stats));

  // Call A
  console.log('\n--- Call A: First /api/ships ---');
  const callA = await fetchShips();
  console.log('Call A size:', callA.length, 'bytes');
  const shipsA = JSON.parse(callA);
  console.log('Vessels:', shipsA.length);
  if (shipsA.length > 0) {
    console.log('First vessel MMSI:', shipsA[0].mmsi);
    console.log('First vessel name:', shipsA[0].name);
    console.log('First vessel lat:', shipsA[0].lat);
  }

  // Wait 3 seconds (well within 120s TTL)
  console.log('\n--- Waiting 3 seconds ---');
  await new Promise(r => setTimeout(r, 3000));

  // Call B
  console.log('\n--- Call B: Second /api/ships (within TTL) ---');
  const callB = await fetchShips();
  console.log('Call B size:', callB.length, 'bytes');

  // Compare
  const identical = callA === callB;
  console.log('\nResponses identical:', identical);

  // Check health stats changed (hits should increase)
  const healthAfter = await fetchHealth();
  console.log('\nCache stats after:', JSON.stringify(healthAfter.cache.stats));
  console.log('Hits increased:', healthAfter.cache.stats.hits > healthBefore.cache.stats.hits);

  // Verify real data
  if (shipsA.length > 0) {
    const hasMMSI = shipsA.every(s => s.mmsi && s.mmsi.length > 0);
    const hasCoords = shipsA.every(s => typeof s.lat === 'number' && typeof s.lon === 'number');
    const hasSOG = shipsA.some(s => s.sog > 0);
    console.log('\nReal data checks:');
    console.log('  All have MMSI:', hasMMSI);
    console.log('  All have coordinates:', hasCoords);
    console.log('  Some have SOG > 0:', hasSOG);
  }

  // Summary
  console.log('\n=== RESULT ===');
  if (identical && shipsA.length > 0) {
    console.log('PASS: Ship cache returns identical data within TTL');
  } else if (shipsA.length === 0) {
    console.log('WARN: No ships returned (upstream may be down)');
  } else {
    console.log('FAIL: Responses differ within TTL');
  }
}

main().catch(err => console.error('Error:', err.message));
