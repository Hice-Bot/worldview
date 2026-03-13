var fs = require('fs');
var code = fs.readFileSync('src/components/globe/EntityClickHandler.tsx', 'utf-8');
var idx = code.indexOf("e.key === 'Escape'");
console.log('Found at index:', idx);
if (idx >= 0) {
  console.log('Context:', JSON.stringify(code.substring(idx, idx + 300)));
}
