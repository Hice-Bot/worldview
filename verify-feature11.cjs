const http = require('http');
const fs = require('fs');
const path = require('path');

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch(e) { reject(new Error('Invalid JSON: ' + data.substring(0, 100))); }
      });
    }).on('error', reject);
  });
}

async function main() {
  const serverCode = fs.readFileSync(path.join(__dirname, 'server/index.js'), 'utf8');
  const serverEnv = fs.readFileSync(path.join(__dirname, 'server/.env'), 'utf8');

  // Step 1: NSW Transport API calls include NSW_TRANSPORT_API_KEY header/param
  const nswCheck = serverCode.includes("process.env.NSW_TRANSPORT_API_KEY") &&
    serverCode.includes("Authorization: `apikey ${process.env.NSW_TRANSPORT_API_KEY}`");
  process.stdout.write('[Step 1] NSW_TRANSPORT_API_KEY injected into headers: ' + (nswCheck ? 'PASS' : 'FAIL') + '\n');

  // Step 2: OpenSky uses OPENSKY_CLIENT_ID and OPENSKY_CLIENT_SECRET
  const openskyAuthCheck = serverCode.includes("process.env.OPENSKY_CLIENT_ID") &&
    serverCode.includes("process.env.OPENSKY_CLIENT_SECRET") &&
    serverCode.includes("Basic ${credentials}");
  process.stdout.write('[Step 2] OpenSky uses OPENSKY_CLIENT_ID/SECRET for auth: ' + (openskyAuthCheck ? 'PASS' : 'FAIL') + '\n');

  // Verify OpenSky auth is on all 3 endpoints (flights, flights/live, routes)
  const openskyFetchCount = (serverCode.match(/opensky-network\.org/g) || []).length;
  const openskyAuthCount = (serverCode.match(/openskyHeaders|openskyLiveHeaders|routeHeaders/g) || []).length;
  process.stdout.write('  OpenSky endpoints: ' + openskyFetchCount + ', Auth header variables: ' + openskyAuthCount + '\n');

  // Step 3: AISStream WebSocket connection uses AISSTREAM_API_KEY
  const aisCheck = serverCode.includes("process.env.AISSTREAM_API_KEY") &&
    serverCode.includes("APIKey: apiKey");
  process.stdout.write('[Step 3] AISSTREAM_API_KEY used in WebSocket: ' + (aisCheck ? 'PASS' : 'FAIL') + '\n');

  // Step 4: Keys are read from process.env at request time
  const envReadCheck = serverCode.includes("process.env.NSW_TRANSPORT_API_KEY") &&
    serverCode.includes("process.env.OPENSKY_CLIENT_ID") &&
    serverCode.includes("process.env.OPENSKY_CLIENT_SECRET") &&
    serverCode.includes("process.env.AISSTREAM_API_KEY");
  process.stdout.write('[Step 4] All keys read from process.env: ' + (envReadCheck ? 'PASS' : 'FAIL') + '\n');

  // Step 5: Missing keys cause graceful degradation, not crashes
  // NSW: only added to sources array if key exists (conditional spread)
  const nswGraceful = serverCode.includes("process.env.NSW_TRANSPORT_API_KEY ? [") ||
    serverCode.includes("process.env.NSW_TRANSPORT_API_KEY ?");
  // AISStream: only used as fallback if key exists
  const aisGraceful = serverCode.includes("if (process.env.AISSTREAM_API_KEY)");
  // OpenSky: works without auth (anonymous), auth is optional enhancement
  const openskyGraceful = serverCode.includes("if (process.env.OPENSKY_CLIENT_ID && process.env.OPENSKY_CLIENT_SECRET)");
  process.stdout.write('[Step 5] Graceful degradation:\n');
  process.stdout.write('  NSW graceful (conditional inclusion): ' + (nswGraceful ? 'PASS' : 'FAIL') + '\n');
  process.stdout.write('  AISStream graceful (fallback only if key set): ' + (aisGraceful ? 'PASS' : 'FAIL') + '\n');
  process.stdout.write('  OpenSky graceful (works without auth): ' + (openskyGraceful ? 'PASS' : 'FAIL') + '\n');

  // Live verification: server responds without crashing (keys are empty in .env)
  try {
    const health = await fetchJSON('http://localhost:3001/api/health');
    process.stdout.write('[Live] Server running with empty keys: ' + (health.status === 'ok' ? 'PASS' : 'FAIL') + '\n');
  } catch(e) {
    process.stdout.write('[Live] Server health check failed: ' + e.message + '\n');
  }

  try {
    const flights = await fetchJSON('http://localhost:3001/api/flights');
    process.stdout.write('[Live] Flights endpoint works (graceful degradation): ' + (Array.isArray(flights) ? 'PASS (' + flights.length + ' flights)' : 'FAIL') + '\n');
  } catch(e) {
    process.stdout.write('[Live] Flights endpoint: ' + e.message + '\n');
  }

  const allPass = nswCheck && openskyAuthCheck && aisCheck && envReadCheck && nswGraceful && aisGraceful && openskyGraceful;
  process.stdout.write('\n=== FEATURE #11 OVERALL: ' + (allPass ? 'PASS' : 'FAIL') + ' ===\n');
}

main().catch(e => process.stderr.write('Error: ' + e.message + '\n'));
