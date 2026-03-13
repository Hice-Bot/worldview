const fs = require('fs');
const path = require('path');

const srcDir = '/mnt/c/Users/turke/worldview/src';
function readFile(p) {
  return fs.readFileSync(path.join(srcDir, p), 'utf-8');
}

const checks = [];
const ops = readFile('components/ui/OperationsPanel.tsx');

// 1. FAB displayed instead of sidebar (below 1024px)
checks.push({
  name: 'FAB displayed instead of sidebar (lg:hidden)',
  pass: ops.includes('lg:hidden') && ops.includes('rounded-full') &&
        ops.includes('fixed left-4 bottom-12'),
  detail: 'FAB button with lg:hidden, positioned bottom-left for thumb access'
});

// 2. FAB shows layer count badge
checks.push({
  name: 'FAB shows layer count badge',
  pass: ops.includes('activeLayerCount') && ops.includes('bg-green-500') &&
        ops.includes('{activeLayerCount}'),
  detail: 'Badge shows count of active layers from Object.values(layers).filter(Boolean).length'
});

// 3. Tapping FAB opens full-screen modal
checks.push({
  name: 'Tapping FAB opens full-screen modal',
  pass: ops.includes('setMobileOpen(true)') && ops.includes('fixed inset-0') &&
        ops.includes('z-[60]'),
  detail: 'onClick sets mobileOpen=true, modal uses fixed inset-0 z-[60]'
});

// 4. Modal contains all OperationsPanel sections
checks.push({
  name: 'Modal contains all OperationsPanel sections',
  pass: ops.includes('<PanelContent') && ops.includes('Optics Mode') &&
        ops.includes('Map Tiles') && ops.includes('Data Layers') &&
        ops.includes('Flight Filters') && ops.includes('Satellite Filters') &&
        ops.includes('Utility'),
  detail: 'PanelContent component shared between desktop sidebar and mobile modal'
});

// 5. Modal can be dismissed
checks.push({
  name: 'Modal can be dismissed',
  pass: ops.includes('setMobileOpen(false)') && ops.includes('Close operations panel'),
  detail: 'Close button with X icon sets mobileOpen=false'
});

// 6. FAB positioned for easy thumb access
checks.push({
  name: 'FAB positioned for easy thumb access',
  pass: ops.includes('bottom-12') && ops.includes('left-4'),
  detail: 'bottom-12 (48px from bottom) left-4 (16px from left) — natural thumb reach zone'
});

// 7. Desktop sidebar still works
checks.push({
  name: 'Desktop sidebar preserved (hidden lg:block)',
  pass: ops.includes('hidden lg:block') && ops.includes('w-56'),
  detail: 'Desktop sidebar still 224px wide, hidden on mobile, visible on desktop'
});

// 8. useState import for mobileOpen state
checks.push({
  name: 'useState imported for mobile state management',
  pass: ops.includes("import { useState }") && ops.includes('useState(false)'),
  detail: 'useState hook manages mobileOpen boolean state'
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
