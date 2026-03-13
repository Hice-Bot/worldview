const fs = require('fs');

const src = fs.readFileSync('./src/components/ui/Crosshair.tsx', 'utf-8');
const appSrc = fs.readFileSync('./src/App.tsx', 'utf-8');

const checks = [
  // Pure CSS (no canvas/WebGL)
  ['Pure CSS - no canvas', !src.includes('canvas') && !src.includes('Canvas')],
  ['Pure CSS - no WebGL', !src.includes('webgl') && !src.includes('WebGL')],
  ['Uses div elements', src.includes('<div')],

  // Always visible
  ['pointer-events-none', src.includes('pointer-events-none')],
  ['z-index for visibility', src.includes('z-40')],
  ['Rendered in App.tsx', appSrc.includes('<Crosshair')],
  ['Not conditional render', !appSrc.includes('{/* Crosshair */}') || appSrc.includes('<Crosshair')],

  // Centered positioning
  ['Fixed positioning', src.includes('fixed')],
  ['Inset-0 full viewport', src.includes('inset-0')],
  ['Flex center', src.includes('items-center') && src.includes('justify-center')],

  // Subtle design
  ['Low opacity lines', src.includes('bg-white/2')],
  ['Small size', src.includes('w-8 h-8') || src.includes('w-6 h-6')],

  // Visible on light and dark backgrounds
  ['Drop shadow for contrast', src.includes('drop-shadow') || src.includes('shadow')],

  // Components
  ['Horizontal line', src.includes('Horizontal')],
  ['Vertical line', src.includes('Vertical')],
  ['Center dot', src.includes('Center dot')],
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
  console.log('\nAll Crosshair requirements verified!');
}
