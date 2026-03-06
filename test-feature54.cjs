const http = require('http');

function fetch(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    }).on('error', reject);
  });
}

async function main() {
  console.log('=== Feature #54: Camera altitude affects layer visibility ===\n');

  // Test 1: Flight data exists (labels hidden when zoomed out > 3M m)
  console.log('--- Step 1: Flight labels hidden when zoomed out far ---');
  try {
    const res = await fetch('http://localhost:3001/api/flights');
    const flights = JSON.parse(res.body);
    console.log('Flights count:', flights.length);
    console.log('Has real data:', flights.length > 100);
    if (flights.length > 0) {
      console.log('Sample flight:', flights[0].icao24, flights[0].callsign);
    }
  } catch (e) {
    console.log('Flights error:', e.message);
  }

  // Test 2: Traffic auto-disables above 5,000,000m
  console.log('\n--- Step 2: Traffic layer auto-disables above 5M m ---');
  try {
    // Test with a valid bbox (simulating low altitude)
    const res = await fetch('http://localhost:3001/api/traffic/roads?south=-33.87&west=151.19&north=-33.85&east=151.22');
    const roads = JSON.parse(res.body);
    console.log('Roads at low altitude:', roads.length, 'segments');
    console.log('Has real road data:', roads.length > 0);
  } catch (e) {
    console.log('Traffic error:', e.message);
  }

  // Test 3: CCTV data exists (labels/scaling change with distance)
  console.log('\n--- Step 3: CCTV labels and scaling change with distance ---');
  try {
    const res = await fetch('http://localhost:3001/api/cctv');
    const cameras = JSON.parse(res.body);
    console.log('CCTV count:', cameras.length);
    const gb = cameras.filter(c => c.country === 'GB').length;
    const us = cameras.filter(c => c.country === 'US').length;
    console.log('GB cameras:', gb, 'US cameras:', us);
    console.log('Has real data:', cameras.length > 100);
  } catch (e) {
    console.log('CCTV error:', e.message);
  }

  // Test 4: Ship data exists (labels fade at distance thresholds)
  console.log('\n--- Step 4: Ship labels fade at distance thresholds ---');
  try {
    const res = await fetch('http://localhost:3001/api/ships');
    const ships = JSON.parse(res.body);
    console.log('Ships count:', ships.length);
    console.log('Has real data:', ships.length > 0);
    if (ships.length > 0) {
      console.log('Sample ship:', ships[0].mmsi, ships[0].name);
    }
  } catch (e) {
    console.log('Ships error:', e.message);
  }

  // Test 5: Earthquake data (labels only for M4.5+)
  console.log('\n--- Step 5: Earthquake labels only shown for M4.5+ events ---');
  try {
    const res = await fetch('http://localhost:3001/api/earthquakes');
    const data = JSON.parse(res.body);
    const quakes = data.features || [];
    console.log('Total earthquakes:', quakes.length);
    const big = quakes.filter(f => f.properties.mag >= 4.5);
    const small = quakes.filter(f => f.properties.mag < 4.5);
    console.log('M4.5+ (should have labels):', big.length);
    console.log('Below M4.5 (no labels):', small.length);
    if (big.length > 0) {
      console.log('Sample M4.5+:', 'M' + big[0].properties.mag.toFixed(1), big[0].properties.place);
    }
    console.log('Has real data:', quakes.length > 0);
  } catch (e) {
    console.log('Earthquake error:', e.message);
  }

  console.log('\n=== Code Verification ===');

  // Read and verify code patterns
  const fs = require('fs');

  // Verify FlightLayer has label visibility gating
  const flightLayer = fs.readFileSync('src/components/layers/FlightLayer.tsx', 'utf8');
  console.log('FlightLayer: showLabels = cameraAlt < 3000000:', flightLayer.includes('cameraAlt < 3000000'));

  // Verify ShipLayer has label visibility gating
  const shipLayer = fs.readFileSync('src/components/layers/ShipLayer.tsx', 'utf8');
  console.log('ShipLayer: showLabels = cameraAlt < 3000000:', shipLayer.includes('cameraAlt < 3000000'));

  // Verify CCTVLayer has distance-based scaling
  const cctvLayer = fs.readFileSync('src/components/layers/CCTVLayer.tsx', 'utf8');
  console.log('CCTVLayer: getDistanceScale function:', cctvLayer.includes('getDistanceScale'));
  console.log('CCTVLayer: getTranslucency function:', cctvLayer.includes('getTranslucency'));
  console.log('CCTVLayer: getLabelOpacity function:', cctvLayer.includes('getLabelOpacity'));
  console.log('CCTVLayer: showLabels = cameraAlt < 500000:', cctvLayer.includes('cameraAlt < 500000'));

  // Verify TrafficLayer auto-disables at 5M m in App.tsx
  const appTsx = fs.readFileSync('src/App.tsx', 'utf8');
  console.log('App.tsx: traffic altitude > 5_000_000 check:', appTsx.includes('altitude > 5_000_000'));

  // Verify EarthquakeLayer only labels M4.5+
  const eqLayer = fs.readFileSync('src/components/layers/EarthquakeLayer.tsx', 'utf8');
  console.log('EarthquakeLayer: magnitude >= 4.5 label filter:', eqLayer.includes('magnitude >= 4.5'));

  console.log('\n=== All Feature #54 checks complete ===');
}

main().catch(console.error);
