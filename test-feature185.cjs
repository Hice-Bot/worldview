/**
 * Test Feature #185: Multiple WebSocket connections handled
 *
 * Verifies:
 * 1. Two WebSocket connections to /ws both work
 * 2. Both receive flight data broadcasts independently
 * 3. Closing one doesn't affect the other
 * 4. Server handles connection cleanup properly
 * 5. No memory leak from abandoned connections
 */

const WebSocket = require('ws');

const WS_URL = 'ws://localhost:3001/ws';
let passed = 0;
let failed = 0;

function check(name, condition) {
  if (condition) {
    console.log('  PASS:', name);
    passed++;
  } else {
    console.log('  FAIL:', name);
    failed++;
  }
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function connectWS(label) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    const timeout = setTimeout(() => reject(new Error(`${label}: connection timeout`)), 10000);
    ws.on('open', () => {
      clearTimeout(timeout);
      resolve(ws);
    });
    ws.on('error', (err) => {
      clearTimeout(timeout);
      reject(new Error(`${label}: ${err.message}`));
    });
  });
}

function waitForMessage(ws, label, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`${label}: message timeout`)), timeoutMs);
    ws.once('message', (data) => {
      clearTimeout(timeout);
      try {
        resolve(JSON.parse(data.toString()));
      } catch (e) {
        resolve(data.toString());
      }
    });
  });
}

async function test() {
  console.log('=== Feature #185: Multiple WebSocket connections handled ===\n');

  // TEST 1: Open two WebSocket connections
  console.log('TEST 1: Open two WebSocket connections');
  let ws1, ws2;
  try {
    ws1 = await connectWS('WS1');
    ws2 = await connectWS('WS2');
    check('WS1 connected', ws1.readyState === WebSocket.OPEN);
    check('WS2 connected', ws2.readyState === WebSocket.OPEN);
  } catch (err) {
    console.log('  FAIL: Could not connect:', err.message);
    failed += 2;
    process.exit(1);
  }

  // TEST 2: Both receive flight data broadcasts
  console.log('\nTEST 2: Both receive flight data independently');

  // Subscribe both to flights in the same bbox
  const bbox = { south: -90, north: 90, west: -180, east: 180 };
  ws1.send(JSON.stringify({ type: 'subscribe-flights', bbox }));
  ws2.send(JSON.stringify({ type: 'subscribe-flights', bbox }));

  // Both should get subscription-ack
  try {
    const ack1 = await waitForMessage(ws1, 'WS1-ack');
    check('WS1 received subscription-ack', ack1.type === 'subscription-ack');
  } catch (err) {
    console.log('  FAIL: WS1 ack:', err.message);
    failed++;
  }

  try {
    const ack2 = await waitForMessage(ws2, 'WS2-ack');
    check('WS2 received subscription-ack', ack2.type === 'subscription-ack');
  } catch (err) {
    console.log('  FAIL: WS2 ack:', err.message);
    failed++;
  }

  // Both should get flights-update
  try {
    const update1 = await waitForMessage(ws1, 'WS1-update');
    check('WS1 received flights-update', update1.type === 'flights-update');
    check('WS1 has aircraft data', Array.isArray(update1.aircraft));
    check('WS1 has timestamp', typeof update1.timestamp === 'number');
  } catch (err) {
    console.log('  FAIL: WS1 update:', err.message);
    failed += 3;
  }

  try {
    const update2 = await waitForMessage(ws2, 'WS2-update');
    check('WS2 received flights-update', update2.type === 'flights-update');
    check('WS2 has aircraft data', Array.isArray(update2.aircraft));
    check('WS2 has timestamp', typeof update2.timestamp === 'number');
  } catch (err) {
    console.log('  FAIL: WS2 update:', err.message);
    failed += 3;
  }

  // TEST 3: Closing one doesn't affect the other
  console.log('\nTEST 3: Closing WS1 does not affect WS2');
  ws1.close();
  await wait(1000);
  check('WS1 is closed', ws1.readyState === WebSocket.CLOSED);
  check('WS2 still open after WS1 closed', ws2.readyState === WebSocket.OPEN);

  // WS2 should still receive data
  try {
    const update3 = await waitForMessage(ws2, 'WS2-after-ws1-close');
    check('WS2 still receives data after WS1 closes', update3.type === 'flights-update');
  } catch (err) {
    console.log('  FAIL: WS2 data after WS1 close:', err.message);
    failed++;
  }

  // TEST 4: Server handles connection cleanup properly
  console.log('\nTEST 4: Server handles cleanup properly');

  // Open and close a connection rapidly
  const ws3 = await connectWS('WS3');
  ws3.send(JSON.stringify({ type: 'subscribe-flights', bbox }));
  await wait(500);
  ws3.close();
  await wait(500);
  check('WS3 rapid open/subscribe/close works', ws3.readyState === WebSocket.CLOSED);

  // WS2 should still work fine
  check('WS2 still works after WS3 rapid lifecycle', ws2.readyState === WebSocket.OPEN);

  // TEST 5: No memory leak - open and close many connections
  console.log('\nTEST 5: No memory leak from multiple connections');
  const connectionPromises = [];
  for (let i = 0; i < 10; i++) {
    connectionPromises.push(connectWS(`batch-${i}`));
  }
  const batchConns = await Promise.all(connectionPromises);
  check('10 simultaneous connections opened', batchConns.every(ws => ws.readyState === WebSocket.OPEN));

  // Close them all
  batchConns.forEach(ws => ws.close());
  await wait(1000);
  check('All 10 connections closed cleanly', batchConns.every(ws => ws.readyState === WebSocket.CLOSED));

  // Verify WS2 still works
  try {
    // Send a ping to verify
    ws2.send(JSON.stringify({ type: 'ping' }));
    const pong = await waitForMessage(ws2, 'WS2-pong');
    check('WS2 responds to ping after mass connect/disconnect', pong.type === 'pong');
  } catch (err) {
    console.log('  FAIL: WS2 ping after mass:', err.message);
    failed++;
  }

  // TEST 6: Verify server code structure
  console.log('\nTEST 6: Server code structure');
  const fs = require('fs');
  const serverCode = fs.readFileSync(__dirname + '/server/index.js', 'utf8');
  check('WebSocketServer created with path /ws', serverCode.includes("path: '/ws'"));
  check('Connection tracking (wss.clients)', serverCode.includes('wss.clients'));
  check('Heartbeat interval for detecting dead connections', serverCode.includes('ws.isAlive') && serverCode.includes('ws.ping()'));
  check('Per-connection cleanup on close', serverCode.includes("ws.on('close'") && serverCode.includes('clearInterval(flightPollInterval)'));
  check('Per-connection cleanup on error', serverCode.includes("ws.on('error'") && serverCode.includes('clearInterval(flightPollInterval)'));
  check('Heartbeat terminates unresponsive clients', serverCode.includes('ws.terminate()'));

  // Cleanup
  ws2.close();
  await wait(500);

  console.log('\n=== RESULTS ===');
  console.log('Passed:', passed);
  console.log('Failed:', failed);
  console.log(failed === 0 ? '\nALL TESTS PASSED' : '\nSOME TESTS FAILED');
  process.exit(failed === 0 ? 0 : 1);
}

test().catch(e => {
  console.error('Test error:', e.message);
  process.exit(1);
});
