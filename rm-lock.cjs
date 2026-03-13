const fs = require('fs');
const lockPath = '/mnt/c/Users/turke/worldview/.git/index.lock';
try {
  fs.unlinkSync(lockPath);
  console.log('Lock file removed');
} catch (e) {
  console.log('No lock file or error: ' + e.message);
}
