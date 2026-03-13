const fs = require('fs');
const path = require('path');

const srcDir = '/mnt/c/Users/turke/worldview/src';
function readFile(p) {
  return fs.readFileSync(path.join(srcDir, p), 'utf-8');
}

const checks = [];
const intel = readFile('components/ui/IntelFeed.tsx');

// 1. Badge button replaces fixed panel below 1024px
checks.push({
  name: 'Badge button replaces fixed panel (lg:hidden)',
  pass: intel.includes('lg:hidden') && intel.includes('INTEL') &&
        intel.includes('rounded-full') && intel.includes('fixed top-2 right-2'),
  detail: 'Badge button in lg:hidden div, desktop panel uses hidden lg:flex'
});

// 2. Badge shows event count excluding system messages
checks.push({
  name: 'Badge shows event count (excluding SYS)',
  pass: intel.includes("e.type !== 'SYS'") && intel.includes('badgeCount') &&
        intel.includes('{badgeCount}'),
  detail: "badgeCount = displayEvents.filter(e => e.type !== 'SYS').length"
});

// 3. Tapping opens full-screen modal
checks.push({
  name: 'Tapping opens full-screen modal',
  pass: intel.includes('setMobileOpen') && intel.includes('fixed inset-0') &&
        intel.includes('z-[60]'),
  detail: 'mobileOpen state controls full-screen modal with fixed inset-0'
});

// 4. Modal scrollable for event history
checks.push({
  name: 'Modal scrollable for event history',
  pass: intel.includes('overflow-y-auto') && intel.includes('flex-1'),
  detail: 'overflow-y-auto flex-1 makes event list scrollable'
});

// 5. Modal dismissible
checks.push({
  name: 'Modal dismissible',
  pass: intel.includes('setMobileOpen(false)'),
  detail: 'Close button calls setMobileOpen(false)'
});

// 6. Desktop panel preserved
checks.push({
  name: 'Desktop panel preserved (hidden lg:flex)',
  pass: intel.includes('hidden lg:flex') && intel.includes('w-72'),
  detail: 'Desktop 288px panel still uses hidden lg:flex pattern'
});

// 7. renderEvents shared between desktop and mobile
checks.push({
  name: 'renderEvents shared between desktop and mobile',
  pass: (intel.match(/renderEvents\(\)/g) || []).length >= 2,
  detail: 'renderEvents() called in both desktop panel and mobile modal'
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
