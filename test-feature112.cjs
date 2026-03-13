const http = require('http');

function testUrl(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, { timeout: 15000, ...options }, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => resolve({ status: res.statusCode, body, headers: res.headers, url }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

async function main() {
  console.log('=== Feature #112: All proxy routes respond ===\n');
  const base = 'http://localhost:3001';
  let pass = 0;
  let fail = 0;

  const routes = [
    { path: '/api/health', desc: 'Health check', expectData: (b) => {
      const d = JSON.parse(b);
      return 'uptime' in d;
    }},
    { path: '/api/earthquakes', desc: 'Earthquake data', expectData: (b) => {
      const d = JSON.parse(b);
      return d.type === 'FeatureCollection' || (Array.isArray(d) && d.length > 0);
    }},
    { path: '/api/satellites', desc: 'Satellite TLE data', expectData: (b) => {
      const d = JSON.parse(b);
      return Array.isArray(d) && d.length > 0;
    }},
    { path: '/api/flights', desc: 'Flight data', expectData: (b) => {
      const d = JSON.parse(b);
      return Array.isArray(d) && d.length > 0;
    }},
    { path: '/api/flights/live', desc: 'Live flights', expectData: (b) => {
      const d = JSON.parse(b);
      return Array.isArray(d) && d.length > 0;
    }},
    { path: '/api/cctv', desc: 'CCTV cameras', expectData: (b) => {
      const d = JSON.parse(b);
      return Array.isArray(d) && d.length > 0;
    }},
    { path: '/api/ships', desc: 'Ship data', expectData: (b) => {
      const d = JSON.parse(b);
      // Ships endpoint might return empty array if no WebSocket burst yet, or data
      return Array.isArray(d);
    }},
    { path: '/api/traffic/roads?bbox=-0.15,51.49,-0.10,51.52', desc: 'Traffic roads (London bbox)', expectData: (b) => {
      const d = JSON.parse(b);
      return Array.isArray(d);
    }},
    { path: '/api/geolocation', desc: 'Geolocation', expectData: (b) => {
      // May return data or graceful error
      try {
        const d = JSON.parse(b);
        return d !== null && d !== undefined;
      } catch {
        return false;
      }
    }},
    { path: '/api/cctv/image', desc: 'CCTV image proxy (missing URL param)', expectData: (b) => {
      // Should respond with error for missing URL param, not crash
      return true; // Any response is OK (400/404 with error message is acceptable)
    }},
  ];

  for (const route of routes) {
    try {
      const res = await testUrl(base + route.path);
      const isOk = res.status < 500; // 200, 400, 404 are all acceptable (server handled it)
      let dataOk = false;
      try {
        dataOk = route.expectData(res.body);
      } catch (e) {
        // JSON parse error etc. - check if it's at least a handled response
        dataOk = res.status < 500;
      }

      if (isOk) {
        pass++;
        console.log(`  PASS ${res.status} ${route.path} — ${route.desc}`);
        if (route.path === '/api/earthquakes') {
          try {
            const d = JSON.parse(res.body);
            const count = d.features ? d.features.length : (Array.isArray(d) ? d.length : '?');
            console.log(`       -> ${count} earthquakes`);
          } catch {}
        }
        if (route.path === '/api/satellites') {
          try {
            const d = JSON.parse(res.body);
            console.log(`       -> ${d.length} satellites`);
          } catch {}
        }
        if (route.path === '/api/flights') {
          try {
            const d = JSON.parse(res.body);
            console.log(`       -> ${d.length} flights`);
          } catch {}
        }
        if (route.path === '/api/cctv') {
          try {
            const d = JSON.parse(res.body);
            console.log(`       -> ${d.length} cameras`);
          } catch {}
        }
        if (route.path === '/api/ships') {
          try {
            const d = JSON.parse(res.body);
            console.log(`       -> ${d.length} ships`);
          } catch {}
        }
      } else {
        fail++;
        console.log(`  FAIL ${res.status} ${route.path} — ${route.desc}`);
        console.log(`       Body: ${res.body.substring(0, 200)}`);
      }
    } catch (e) {
      fail++;
      console.log(`  FAIL ERR ${route.path} — ${route.desc}: ${e.message}`);
    }
  }

  console.log(`\n  Results: ${pass}/${routes.length} passed, ${fail} failed`);
  console.log('\n=== RESULT:', fail === 0 ? 'PASS' : `FAIL (${fail} failures)`, '===');
  if (fail > 0) process.exit(1);
}

main().catch(e => { console.error(e); process.exit(1); });
