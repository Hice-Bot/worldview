const WebSocket = require('ws');

// Test WebSocket through Vite proxy
const ws = new WebSocket('ws://localhost:5173/ws');

ws.on('open', () => {
  console.log('WS CONNECTED via Vite proxy on port 5173');
  ws.close();
});

ws.on('error', (e) => {
  console.log('WS ERROR:', e.message);
  process.exit(1);
});

ws.on('close', () => {
  console.log('WS CLOSED cleanly');
  process.exit(0);
});

setTimeout(() => {
  console.log('TIMEOUT - no WS connection after 5s');
  process.exit(1);
}, 5000);
