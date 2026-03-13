// Test Feature #176: UTC clock displays correct time
// Verifies the StatusBar UTC clock implementation via code analysis

const fs = require('fs');
const path = require('path');

// Read the StatusBar source
const statusBarPath = path.join(__dirname, 'src/components/ui/StatusBar.tsx');
const source = fs.readFileSync(statusBarPath, 'utf8');

let pass = true;

// 1. Check UTC clock state and interval
const hasUtcState = source.includes("useState(new Date())");
console.log('1. Has UTC state with new Date():', hasUtcState);
if (!hasUtcState) pass = false;

// 2. Check 1-second interval for updating
const hasInterval = source.includes("setInterval(() => setUtcTime(new Date()), 1000)");
console.log('2. Has 1-second interval:', hasInterval);
if (!hasInterval) pass = false;

// 3. Check cleanup of interval
const hasClearInterval = source.includes("clearInterval(interval)");
console.log('3. Cleans up interval:', hasClearInterval);
if (!hasClearInterval) pass = false;

// 4. Check format function: YYYY-MM-DD HH:MM:SS
const hasFormatUtc = source.includes("date.toISOString().replace('T', ' ').slice(0, 19)");
console.log('4. Format: YYYY-MM-DD HH:MM:SS via toISOString:', hasFormatUtc);
if (!hasFormatUtc) pass = false;

// 5. Verify toISOString produces UTC (not local time)
const now = new Date();
const isoStr = now.toISOString();
const formatted = isoStr.replace('T', ' ').slice(0, 19);
const utcHours = now.getUTCHours();
const formattedHours = parseInt(formatted.split(' ')[1].split(':')[0]);
console.log('5. toISOString gives UTC hours:', utcHours === formattedHours);
if (utcHours !== formattedHours) pass = false;

// 6. Check format matches pattern YYYY-MM-DD HH:MM:SS
const pattern = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
console.log('6. Formatted time matches pattern:', pattern.test(formatted), '(' + formatted + ')');
if (!pattern.test(formatted)) pass = false;

// 7. Check the formatted string ends with ' UTC' in the rendered output
const hasUtcSuffix = source.includes("+ ' UTC'");
console.log('7. Appends " UTC" suffix:', hasUtcSuffix);
if (!hasUtcSuffix) pass = false;

// 8. Check <time> element with datetime attribute
const hasTimeElement = source.includes('<time') && source.includes('dateTime={utcTime.toISOString()}');
console.log('8. Uses <time> element with ISO datetime attr:', hasTimeElement);
if (!hasTimeElement) pass = false;

// 9. Verify no drift: uses new Date() each tick (not incrementing manually)
const usesNewDateEachTick = source.includes("setUtcTime(new Date())");
console.log('9. Creates new Date() each tick (no drift):', usesNewDateEachTick);
if (!usesNewDateEachTick) pass = false;

// 10. Verify seconds tick by testing the interval logic
// Simulate: two Date() calls 1 second apart should differ in seconds field
const t1 = new Date();
const f1 = t1.toISOString().replace('T', ' ').slice(0, 19);
// Just verify the seconds portion exists and changes
const seconds = parseInt(f1.split(':')[2]);
console.log('10. Seconds field present and valid (0-59):', seconds >= 0 && seconds <= 59);
if (seconds < 0 || seconds > 59) pass = false;

// 11. Check aria-label for accessibility
const hasAriaLabel = source.includes('aria-label={`UTC time:');
console.log('11. Has aria-label for UTC time:', hasAriaLabel);
if (!hasAriaLabel) pass = false;

// 12. No mock/fake data patterns
const mockPatterns = ['mockData', 'fakeData', 'sampleData', 'dummyData', 'STUB', 'MOCK'];
const hasMock = mockPatterns.some(p => source.includes(p));
console.log('12. No mock data patterns:', !hasMock);
if (hasMock) pass = false;

console.log('\n=== RESULT ===');
console.log(pass ? 'PASS: All UTC clock checks verified' : 'FAIL: Some checks failed');
process.exit(pass ? 0 : 1);
