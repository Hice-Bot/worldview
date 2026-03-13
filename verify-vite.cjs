var fs = require('fs');
var d = fs.readFileSync('/tmp/vite-check.html', 'utf8');
console.log('Page loads:', d.includes('root') ? 'YES' : 'NO');
console.log('Has module:', d.includes('type="module"') ? 'YES' : 'NO');
