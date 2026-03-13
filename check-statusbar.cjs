var fs = require('fs');
var c = fs.readFileSync(__dirname + '/src/components/ui/StatusBar.tsx', 'utf8');
console.log('has toDMSShort:', c.includes('toDMSShort'));
console.log('has 28px:', c.includes("height: '28px'"));
console.log('has lg:hidden:', c.includes('lg:hidden'));
console.log('has mobile-statusbar:', c.includes('mobile-statusbar'));
console.log('line count:', c.split('\n').length);
