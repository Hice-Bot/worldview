const fs = require('fs');
const path = require('path');

function getAllFiles(dir, ext) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      results = results.concat(getAllFiles(filePath, ext));
    } else if (ext.some(e => file.endsWith(e))) {
      results.push(filePath);
    }
  });
  return results;
}

const srcDir = '/mnt/c/Users/turke/worldview/src';
const files = getAllFiles(srcDir, ['.ts', '.tsx', '.js', '.jsx']);

const externalApiPatterns = [
  /earthquake\.usgs\.gov/i,
  /api\.adsb\.fi/i,
  /celestrak\.org|celestrak\.com/i,
  /overpass-api\.de|overpass\.kumi/i,
  /api\.tfl\.gov/i,
  /aisstream\.io/i,
  /opensky-network\.org/i,
  /digitraffic/i,
  /flightradar24/i,
  /cctv\.austinmobility/i,
  /jamcams\.tfl/i,
];

let violations = [];
let fetchCalls = [];

files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');

  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return;

    externalApiPatterns.forEach(pattern => {
      if (pattern.test(line)) {
        violations.push({ file: path.relative(srcDir, file), line: i+1, text: trimmed });
      }
    });

    if (/fetch\s*\(/.test(line)) {
      fetchCalls.push({ file: path.relative(srcDir, file), line: i+1, text: trimmed });
    }
  });
});

console.log('=== EXTERNAL API VIOLATIONS (should be 0) ===');
console.log('Count:', violations.length);
violations.forEach(v => console.log('  ' + v.file + ':' + v.line + ' -> ' + v.text));

console.log('\n=== FETCH CALLS ===');
console.log('Count:', fetchCalls.length);
fetchCalls.forEach(f => {
  const usesApiPath = /fetch\s*\(\s*[`'"]\/api\//.test(f.text);
  console.log('  [' + (usesApiPath ? 'OK /api/' : 'WARN') + '] ' + f.file + ':' + f.line + ' -> ' + f.text);
});

console.log('\n=== SUMMARY ===');
console.log('Total src files scanned:', files.length);
console.log('External API violations:', violations.length);
console.log('All fetch calls use /api/:', fetchCalls.every(f => /fetch\s*\(\s*[`'"]\/api\//.test(f.text)));
console.log('FEATURE #9 PASSES:', violations.length === 0 && fetchCalls.every(f => /fetch\s*\(\s*[`'"]\/api\//.test(f.text)));
