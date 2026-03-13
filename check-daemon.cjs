const fs = require('fs');
const path = require('path');
const net = require('net');

const daemonDir = '/home/jef/.cache/ms-playwright/daemon';
try {
  const entries = fs.readdirSync(daemonDir);
  console.log('Daemon directory contents:');
  entries.forEach(e => {
    const full = path.join(daemonDir, e);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      const subEntries = fs.readdirSync(full);
      console.log('  ' + e + '/ -> ' + subEntries.join(', '));
      subEntries.forEach(se => {
        const content = fs.readFileSync(path.join(full, se), 'utf8');
        console.log('    ' + se + ': ' + content.substring(0, 200));
      });
    } else {
      const content = fs.readFileSync(full, 'utf8');
      console.log('  ' + e + ': ' + content.substring(0, 200));
    }
  });
} catch (e) {
  console.log('Daemon dir error: ' + e.message);
}

function checkPort(port) {
  return new Promise((resolve) => {
    const sock = new net.Socket();
    sock.setTimeout(1000);
    sock.on('connect', () => { sock.destroy(); resolve(true); });
    sock.on('error', () => resolve(false));
    sock.on('timeout', () => { sock.destroy(); resolve(false); });
    sock.connect(port, '127.0.0.1');
  });
}

async function main() {
  const ports = [3001, 5173, 9222, 9223, 4444, 8080, 6000, 6001, 3333];
  for (const p of ports) {
    const open = await checkPort(p);
    if (open) console.log('Port ' + p + ': OPEN');
  }
}

main();
