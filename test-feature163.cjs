// Test Feature #163: CCTVPanel collapsible on desktop
// Verify the CCTVPanel code has collapse/expand functionality

const fs = require('fs');

const cctvPath = __dirname + '/src/components/ui/CCTVPanel.tsx';
const code = fs.readFileSync(cctvPath, 'utf8');

let pass = true;

// 1. Header has collapse/expand toggle
const hasCollapsedState = code.includes("const [collapsed, setCollapsed] = useState");
const hasToggle = code.includes("setCollapsed(!collapsed)");
const hasIndicator = code.includes("collapsed ? '\u25B6' : '\u25BC'") || code.includes("collapsed ?");
console.log('1. Has collapsed state:', hasCollapsedState ? 'PASS' : 'FAIL');
console.log('   Has toggle onClick:', hasToggle ? 'PASS' : 'FAIL');
console.log('   Has expand/collapse indicator:', hasIndicator ? 'PASS' : 'FAIL');
if (!hasCollapsedState || !hasToggle) pass = false;

// 2. Collapsed state shows only header bar
const hasConditionalContent = code.includes('{!collapsed && (');
console.log('2. Content hidden when collapsed:', hasConditionalContent ? 'PASS' : 'FAIL');
if (!hasConditionalContent) pass = false;

// 3. Expanded state shows full panel content
// When not collapsed, all content is visible (filters, preview, thumbnails)
const hasFilters = code.includes('countryFilter');
const hasThumbnails = code.includes('CameraThumbnail');
const hasPreview = code.includes('selectedCamera');
console.log('3. Has filter buttons:', hasFilters ? 'PASS' : 'FAIL');
console.log('   Has thumbnails:', hasThumbnails ? 'PASS' : 'FAIL');
console.log('   Has preview:', hasPreview ? 'PASS' : 'FAIL');
if (!hasFilters || !hasThumbnails || !hasPreview) pass = false;

// 4. Collapse state persists during session (useState maintains state)
const usesUseState = code.includes('useState(false)') || code.includes('useState<boolean>');
console.log('4. State persists via useState:', usesUseState ? 'PASS' : 'FAIL');
if (!usesUseState) pass = false;

// 5. Desktop panel exists and has header
const hasDesktopPanel = code.includes('hidden lg:flex') || code.includes('hidden lg:block');
const hasHeader = code.includes('CCTV Feeds') && code.includes('ONLINE');
console.log('5. Desktop panel present:', hasDesktopPanel ? 'PASS' : 'FAIL');
console.log('   Header with title+count:', hasHeader ? 'PASS' : 'FAIL');
if (!hasDesktopPanel || !hasHeader) pass = false;

// 6. Header is clickable (cursor-pointer)
const hasClickableHeader = code.includes('cursor-pointer') && code.includes('select-none');
console.log('6. Header clickable:', hasClickableHeader ? 'PASS' : 'FAIL');
if (!hasClickableHeader) pass = false;

// 7. No mock data
const hasMock = /mockData|fakeData|sampleData|dummyData|STUB|MOCK/.test(code);
console.log('7. No mock data:', !hasMock ? 'PASS' : 'FAIL');
if (hasMock) pass = false;

console.log('\nOVERALL:', pass ? 'ALL CHECKS PASSED' : 'SOME CHECKS FAILED');
