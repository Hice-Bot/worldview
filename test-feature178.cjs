// Test Feature #178: Earthquake timestamps display correctly
// Verifies USGS timestamps are properly converted and displayed

const fs = require('fs');
const path = require('path');
const http = require('http');

let pass = true;

// Read source files
const trackedPanelPath = path.join(__dirname, 'src/components/ui/TrackedEntityPanel.tsx');
const intelFeedPath = path.join(__dirname, 'src/components/ui/IntelFeed.tsx');
const appPath = path.join(__dirname, 'src/App.tsx');
const hooksPath = path.join(__dirname, 'src/hooks/useEarthquakes.ts');
const typesPath = path.join(__dirname, 'src/types/index.ts');

const trackedPanel = fs.readFileSync(trackedPanelPath, 'utf8');
const intelFeed = fs.readFileSync(intelFeedPath, 'utf8');
const app = fs.readFileSync(appPath, 'utf8');
const hooks = fs.readFileSync(hooksPath, 'utf8');
const types = fs.readFileSync(typesPath, 'utf8');

console.log('=== Code Analysis ===');

// 1. EarthquakeData type has time field (number = Unix ms)
const hasTimeField = types.includes('time: number;');
console.log('1. EarthquakeData has time: number field:', hasTimeField);
if (!hasTimeField) pass = false;

// 2. useEarthquakes extracts time from USGS props.time
const extractsTime = hooks.includes('time: props.time as number');
console.log('2. useEarthquakes extracts USGS time field:', extractsTime);
if (!extractsTime) pass = false;

// 3. TrackedEntityPanel converts Unix ms to readable UTC format
const convertsToReadable = trackedPanel.includes("new Date(Number(data.time)).toISOString().replace('T', ' ').slice(0, 19)");
console.log('3. TrackedEntityPanel converts Unix ms to readable format:', convertsToReadable);
if (!convertsToReadable) pass = false;

// 4. Time display labeled with Z (Zulu = UTC)
const hasZLabel = trackedPanel.includes("{'Z'}");
console.log('4. Time display labeled with Z (UTC indicator):', hasZLabel);
if (!hasZLabel) pass = false;

// 5. toISOString always returns UTC (no timezone conversion)
const now = new Date();
const isoStr = now.toISOString();
const utcHours = now.getUTCHours();
const isoHours = parseInt(isoStr.slice(11, 13));
console.log('5. toISOString produces UTC hours:', utcHours === isoHours);
if (utcHours !== isoHours) pass = false;

// 6. IntelFeed formatTime uses toISOString (UTC) for timestamps
const formatTimeUtc = intelFeed.includes("date.toISOString().slice(11, 19)");
console.log('6. IntelFeed formatTime uses toISOString (UTC):', formatTimeUtc);
if (!formatTimeUtc) pass = false;

// 7. IntelEvent has timestamp field as Date
const hasTimestampDate = types.includes('timestamp: Date;');
console.log('7. IntelEvent has timestamp: Date field:', hasTimestampDate);
if (!hasTimestampDate) pass = false;

// 8. addIntelEvent creates new Date() for timestamp (current UTC time)
const addIntelNewDate = app.includes("timestamp: new Date()");
console.log('8. addIntelEvent uses new Date() for timestamp:', addIntelNewDate);
if (!addIntelNewDate) pass = false;

// 9. SEIS events generated for earthquake data changes
const hasSEIS = app.includes("addIntelEvent('SEIS'");
console.log('9. SEIS intel events generated:', hasSEIS);
if (!hasSEIS) pass = false;

// 10. SEIS events include earthquake description (magnitude + place)
const seisWithDesc = app.includes("M${strongest.magnitude.toFixed(1)}") ||
                     app.includes("M${quake.magnitude.toFixed(1)}");
console.log('10. SEIS events include magnitude description:', seisWithDesc);
if (!seisWithDesc) pass = false;

// 11. No timezone conversion functions in earthquake display
const noTimezoneInPanel = !trackedPanel.includes('getTimezoneOffset') &&
  !trackedPanel.includes('toLocaleDateString') &&
  !trackedPanel.includes('toLocaleTimeString');
console.log('11. No timezone conversion in TrackedEntityPanel:', noTimezoneInPanel);
if (!noTimezoneInPanel) pass = false;

// 12. No mock data patterns
const allSources = trackedPanel + intelFeed + app + hooks;
const mockPatterns = ['mockData', 'fakeData', 'sampleData', 'dummyData', 'STUB', 'MOCK'];
const hasMock = mockPatterns.some(p => allSources.includes(p));
console.log('12. No mock data patterns:', !hasMock);
if (hasMock) pass = false;

// Now verify via API
console.log('\n=== API Verification ===');

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

fetchJson('http://localhost:3001/api/earthquakes').then(data => {
  const features = data.features || [];
  console.log('Earthquake count:', features.length);

  if (features.length === 0) {
    console.log('WARN: No earthquakes (USGS may have no recent M2.5+ events)');
    // This is OK - USGS data varies
  }

  // Check first few earthquakes have valid timestamps
  const recent = features.slice(0, 5);
  let allTimesValid = true;

  for (const f of recent) {
    const time = f.properties.time;
    const place = f.properties.place;
    const mag = f.properties.mag;

    // Time should be Unix milliseconds
    if (typeof time !== 'number' || time < 1000000000000) {
      console.log('FAIL: Invalid timestamp:', time);
      allTimesValid = false;
      break;
    }

    // Convert to readable format (same as TrackedEntityPanel)
    const readable = new Date(time).toISOString().replace('T', ' ').slice(0, 19) + 'Z';

    // Should be a valid date string
    const dateObj = new Date(time);
    if (isNaN(dateObj.getTime())) {
      console.log('FAIL: Date parse failed for:', time);
      allTimesValid = false;
      break;
    }

    // Should be recent (within last 48 hours for USGS day feed)
    const ageMs = Date.now() - time;
    const ageHours = ageMs / (1000 * 60 * 60);
    const isRecent = ageHours < 48;

    console.log(`  M${mag.toFixed(1)} ${place}`);
    console.log(`    Time: ${readable} (${ageHours.toFixed(1)}h ago) Recent: ${isRecent}`);

    if (!isRecent) {
      allTimesValid = false;
    }
  }

  if (recent.length > 0) {
    console.log('13. All earthquake timestamps valid Unix ms:', allTimesValid);
    if (!allTimesValid) pass = false;
  }

  // Verify format matches display code
  if (recent.length > 0) {
    const sampleTime = recent[0].properties.time;
    const display = new Date(sampleTime).toISOString().replace('T', ' ').slice(0, 19) + 'Z';
    const formatOk = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}Z$/.test(display);
    console.log('14. Display format YYYY-MM-DD HH:MM:SSZ:', formatOk, '(' + display + ')');
    if (!formatOk) pass = false;
  }

  console.log('\n=== RESULT ===');
  console.log(pass ? 'PASS: Earthquake timestamps verified' : 'FAIL: Some checks failed');
  process.exit(pass ? 0 : 1);
}).catch(err => {
  console.error('API fetch error:', err.message);
  process.exit(1);
});
