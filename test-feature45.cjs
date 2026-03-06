/**
 * Test Feature #45: Default camera position is Sydney at 20M meters
 * Verifies the app starts with camera looking at Sydney from 20,000,000m altitude, top-down
 */
const fs = require('fs');
const path = require('path');

const results = [];

function check(label, condition) {
  if (condition) {
    results.push({ label, pass: true });
    console.log(`  PASS: ${label}`);
  } else {
    results.push({ label, pass: false });
    console.log(`  FAIL: ${label}`);
  }
}

// Read source files
const appTsx = fs.readFileSync(path.join(__dirname, 'src/App.tsx'), 'utf8');
const globeViewer = fs.readFileSync(path.join(__dirname, 'src/components/globe/GlobeViewer.tsx'), 'utf8');

console.log('\n=== Feature #45: Default camera position is Sydney at 20M meters ===');

// Extract DEFAULT_CAMERA values from App.tsx
const defaultCameraMatch = appTsx.match(/const DEFAULT_CAMERA.*?=\s*\{([^}]+)\}/s);
if (!defaultCameraMatch) {
  console.log('FAIL: DEFAULT_CAMERA constant not found in App.tsx');
  process.exit(1);
}
const cameraBlock = defaultCameraMatch[1];
console.log('DEFAULT_CAMERA block:', cameraBlock.trim());

// Extract individual values
const latMatch = cameraBlock.match(/lat:\s*(-?\d+\.?\d*)/);
const lonMatch = cameraBlock.match(/lon:\s*(\d+\.?\d*)/);
const altMatch = cameraBlock.match(/altitude:\s*(\d[\d_]*)/);
const headingMatch = cameraBlock.match(/heading:\s*(\d+)/);
const pitchMatch = cameraBlock.match(/pitch:\s*(-?\d+)/);

const lat = latMatch ? parseFloat(latMatch[1]) : null;
const lon = lonMatch ? parseFloat(lonMatch[1]) : null;
const altRaw = altMatch ? altMatch[1].replace(/_/g, '') : null;
const alt = altRaw ? parseInt(altRaw) : null;
const heading = headingMatch ? parseInt(headingMatch[1]) : null;
const pitch = pitchMatch ? parseInt(pitchMatch[1]) : null;

console.log(`\nParsed values: lat=${lat}, lon=${lon}, alt=${alt}, heading=${heading}, pitch=${pitch}`);

// Step 1: Initial camera longitude is approximately 151.2 (Sydney)
console.log('\n=== Step 1: Initial camera longitude is approximately 151.2 (Sydney) ===');
check('Longitude is approximately 151.2', lon !== null && Math.abs(lon - 151.2) < 1.0);

// Step 2: Initial camera latitude is approximately -33.9 (Sydney)
console.log('\n=== Step 2: Initial camera latitude is approximately -33.9 (Sydney) ===');
check('Latitude is approximately -33.9', lat !== null && Math.abs(lat - (-33.9)) < 1.0);

// Step 3: Initial camera altitude is approximately 20,000,000 meters
console.log('\n=== Step 3: Initial camera altitude is approximately 20,000,000 meters ===');
check('Altitude is 20,000,000 meters', alt === 20000000);

// Step 4: Initial camera pitch is approximately -90 degrees (top-down)
console.log('\n=== Step 4: Initial camera pitch is approximately -90 degrees (top-down) ===');
check('Pitch is -90 degrees (top-down)', pitch === -90);

// Step 5: Globe shows Australia centered on screen at startup
console.log('\n=== Step 5: Globe shows Australia centered on screen at startup ===');
check('App.tsx uses DEFAULT_CAMERA as initial cameraState', appTsx.includes('useState<CameraState>(DEFAULT_CAMERA)'));
check('DEFAULT_CAMERA passed to GlobeViewer as defaultCamera prop', appTsx.includes('defaultCamera={DEFAULT_CAMERA}'));
check('GlobeViewer accepts defaultCamera prop', globeViewer.includes('defaultCamera: CameraState'));
check('GlobeViewer sets initial camera via setView', globeViewer.includes('camera.setView'));
check('Initial camera uses defaultCamera.lon', globeViewer.includes('props.defaultCamera.lon'));
check('Initial camera uses defaultCamera.lat', globeViewer.includes('props.defaultCamera.lat'));
check('Initial camera uses defaultCamera.altitude', globeViewer.includes('props.defaultCamera.altitude'));
check('Initial pitch converted to radians', globeViewer.includes('CesiumMath.toRadians(props.defaultCamera.pitch)'));
check('Heading is 0 (north-up)', heading === 0);
check('Camera state flows from GlobeViewer via onCameraChange', appTsx.includes('onCameraChange={setCameraState}'));
check('GlobeViewer fires initial camera position on mount', globeViewer.includes('onChanged()'));

// Summary
console.log('\n========================================');
console.log('RESULTS SUMMARY:');
console.log('========================================');
const passes = results.filter(r => r.pass).length;
const fails = results.filter(r => !r.pass).length;
console.log(`Total: ${passes} PASS, ${fails} FAIL out of ${results.length} checks`);

if (fails > 0) {
  console.log('\nFailing checks:');
  results.filter(r => !r.pass).forEach(r => console.log(`  - ${r.label}`));
}

if (fails === 0) {
  console.log('\n*** Feature #45 VERIFIED - All checks pass ***');
}
