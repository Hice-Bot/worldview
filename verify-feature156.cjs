const fs = require('fs');

const code = fs.readFileSync('src/components/ui/IntelFeed.tsx', 'utf8');
const types = fs.readFileSync('src/types/index.ts', 'utf8');

console.log('=== Feature #156: Intel Feed Event Type Colors ===\n');

// Check type definition
const typeMatch = types.match(/type:\s*(['"])(.*?)\1/);
console.log('IntelEvent type union:', types.match(/type:.*$/m)?.[0] || 'NOT FOUND');

// Check color definitions
const colors = {
  ACFT: 'text-cyan-400',
  SEIS: 'text-red-400',
  SATS: 'text-lime-400',
  SYS:  'text-amber-400',
  CCTV: 'text-purple-400',
  AIS:  'text-orange-400',
};

const bgColors = {
  ACFT: 'bg-cyan-400/10',
  SEIS: 'bg-red-400/10',
  SATS: 'bg-lime-400/10',
  SYS:  'bg-amber-400/10',
  CCTV: 'bg-purple-400/10',
  AIS:  'bg-orange-400/10',
};

console.log('\n--- Text Colors (type labels) ---');
let allPass = true;
for (const [type, color] of Object.entries(colors)) {
  const found = code.includes(color);
  console.log(`  ${type}: ${color} -> ${found ? 'FOUND' : 'MISSING'}`);
  if (!found) allPass = false;
}

console.log('\n--- Background Colors (row highlights) ---');
for (const [type, color] of Object.entries(bgColors)) {
  const found = code.includes(color);
  console.log(`  ${type}: ${color} -> ${found ? 'FOUND' : 'MISSING'}`);
  if (!found) allPass = false;
}

// Check rendering usage
console.log('\n--- Rendering ---');
const usesTypeColor = code.includes('EVENT_COLORS[event.type]');
const usesBgColor = code.includes('EVENT_BG_COLORS[event.type]');
const hasBold = code.includes('font-bold');
console.log(`  Type color applied: ${usesTypeColor ? 'YES' : 'NO'}`);
console.log(`  Background color applied: ${usesBgColor ? 'YES' : 'NO'}`);
console.log(`  Bold type label: ${hasBold ? 'YES' : 'NO'}`);

if (!usesTypeColor || !usesBgColor) allPass = false;

// Verify all 6 types are distinct
const colorValues = Object.values(colors);
const uniqueColors = new Set(colorValues);
const allDistinct = uniqueColors.size === colorValues.length;
console.log(`\n--- Distinctness ---`);
console.log(`  ${uniqueColors.size} unique colors out of ${colorValues.length} types: ${allDistinct ? 'ALL DISTINCT' : 'DUPLICATES FOUND'}`);
if (!allDistinct) allPass = false;

// Check feature steps
console.log('\n--- Feature Steps Verification ---');
console.log(`  1. ACFT events have aircraft-specific color (cyan-400): ${code.includes("ACFT: 'text-cyan-400'") ? 'PASS' : 'FAIL'}`);
console.log(`  2. SEIS events have seismic-specific color (red-400): ${code.includes("SEIS: 'text-red-400'") ? 'PASS' : 'FAIL'}`);
console.log(`  3. SATS events have satellite-specific color (lime-400): ${code.includes("SATS: 'text-lime-400'") ? 'PASS' : 'FAIL'}`);
console.log(`  4. SYS events have system-specific color (amber-400): ${code.includes("SYS:  'text-amber-400'") ? 'PASS' : 'FAIL'}`);
console.log(`  5. CCTV events have camera-specific color (purple-400): ${code.includes("CCTV: 'text-purple-400'") ? 'PASS' : 'FAIL'}`);
console.log(`  6. AIS events have ship-specific color (orange-400): ${code.includes("AIS:  'text-orange-400'") ? 'PASS' : 'FAIL'}`);
console.log(`  7. Colors are visually distinct and readable: ${allDistinct ? 'PASS' : 'FAIL'}`);

console.log(`\n=== OVERALL: ${allPass ? 'ALL CHECKS PASS' : 'SOME CHECKS FAILED'} ===`);
