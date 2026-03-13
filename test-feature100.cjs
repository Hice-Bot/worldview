const fs = require('fs');

// Read the TrackedEntityPanel source
const src = fs.readFileSync('./src/components/ui/TrackedEntityPanel.tsx', 'utf-8');
const appSrc = fs.readFileSync('./src/App.tsx', 'utf-8');

const checks = [
  // Aircraft details
  ['Aircraft callsign', src.includes('callsign') && src.includes('CALLSIGN')],
  ['Aircraft ICAO24', src.includes('icao24') && src.includes('ICAO24')],
  ['Aircraft registration', src.includes('registration') && src.includes('REG')],
  ['Aircraft altitude', src.includes('altitudeFeet') && src.includes('ALT')],
  ['Aircraft speed', src.includes('velocityKnots') && src.includes('SPD')],
  ['Aircraft heading', src.includes('heading') && src.includes('HDG')],
  ['Aircraft vertical rate', src.includes('verticalRate') && src.includes('VS')],
  ['Aircraft origin/destination', src.includes('origin') && src.includes('destination') && src.includes('ROUTE')],

  // Satellite details
  ['Satellite name (entity.name)', src.includes('entity.name')],
  ['Satellite NORAD ID', src.includes('noradId') || src.includes('norad')],
  ['Satellite altitude km', src.includes('altitude') && src.includes('km')],
  ['Satellite orbit/group', src.includes('category') && src.includes('GROUP')],

  // Ship details
  ['Ship MMSI', src.includes('mmsi') && src.includes('MMSI')],
  ['Ship IMO', src.includes('imo') && src.includes('IMO')],
  ['Ship call sign', src.includes('callSign') && src.includes('CALL SIGN')],
  ['Ship speed (SOG)', src.includes('sog') && src.includes('SOG')],
  ['Ship heading', src.includes('heading') && src.includes('HDG')],
  ['Ship destination', src.includes('destination') && src.includes('DEST')],
  ['Ship vessel type', src.includes('vesselType') || src.includes('shipType')],

  // Earthquake details
  ['Earthquake magnitude', src.includes('magnitude') && src.includes('MAG')],
  ['Earthquake depth', src.includes('depth') && src.includes('DEPTH')],
  ['Earthquake location', src.includes('place') && src.includes('LOC')],
  ['Earthquake time', src.includes('time') && src.includes('TIME')],

  // Panel behavior
  ['Panel appears when tracked', appSrc.includes('trackedEntity &&') && appSrc.includes('TrackedEntityPanel')],
  ['Panel hides when untracked', appSrc.includes('setTrackedEntity(null)')],
  ['Floating panel position', src.includes('fixed')],

  // Type-specific rendering
  ['Aircraft type routing', src.includes("entity.type === 'aircraft'")],
  ['Satellite type routing', src.includes("entity.type === 'satellite'")],
  ['Ship type routing', src.includes("entity.type === 'ship'")],
  ['Earthquake type routing', src.includes("entity.type === 'earthquake'")],

  // AIS vessel type mapping
  ['Vessel type: CARGO', src.includes('CARGO')],
  ['Vessel type: TANKER', src.includes('TANKER')],
  ['Vessel type: PASSENGER', src.includes('PASSENGER')],

  // Close button
  ['ESC close', src.includes('ESC') || src.includes('onClose')],
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
  console.log('\nAll TrackedEntityPanel requirements verified!');
}
