const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:3001/ws');
ws.on('open', () => {
  ws.send(JSON.stringify({ type: 'subscribe-flights', bbox: { south: -90, north: 90, west: -180, east: 180 } }));
});

let msgCount = 0;
ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  msgCount++;
  if (msg.type === 'subscription-ack') {
    process.stderr.write('Subscription acknowledged\n');
  } else if (msg.type === 'flights-update') {
    process.stderr.write('Flight update: ' + msg.count + ' aircraft, timestamp: ' + msg.timestamp + '\n');
    ws.close();
  } else if (msg.type === 'error') {
    process.stderr.write('Error: ' + msg.message + '\n');
    ws.close();
  }
});

ws.on('close', () => {
  process.stderr.write('Done. Messages received: ' + msgCount + '\n');
  process.exit(0);
});

ws.on('error', (err) => {
  process.stderr.write('WS Error: ' + err.message + '\n');
  process.exit(1);
});

setTimeout(() => { process.stderr.write('Timeout\n'); process.exit(1); }, 15000);
