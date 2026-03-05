var cp = require('child_process');
var port = process.argv[2] || '3001';
try {
  var pids = cp.execSync('lsof -ti:' + port).toString().trim();
  if (pids) {
    pids.split('\n').forEach(function(pid) {
      pid = pid.trim();
      if (pid) {
        try {
          cp.execSync('kill -9 ' + pid);
          console.log('Killed PID ' + pid + ' on port ' + port);
        } catch(e) {
          console.log('Could not kill PID ' + pid);
        }
      }
    });
  } else {
    console.log('No process on port ' + port);
  }
} catch(e) {
  console.log('No process found on port ' + port);
}
