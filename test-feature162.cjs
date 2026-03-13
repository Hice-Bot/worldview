// Test Feature #162: Mobile StatusBar compact mode
// Verify the StatusBar code has all required mobile compact features

const fs = require('fs');

const statusBarPath = __dirname + '/src/components/ui/StatusBar.tsx';
const code = fs.readFileSync(statusBarPath, 'utf8');

let pass = true;

// 1. StatusBar height changes to 28px on mobile
const has28pxMobile = code.includes("height: '28px'");
const has32pxDesktop = code.includes("height: '32px'");
console.log('1. 28px height on mobile:', has28pxMobile ? 'PASS' : 'FAIL');
console.log('   32px height on desktop:', has32pxDesktop ? 'PASS' : 'FAIL');
if (!has28pxMobile || !has32pxDesktop) pass = false;

// 2. Single row with abbreviated coords, UTC time, altitude
const hasShortDMS = code.includes('toDMSShort');
const hasCompactUtc = code.includes('formatUtcCompact');
const hasAltitude = code.includes('formatAltitude(cameraState.altitude)');
console.log('2. Abbreviated coords (toDMSShort):', hasShortDMS ? 'PASS' : 'FAIL');
console.log('   Compact UTC format:', hasCompactUtc ? 'PASS' : 'FAIL');
console.log('   Altitude shown:', hasAltitude ? 'PASS' : 'FAIL');
if (!hasShortDMS || !hasCompactUtc || !hasAltitude) pass = false;

// 3. Information density reduced for small screens
// Mobile should have fewer items than desktop (no HDG, no OPTICS, fewer entity labels)
const mobileSection = code.split('Mobile StatusBar')[1] || '';
const desktopSection = code.split('Desktop StatusBar')[1]?.split('Mobile StatusBar')[0] || '';
const mobileHasHDG = mobileSection.includes('HDG');
const mobileHasOPTICS = mobileSection.includes('OPTICS');
const desktopHasHDG = desktopSection.includes('HDG');
const desktopHasOPTICS = desktopSection.includes('OPTICS');
console.log('3. Mobile omits HDG (less density):', !mobileHasHDG ? 'PASS' : 'FAIL');
console.log('   Mobile omits OPTICS label:', !mobileHasOPTICS ? 'PASS' : 'FAIL');
console.log('   Desktop has HDG:', desktopHasHDG ? 'PASS' : 'FAIL');
console.log('   Desktop has OPTICS:', desktopHasOPTICS ? 'PASS' : 'FAIL');
if (mobileHasHDG || mobileHasOPTICS || !desktopHasHDG || !desktopHasOPTICS) pass = false;

// 4. Still readable and functional
// Must have: coords, time, and some entity counts
const mobileSectionHasCoords = mobileSection.includes('cameraState.lat');
const mobileSectionHasTime = mobileSection.includes('utcTime') || mobileSection.includes('formatUtc');
const mobileSectionHasEntityCounts = mobileSection.includes('flightCount') || mobileSection.includes('earthquakeCount');
console.log('4. Mobile has coords:', mobileSectionHasCoords ? 'PASS' : 'FAIL');
console.log('   Mobile has time:', mobileSectionHasTime ? 'PASS' : 'FAIL');
console.log('   Mobile has entity counts:', mobileSectionHasEntityCounts ? 'PASS' : 'FAIL');
if (!mobileSectionHasCoords || !mobileSectionHasTime || !mobileSectionHasEntityCounts) pass = false;

// 5. Desktop hidden on mobile, mobile hidden on desktop (responsive breakpoints)
const desktopHidden = code.includes('hidden lg:flex') && code.includes('flex lg:hidden');
console.log('5. Responsive breakpoints (hidden/shown):', desktopHidden ? 'PASS' : 'FAIL');
if (!desktopHidden) pass = false;

// 6. Smaller font on mobile
const mobileFontSmaller = mobileSection.includes("fontSize: '9px'");
const desktopFontSize = desktopSection.includes("fontSize: '10px'");
console.log('6. Smaller font on mobile (9px vs 10px):', (mobileFontSmaller && desktopFontSize) ? 'PASS' : 'FAIL');
if (!mobileFontSmaller || !desktopFontSize) pass = false;

// 7. No mock data
const hasMock = /mockData|fakeData|sampleData|dummyData|STUB|MOCK/.test(code);
console.log('7. No mock data:', !hasMock ? 'PASS' : 'FAIL');
if (hasMock) pass = false;

console.log('\nOVERALL:', pass ? 'ALL CHECKS PASSED' : 'SOME CHECKS FAILED');
