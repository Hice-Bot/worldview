var cp = require('child_process');
var fs = require('fs');

// Kill ALL existing processes on port 3001
function killPort() {
  try {
    var pids = cp.execSync('lsof -ti:3001').toString().trim();
    if (pids) {
      pids.split('\n').forEach(function(pid) {
        try { cp.execSync('kill -9 ' + pid.trim()); } catch(e) {}
      });
      return true;
    }
  } catch(e) {}
  return false;
}

// Kill multiple times to be sure
killPort();
cp.execSync('sleep 1');
killPort();
cp.execSync('sleep 1');
killPort();
cp.execSync('sleep 1');

// Start server
var logFd = fs.openSync('/tmp/worldview-server.log', 'w');
var child = cp.spawn('node', ['server/index.js'], {
  cwd: '/mnt/c/Users/turke/worldview',
  detached: true,
  stdio: ['ignore', logFd, logFd]
});
child.unref();
fs.writeFileSync('/tmp/worldview-server.pid', String(child.pid));
console.log('Started server PID ' + child.pid);

// Wait for server to start
cp.execSync('sleep 3');

// Verify
try {
  var result = cp.execSync('curl -s http://localhost:3001/api/health').toString();
  if (result.indexOf('"status":"ok"') >= 0) {
    console.log('Server healthy: ' + result.substring(0, 80));
  } else {
    console.log('Server response: ' + result.substring(0, 200));
  }
} catch(e) {
  console.log('Server not responding yet');
  try {
    var log = fs.readFileSync('/tmp/worldview-server.log', 'utf8');
    console.log('Server log:', log.substring(0, 500));
  } catch(e2) {}
}
