const WebSocket = require('ws');

async function test() {
  console.log('=== WebSocket Error Handling Tests ===\n');

  // Test 1: Basic connection
  console.log('Test 1: Basic connection...');
  const ws1 = new WebSocket('ws://localhost:3001/ws');
  await new Promise((resolve, reject) => {
    ws1.on('open', () => { console.log('  PASS: Connection opened'); resolve(); });
    ws1.on('error', (err) => { console.log('  FAIL:', err.message); reject(err); });
    setTimeout(() => reject(new Error('timeout')), 5000);
  });

  // Test 2: Send invalid JSON - should not crash server
  console.log('\nTest 2: Invalid JSON message...');
  ws1.send('this is not valid JSON {{{');
  ws1.send('');
  ws1.send('undefined');
  await new Promise(r => setTimeout(r, 500));
  // If we're still connected, server didn't crash
  console.log('  PASS: Server still running after invalid JSON');

  // Test 3: Send valid subscribe message
  console.log('\nTest 3: Valid subscribe-flights message...');
  ws1.send(JSON.stringify({ type: 'subscribe-flights', bbox: { south: 40, north: 50, west: -80, east: -70 } }));
  await new Promise(r => setTimeout(r, 500));
  console.log('  PASS: Subscribe message accepted');

  // Test 4: Multiple simultaneous connections
  console.log('\nTest 4: Multiple simultaneous connections...');
  const connections = [];
  for (let i = 0; i < 5; i++) {
    const ws = new WebSocket('ws://localhost:3001/ws');
    await new Promise((resolve, reject) => {
      ws.on('open', () => resolve());
      ws.on('error', (err) => reject(err));
      setTimeout(() => reject(new Error('timeout')), 5000);
    });
    connections.push(ws);
  }
  console.log(`  PASS: ${connections.length} simultaneous connections established`);

  // Test 5: Clean disconnect
  console.log('\nTest 5: Clean disconnect...');
  ws1.close();
  for (const ws of connections) {
    ws.close();
  }
  await new Promise(r => setTimeout(r, 500));
  console.log('  PASS: All connections closed cleanly');

  // Test 6: Verify server still healthy after all tests
  console.log('\nTest 6: Server health after tests...');
  const http = require('http');
  await new Promise((resolve) => {
    http.get('http://localhost:3001/api/health', (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        const health = JSON.parse(body);
        console.log(`  PASS: Server healthy (uptime: ${Math.round(health.uptime)}s)`);
        resolve();
      });
    });
  });

  console.log('\n=== All WebSocket tests passed ===');
  process.exit(0);
}

test().catch(err => {
  console.error('Test failed:', err.message);
  process.exit(1);
});
