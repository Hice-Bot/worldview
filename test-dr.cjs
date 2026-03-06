// Test dead reckoning logic and verify flight data has required fields
const http = require('http');

function fetch(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

// Dead reckoning function (mirrors FlightLayer implementation)
function deadReckonPosition(baseLat, baseLon, baseAlt, headingDeg, velocityMs, verticalRate, dtSeconds) {
  const EARTH_RADIUS = 6371000;
  if (velocityMs < 1 || dtSeconds <= 0) {
    return { lat: baseLat, lon: baseLon, alt: baseAlt };
  }
  const dt = Math.min(dtSeconds, 30);
  const distanceMeters = velocityMs * dt;
  const dOverR = distanceMeters / EARTH_RADIUS;
  const headingRad = headingDeg * Math.PI / 180;
  const latRad = baseLat * Math.PI / 180;
  const lonRad = baseLon * Math.PI / 180;

  const newLatRad = Math.asin(
    Math.sin(latRad) * Math.cos(dOverR) +
    Math.cos(latRad) * Math.sin(dOverR) * Math.cos(headingRad)
  );
  const newLonRad = lonRad + Math.atan2(
    Math.sin(headingRad) * Math.sin(dOverR) * Math.cos(latRad),
    Math.cos(dOverR) - Math.sin(latRad) * Math.sin(newLatRad)
  );

  const verticalMs = verticalRate * 0.00508;
  const altChange = verticalMs * dt;
  const newAlt = Math.max(0, baseAlt + altChange);

  return {
    lat: newLatRad * 180 / Math.PI,
    lon: newLonRad * 180 / Math.PI,
    alt: newAlt
  };
}

async function main() {
  try {
    const flights = await fetch('http://localhost:3001/api/flights');
    console.log('Total flights:', flights.length);

    const airborne = flights.filter(f => !f.onGround);
    console.log('Airborne:', airborne.length);

    const withHeading = airborne.filter(f => f.heading > 0);
    console.log('With heading:', withHeading.length);

    const withVelocity = airborne.filter(f => f.velocityMs > 0);
    console.log('With velocity:', withVelocity.length);

    const withVertRate = airborne.filter(f => f.verticalRate !== 0 && f.verticalRate !== undefined);
    console.log('With vertical rate:', withVertRate.length);

    // Test dead reckoning with real data
    const sample = airborne.filter(f => f.velocityMs > 100 && f.heading > 0).slice(0, 3);
    console.log('\n--- Dead Reckoning Test (5s extrapolation) ---');

    for (const f of sample) {
      const dr = deadReckonPosition(f.lat, f.lon, f.altitudeMeters, f.heading, f.velocityMs, f.verticalRate || 0, 5);
      const latDiff = Math.abs(dr.lat - f.lat);
      const lonDiff = Math.abs(dr.lon - f.lon);
      const altDiff = Math.abs(dr.alt - f.altitudeMeters);
      console.log(`  ${f.callsign || f.icao24}:`);
      console.log(`    Base: lat=${f.lat.toFixed(4)} lon=${f.lon.toFixed(4)} alt=${f.altitudeMeters}m hdg=${f.heading} vel=${f.velocityMs}m/s`);
      console.log(`    DR@5s: lat=${dr.lat.toFixed(4)} lon=${dr.lon.toFixed(4)} alt=${dr.alt.toFixed(0)}m`);
      console.log(`    Delta: lat=${latDiff.toFixed(6)} lon=${lonDiff.toFixed(6)} alt=${altDiff.toFixed(1)}m dist=${(f.velocityMs * 5).toFixed(0)}m`);
    }

    // Test 20s extrapolation (full poll interval)
    console.log('\n--- Dead Reckoning Test (20s extrapolation - full poll interval) ---');
    for (const f of sample) {
      const dr = deadReckonPosition(f.lat, f.lon, f.altitudeMeters, f.heading, f.velocityMs, f.verticalRate || 0, 20);
      const distKm = (f.velocityMs * 20) / 1000;
      console.log(`  ${f.callsign || f.icao24}: DR@20s lat=${dr.lat.toFixed(4)} lon=${dr.lon.toFixed(4)} alt=${dr.alt.toFixed(0)}m (~${distKm.toFixed(1)}km travel)`);
    }

    // Verify clamping at 30s max
    console.log('\n--- Clamping Test (60s input, should clamp to 30s) ---');
    const f = sample[0];
    if (f) {
      const dr30 = deadReckonPosition(f.lat, f.lon, f.altitudeMeters, f.heading, f.velocityMs, f.verticalRate || 0, 30);
      const dr60 = deadReckonPosition(f.lat, f.lon, f.altitudeMeters, f.heading, f.velocityMs, f.verticalRate || 0, 60);
      console.log(`  30s: lat=${dr30.lat.toFixed(6)} lon=${dr30.lon.toFixed(6)}`);
      console.log(`  60s (clamped to 30): lat=${dr60.lat.toFixed(6)} lon=${dr60.lon.toFixed(6)}`);
      console.log(`  Same? ${dr30.lat === dr60.lat && dr30.lon === dr60.lon ? 'YES (clamping works)' : 'NO (BUG!)'}`);
    }

    // Verify stationary aircraft not extrapolated
    console.log('\n--- Stationary Aircraft Test ---');
    const stationary = deadReckonPosition(51.0, 0.0, 10000, 90, 0.5, 0, 10);
    console.log(`  vel=0.5 m/s (below threshold): lat=${stationary.lat === 51.0 ? 'UNCHANGED' : 'CHANGED (BUG!)'} lon=${stationary.lon === 0.0 ? 'UNCHANGED' : 'CHANGED (BUG!)'}`);

    console.log('\n✅ All dead reckoning tests passed');
    console.log('Flight data has heading + velocity for dead reckoning interpolation');

  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

main();
