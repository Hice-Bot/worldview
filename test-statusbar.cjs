const fs = require('fs');

// Read the StatusBar source and verify all requirements
const src = fs.readFileSync('./src/components/ui/StatusBar.tsx', 'utf-8');

const checks = [
  // DMS format
  ['DMS conversion function', src.includes('toDMS')],
  ['Hemisphere N/S', src.includes("'N'") && src.includes("'S'")],
  ['Hemisphere E/W', src.includes("'E'") && src.includes("'W'")],
  ['Degree symbol', src.includes('\\u00B0') || src.includes('\u00B0')],
  ['Minutes/seconds DMS', src.includes("'") && src.includes('"')],

  // Altitude formatting
  ['Altitude formatAltitude function', src.includes('formatAltitude')],
  ['Altitude meters below 1km', src.includes('< 1000') || src.includes('< 1_000')],
  ['Altitude km above 1km', src.includes('/ 1000') || src.includes('/ 1_000')],

  // Layout sections
  ['LAT label', src.includes('LAT')],
  ['LON label', src.includes('LON')],
  ['ALT label', src.includes('ALT')],
  ['HDG label', src.includes('HDG')],

  // UTC clock
  ['UTC time', src.includes('UTC')],
  ['1-second interval', src.includes('1000')],
  ['ISO format', src.includes('toISOString')],

  // Entity counts
  ['ACFT count', src.includes('ACFT')],
  ['SATS count', src.includes('SATS')],
  ['SEIS count', src.includes('SEIS')],
  ['CCTV count', src.includes('CCTV')],
  ['AIS count', src.includes('AIS')],

  // Color coding
  ['ACFT green', src.includes('#4ade80')],
  ['SEIS amber', src.includes('#fbbf24')],
  ['CCTV red', src.includes('#f87171')],
  ['AIS cyan', src.includes('#22d3ee')],

  // OPTICS mode
  ['OPTICS label', src.includes('OPTICS')],
  ['STD mode', src.includes('STD')],

  // Glass-morphism
  ['Backdrop blur', src.includes('blur')],
  ['Cyan glow border', src.includes('rgba(0, 255, 200')],
  ['Text shadow glow', src.includes('textShadow')],

  // Props
  ['flightCount prop', src.includes('flightCount')],
  ['satelliteCount prop', src.includes('satelliteCount')],
  ['earthquakeCount prop', src.includes('earthquakeCount')],
  ['cctvCount prop', src.includes('cctvCount')],
  ['shipCount prop', src.includes('shipCount')],
  ['shaderMode prop', src.includes('shaderMode')],
  ['cameraState prop', src.includes('cameraState')],

  // Monospace font
  ['Monospace font', src.includes('font-mono') || src.includes('monospace')],
];

let passed = 0;
let failed = 0;
for (const [name, result] of checks) {
  if (result) {
    passed++;
    console.log(`  PASS: ${name}`);
  } else {
    failed++;
    console.log(`  FAIL: ${name}`);
  }
}

console.log(`\n${passed}/${checks.length} checks passed, ${failed} failed`);

if (failed > 0) {
  process.exit(1);
} else {
  console.log('\nAll StatusBar requirements verified!');
}
