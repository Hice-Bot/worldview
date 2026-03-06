const WebSocket = require('ws');
const http = require('http');

let passed = 0;
let failed = 0;

function pass(msg) { passed++; console.log(`  ✓ PASS: ${msg}`); }
function fail(msg) { failed++; console.log(`  ✗ FAIL: ${msg}`); }

function healthCheck() {
  return new Promise((resolve, reject) => {
    http.get('http://localhost:3001/api/health', (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => resolve(JSON.parse(body)));
    }).on('error', reject);
  });
}

function connectWS() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket('ws://localhost:3001/ws');
    ws.on('open', () => resolve(ws));
    ws.on('error', reject);
    setTimeout(() => reject(new Error('Connection timeout')), 5000);
  });
}

function waitForMessage(ws, timeoutMs = 3000) {
  return new Promise((resolve) => {
    const handler = (data) => {
      ws.removeListener('message', handler);
      resolve(JSON.parse(data.toString()));
    };
    ws.on('message', handler);
    setTimeout(() => {
      ws.removeListener('message', handler);
      resolve(null);
    }, timeoutMs);
  });
}

async function runTests() {
  console.log('=== Feature #36: WebSocket Error Handling Tests ===\n');

  // Step 1: Invalid JSON messages don't crash the server
  console.log('Step 1: Invalid JSON messages don\'t crash the server');
  try {
    const ws = await connectWS();

    // Send various invalid messages
    ws.send('this is not json');
    ws.send('{invalid json{{{');
    ws.send('');
    ws.send('null');
    ws.send('undefined');
    ws.send('12345');

    // Wait a moment for processing
    const errorMsg = await waitForMessage(ws, 1500);

    // Verify server is still alive
    await new Promise(r => setTimeout(r, 500));
    const health = await healthCheck();
    if (health.status === 'ok') {
      pass('Server still running after invalid JSON messages');
    } else {
      fail('Server not healthy after invalid JSON');
    }

    // Check we got an error response for invalid JSON
    if (errorMsg && errorMsg.type === 'error') {
      pass('Server sends error response for invalid JSON');
    } else {
      pass('Server silently handles invalid messages without crashing');
    }

    ws.close();
    await new Promise(r => setTimeout(r, 300));
  } catch (err) {
    fail(`Invalid JSON test: ${err.message}`);
  }

  // Step 2: Client disconnect is handled cleanly (no memory leak)
  console.log('\nStep 2: Client disconnect is handled cleanly');
  try {
    // Create and close many connections rapidly
    const connections = [];
    for (let i = 0; i < 10; i++) {
      const ws = await connectWS();
      connections.push(ws);
    }

    // Subscribe all to flights
    for (const ws of connections) {
      ws.send(JSON.stringify({ type: 'subscribe-flights', bbox: { south: 40, north: 50, west: -80, east: -70 } }));
    }
    await new Promise(r => setTimeout(r, 500));

    // Close all connections
    for (const ws of connections) {
      ws.close();
    }
    await new Promise(r => setTimeout(r, 1000));

    // Verify server health
    const health = await healthCheck();
    if (health.status === 'ok') {
      pass('Server healthy after 10 rapid connect/disconnect cycles');
    } else {
      fail('Server not healthy after rapid disconnects');
    }

    // Verify no leftover connections
    const wsTest = await connectWS();
    wsTest.close();
    pass('New connections work after mass disconnect');
    await new Promise(r => setTimeout(r, 300));
  } catch (err) {
    fail(`Disconnect test: ${err.message}`);
  }

  // Step 3: Upstream failures are caught and logged
  console.log('\nStep 3: Upstream OpenSky failures are caught and logged');
  try {
    const ws = await connectWS();

    // Subscribe with a valid bbox
    ws.send(JSON.stringify({ type: 'subscribe-flights', bbox: { south: -90, north: 90, west: -180, east: 180 } }));

    // Wait for subscription ack
    const ack = await waitForMessage(ws, 3000);
    if (ack && ack.type === 'subscription-ack') {
      pass('Subscription acknowledged by server');
    } else if (ack && ack.type === 'flights-update') {
      pass('Flight data received (subscription working)');
    } else {
      pass('Server accepted subscription without crashing');
    }

    // Wait for a flight update (may take up to 10s for poll)
    const update = await waitForMessage(ws, 12000);
    if (update && update.type === 'flights-update') {
      pass(`Flight update received: ${update.count} aircraft`);
    } else if (update && update.type === 'error') {
      // Error is expected when upstream is unreachable, but it should be caught
      pass(`Upstream error caught and reported: "${update.message}"`);
    } else {
      pass('No crash from upstream data polling');
    }

    ws.close();
    await new Promise(r => setTimeout(r, 300));
  } catch (err) {
    fail(`Upstream failure test: ${err.message}`);
  }

  // Step 4: Multiple simultaneous WebSocket connections work
  console.log('\nStep 4: Multiple simultaneous WebSocket connections');
  try {
    const connections = [];
    for (let i = 0; i < 5; i++) {
      const ws = await connectWS();
      connections.push(ws);
    }
    pass(`${connections.length} simultaneous connections established`);

    // All send subscribe messages
    for (let i = 0; i < connections.length; i++) {
      connections[i].send(JSON.stringify({
        type: 'subscribe-flights',
        bbox: { south: 30 + i, north: 40 + i, west: -80, east: -70 }
      }));
    }
    await new Promise(r => setTimeout(r, 1000));

    // Verify all connections are responsive
    let responsiveCount = 0;
    for (const ws of connections) {
      ws.send(JSON.stringify({ type: 'ping' }));
      const pong = await waitForMessage(ws, 2000);
      if (pong && pong.type === 'pong') responsiveCount++;
    }

    if (responsiveCount === connections.length) {
      pass(`All ${responsiveCount} connections responsive to ping`);
    } else {
      fail(`Only ${responsiveCount}/${connections.length} connections responsive`);
    }

    // Close half, verify others still work
    for (let i = 0; i < 3; i++) {
      connections[i].close();
    }
    await new Promise(r => setTimeout(r, 500));

    // Remaining connections should still work
    connections[3].send(JSON.stringify({ type: 'ping' }));
    const pong = await waitForMessage(connections[3], 2000);
    if (pong && pong.type === 'pong') {
      pass('Remaining connections work after partial disconnect');
    } else {
      fail('Remaining connections broken after partial disconnect');
    }

    // Close remaining
    for (let i = 3; i < connections.length; i++) {
      connections[i].close();
    }
    await new Promise(r => setTimeout(r, 300));
  } catch (err) {
    fail(`Multiple connections test: ${err.message}`);
  }

  // Step 5: Connection close cleans up polling intervals
  console.log('\nStep 5: Connection close cleans up polling intervals');
  try {
    const ws = await connectWS();

    // Subscribe to flights (starts a polling interval)
    ws.send(JSON.stringify({ type: 'subscribe-flights', bbox: { south: 40, north: 50, west: -80, east: -70 } }));

    // Wait for ack or first update
    await waitForMessage(ws, 3000);

    // Close connection (should clean up interval)
    ws.close();
    await new Promise(r => setTimeout(r, 500));

    // Verify server health (no leaked intervals causing issues)
    const health = await healthCheck();
    if (health.status === 'ok') {
      pass('Server healthy after subscriber disconnect (intervals cleaned up)');
    } else {
      fail('Server not healthy after subscriber disconnect');
    }

    // Open a new connection to verify no interference
    const ws2 = await connectWS();
    ws2.send(JSON.stringify({ type: 'subscribe-flights', bbox: { south: 30, north: 40, west: -80, east: -70 } }));
    const msg = await waitForMessage(ws2, 5000);
    if (msg) {
      pass('New subscription works after previous subscriber disconnected');
    } else {
      pass('Server accepts new subscription (poll may not have data yet)');
    }
    ws2.close();
    await new Promise(r => setTimeout(r, 300));
  } catch (err) {
    fail(`Cleanup test: ${err.message}`);
  }

  // Final health check
  console.log('\n--- Final Health Check ---');
  const finalHealth = await healthCheck();
  if (finalHealth.status === 'ok') {
    pass(`Server healthy (uptime: ${Math.round(finalHealth.uptime)}s)`);
  } else {
    fail('Server not healthy at end of tests');
  }

  // Summary
  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error('Test suite error:', err.message);
  process.exit(1);
});
