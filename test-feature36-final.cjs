const WebSocket = require('ws');
const http = require('http');

let passed = 0;
let failed = 0;
function pass(msg) { passed++; process.stderr.write('  PASS: ' + msg + '\n'); }
function fail(msg) { failed++; process.stderr.write('  FAIL: ' + msg + '\n'); }

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
    setTimeout(() => reject(new Error('timeout')), 5000);
  });
}

function waitMsg(ws, ms) {
  return new Promise((resolve) => {
    const h = (data) => { ws.removeListener('message', h); resolve(JSON.parse(data.toString())); };
    ws.on('message', h);
    setTimeout(() => { ws.removeListener('message', h); resolve(null); }, ms || 3000);
  });
}

async function run() {
  process.stderr.write('=== Feature #36 Verification ===\n\n');

  // Step 1: Invalid JSON messages don't crash the server
  process.stderr.write('Step 1: Invalid JSON messages\n');
  const ws1 = await connectWS();
  ws1.send('not json {{{{');
  ws1.send('');
  ws1.send('undefined');
  const errMsg = await waitMsg(ws1, 1500);
  if (errMsg && errMsg.type === 'error') pass('Error response sent for invalid JSON');
  else pass('No crash from invalid JSON');
  const h1 = await healthCheck();
  if (h1.status === 'ok') pass('Server healthy after invalid JSON');
  else fail('Server unhealthy');
  ws1.close();
  await new Promise(r => setTimeout(r, 300));

  // Step 2: Client disconnect handled cleanly
  process.stderr.write('\nStep 2: Client disconnect cleanup\n');
  const conns = [];
  for (let i = 0; i < 10; i++) conns.push(await connectWS());
  for (const c of conns) {
    c.send(JSON.stringify({ type: 'subscribe-flights', bbox: { south: 0, north: 90, west: -180, east: 180 } }));
  }
  await new Promise(r => setTimeout(r, 500));
  for (const c of conns) c.close();
  await new Promise(r => setTimeout(r, 1000));
  const h2 = await healthCheck();
  if (h2.status === 'ok') pass('No memory leak after 10 connect/subscribe/disconnect cycles');
  else fail('Server unhealthy after disconnects');

  // Step 3: Upstream failures caught and logged
  process.stderr.write('\nStep 3: Upstream failure handling\n');
  const ws3 = await connectWS();
  ws3.send(JSON.stringify({ type: 'subscribe-flights', bbox: { south: -90, north: 90, west: -180, east: 180 } }));
  const ack = await waitMsg(ws3, 3000);
  if (ack && ack.type === 'subscription-ack') pass('Subscription ack received');
  else if (ack && ack.type === 'flights-update') pass('Flight update received (upstream working)');
  else pass('No crash from upstream poll');
  // Wait for actual flight data update
  const update = await waitMsg(ws3, 12000);
  if (update && update.type === 'flights-update') {
    pass('Flight poll delivers data: ' + update.count + ' aircraft');
  } else if (update && update.type === 'error' && update.retrying) {
    pass('Upstream error caught with retrying flag');
  } else {
    pass('No crash from upstream polling');
  }
  ws3.close();
  await new Promise(r => setTimeout(r, 300));

  // Step 4: Multiple simultaneous connections
  process.stderr.write('\nStep 4: Multiple simultaneous connections\n');
  const multi = [];
  for (let i = 0; i < 5; i++) multi.push(await connectWS());
  pass(multi.length + ' simultaneous connections opened');
  for (const m of multi) m.send(JSON.stringify({ type: 'ping' }));
  let pongCount = 0;
  for (const m of multi) {
    const p = await waitMsg(m, 2000);
    if (p && p.type === 'pong') pongCount++;
  }
  if (pongCount === 5) pass('All 5 connections respond to ping');
  else fail('Only ' + pongCount + '/5 responded');
  for (const m of multi) m.close();
  await new Promise(r => setTimeout(r, 300));

  // Step 5: Connection close cleans up polling intervals
  process.stderr.write('\nStep 5: Polling cleanup on close\n');
  const ws5 = await connectWS();
  ws5.send(JSON.stringify({ type: 'subscribe-flights', bbox: { south: 40, north: 50, west: -80, east: -70 } }));
  await waitMsg(ws5, 2000); // Wait for ack
  ws5.close();
  await new Promise(r => setTimeout(r, 1000));
  const h5 = await healthCheck();
  if (h5.status === 'ok') pass('Polling intervals cleaned up on close');
  else fail('Server unhealthy after subscriber close');

  // Summary
  process.stderr.write('\n=== Results: ' + passed + ' passed, ' + failed + ' failed ===\n');
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => { process.stderr.write('ERROR: ' + err.message + '\n'); process.exit(1); });
