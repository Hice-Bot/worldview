const { execSync, spawn } = require('child_process');

// Find and kill existing server on port 3001
try {
  const pids = execSync('lsof -ti:3001 2>/dev/null || true').toString().trim();
  if (pids) {
    pids.split('\n').forEach(pid => {
      try { execSync('kill ' + pid.trim()); } catch(e) {}
    });
  }
} catch(e) {}

// Wait a moment then start server
setTimeout(() => {
  const child = spawn('node', ['server/index.js'], {
    cwd: '/mnt/c/Users/turke/worldview',
    detached: true,
    stdio: 'ignore'
  });
  child.unref();

  // Write PID for reference
  require('fs').writeFileSync('/tmp/worldview-server.pid', String(child.pid));

  // Give it time to start
  setTimeout(() => {
    process.exit(0);
  }, 2000);
}, 1000);
