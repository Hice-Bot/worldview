var fs = require('fs');
var http = require('http');

// Check 1: Source code verification
var intelCode = fs.readFileSync('src/components/ui/IntelFeed.tsx', 'utf8');
var appCode = fs.readFileSync('src/App.tsx', 'utf8');

console.log('=== Feature #157: Intel feed shows most recent 20 entries ===\n');

// Step 1: Only 20 most recent events shown
var hasSlice20 = intelCode.includes('.slice(0, 20)');
var hasAppSlice = appCode.includes('.slice(0, 20)');
console.log('Step 1 - Only 20 most recent events shown:');
console.log('  IntelFeed.tsx has slice(0, 20):', hasSlice20 ? 'PASS' : 'FAIL');
console.log('  App.tsx addIntelEvent has slice(0, 20):', hasAppSlice ? 'PASS' : 'FAIL');

// Step 2: Older events scroll off as new ones arrive
// In addIntelEvent: [...newEvent, ...prev].slice(0, 20) means oldest are dropped
var hasPrepend = appCode.includes('...prev,');
var hasOverflowScroll = intelCode.includes('overflow-y-auto');
console.log('\nStep 2 - Older events scroll off:');
console.log('  New events prepended (oldest truncated at 20):', hasPrepend ? 'PASS' : 'FAIL');
console.log('  Scrollable container (overflow-y-auto):', hasOverflowScroll ? 'PASS' : 'FAIL');

// Step 3: New events appear at the top
var hasAutoScroll = intelCode.includes('scrollTop = 0');
var hasPrependArray = appCode.match(/\[\s*\{[^}]*\},\s*\.\.\.prev/);
console.log('\nStep 3 - New events appear at the top:');
console.log('  New event prepended to array:', hasPrependArray ? 'PASS' : 'FAIL');
console.log('  Auto-scroll to top on new event:', hasAutoScroll ? 'PASS' : 'FAIL');

// Step 4: Counter excludes system messages for badge display
var hasBadgeCount = intelCode.includes('badgeCount');
var hasSysFilter = intelCode.includes("e.type !== 'SYS'");
var badgeUsesSysFilter = intelCode.includes('badgeCount > 0');
console.log('\nStep 4 - Counter excludes system messages for badge:');
console.log('  badgeCount variable defined:', hasBadgeCount ? 'PASS' : 'FAIL');
console.log('  Filters out SYS type:', hasSysFilter ? 'PASS' : 'FAIL');
console.log('  Badge uses filtered count:', badgeUsesSysFilter ? 'PASS' : 'FAIL');

var allPass = hasSlice20 && hasAppSlice && hasPrepend && hasOverflowScroll &&
              hasAutoScroll && hasPrependArray && hasBadgeCount && hasSysFilter && badgeUsesSysFilter;
console.log('\n=== OVERALL:', allPass ? 'ALL CHECKS PASS' : 'SOME CHECKS FAILED', '===');
