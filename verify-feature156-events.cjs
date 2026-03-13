const fs = require('fs');

const appCode = fs.readFileSync('src/App.tsx', 'utf8');

console.log('=== Verifying all 6 event types are generated in App.tsx ===\n');

const types = ['ACFT', 'SEIS', 'SATS', 'SYS', 'CCTV', 'AIS'];
types.forEach(type => {
  const regex = new RegExp(`addIntelEvent\\(['"]${type}['"]`, 'g');
  const matches = appCode.match(regex) || [];
  console.log(`  ${type}: ${matches.length} event generation call(s) -> ${matches.length > 0 ? 'PASS' : 'FAIL'}`);
});

// Also check that mock data patterns aren't present
console.log('\n=== Mock data check ===');
const mockPatterns = ['mockData', 'fakeData', 'sampleData', 'dummyData', 'testData', 'STUB', 'MOCK'];
const intelCode = fs.readFileSync('src/components/ui/IntelFeed.tsx', 'utf8');
let mockFound = false;
mockPatterns.forEach(p => {
  if (intelCode.toLowerCase().includes(p.toLowerCase())) {
    console.log(`  WARNING: Found "${p}" in IntelFeed.tsx`);
    mockFound = true;
  }
});
if (!mockFound) console.log('  No mock data patterns found - CLEAN');
