const fs = require('fs');
const path = require('path');

const srcDir = '/mnt/c/Users/turke/worldview/src';

function readFile(p) {
  return fs.readFileSync(path.join(srcDir, p), 'utf-8');
}

const checks = [];

// Check OperationsPanel - fixed left sidebar 224px (w-56)
const ops = readFile('components/ui/OperationsPanel.tsx');
checks.push({
  name: 'OperationsPanel: fixed left sidebar 224px wide',
  pass: ops.includes('fixed left-0 top-0') && ops.includes('w-56') &&
        ops.includes('lg:block'),
  detail: 'w-56 = 14rem = 224px, hidden lg:block shows at 1024px+'
});

// Check IntelFeed - fixed right panel top 288px (w-72)
const intel = readFile('components/ui/IntelFeed.tsx');
checks.push({
  name: 'IntelFeed: fixed right panel top 288px wide',
  pass: intel.includes('fixed right-0 top-0 w-72') && intel.includes('lg:flex'),
  detail: 'w-72 = 18rem = 288px, hidden lg:flex shows at 1024px+'
});

// Check CCTVPanel - fixed right panel below IntelFeed 320px (w-80)
const cctv = readFile('components/ui/CCTVPanel.tsx');
checks.push({
  name: 'CCTVPanel: fixed right panel below IntelFeed 320px wide',
  pass: cctv.includes('fixed right-0 top-[50vh]') && cctv.includes('w-80') && cctv.includes('lg:flex'),
  detail: 'w-80 = 20rem = 320px, top-[50vh] places below IntelFeed'
});

// Check StatusBar - bottom bar spanning full width
const status = readFile('components/ui/StatusBar.tsx');
checks.push({
  name: 'StatusBar: bottom bar spanning full width',
  pass: status.includes('fixed bottom-0') && status.includes('right-0'),
  detail: 'fixed bottom-0 ... right-0 spans full/remaining width'
});

// Check Crosshair - center of viewport
const cross = readFile('components/ui/Crosshair.tsx');
checks.push({
  name: 'Crosshair: center of viewport',
  pass: cross.includes('fixed inset-0') && cross.includes('flex items-center justify-center'),
  detail: 'fixed inset-0 with flex centering'
});

// Check all panels visible simultaneously in App.tsx
const app = readFile('App.tsx');
checks.push({
  name: 'All panels visible simultaneously in App.tsx',
  pass: app.includes('<OperationsPanel') && app.includes('<IntelFeed') &&
        app.includes('<CCTVPanel') && app.includes('<StatusBar') && app.includes('<Crosshair'),
  detail: 'All 5 panel components rendered in App.tsx'
});

// Check globe fills remaining space
const css = readFile('index.css');
checks.push({
  name: 'Globe fills remaining space',
  pass: css.includes('.cesium-viewer') && css.includes('position: absolute') &&
        app.includes('<GlobeViewer'),
  detail: '.cesium-viewer absolute positioning fills parent container'
});

let allPass = true;
for (const c of checks) {
  const icon = c.pass ? 'PASS' : 'FAIL';
  console.log(icon + ': ' + c.name);
  console.log('      ' + c.detail);
  if (!c.pass) allPass = false;
}

console.log('\n' + (allPass ? 'ALL CHECKS PASSED' : 'SOME CHECKS FAILED'));
process.exit(allPass ? 0 : 1);
