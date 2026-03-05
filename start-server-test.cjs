var cp = require('child_process');

// Kill existing
try {
  var pids = cp.execSync('lsof -ti:3001 2>/dev/null || true').toString().trim();
  if (pids) {
    pids.split('\n').forEach(function(pid) {
      try { cp.execSync('kill ' + pid.trim()); } catch(e) {}
    });
  }
} catch(e) {}

// Start server with output visible
var child = cp.spawn('node', ['server/index.js'], {
  cwd: '/mnt/c/Users/turke/worldview',
  stdio: ['ignore', 'pipe', 'pipe'],
  detached: true,
});

var stdout = '';
var stderr = '';

child.stdout.on('data', function(d) { stdout += d.toString(); });
child.stderr.on('data', function(d) { stderr += d.toString(); });

setTimeout(function() {
  console.log('STDOUT:', stdout);
  console.log('STDERR:', stderr);
  child.unref();
  process.exit(0);
}, 5000);
