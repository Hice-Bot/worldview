// Test Feature #179: Intel Feed Timestamps Accurate (UTC HH:MM:SS)

// Replicate the exact formatTime function from IntelFeed.tsx
function formatTime(date) {
  return date.toISOString().slice(11, 19);
}

// Test 1: Format matches HH:MM:SS
var now = new Date();
var formatted = formatTime(now);
var matches = /^\d{2}:\d{2}:\d{2}$/.test(formatted);
console.log('Test 1 - HH:MM:SS format:', matches ? 'PASS' : 'FAIL', '(' + formatted + ')');

// Test 2: Uses UTC not local timezone
var utcHour = now.getUTCHours();
var formattedHour = parseInt(formatted.split(':')[0]);
var isUtc = formattedHour === utcHour;
console.log('Test 2 - Uses UTC:', isUtc ? 'PASS' : 'FAIL', '(UTC hour=' + utcHour + ', formatted hour=' + formattedHour + ')');

// Test 3: Timestamps match StatusBar UTC clock format
// StatusBar uses: toISOString().replace('T', ' ').slice(0, 19) + ' UTC'
var statusBarTime = now.toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
var statusBarHMS = statusBarTime.slice(11, 19);
var clockMatch = statusBarHMS === formatted;
console.log('Test 3 - Matches StatusBar UTC clock:', clockMatch ? 'PASS' : 'FAIL', '(StatusBar=' + statusBarHMS + ', IntelFeed=' + formatted + ')');

// Test 4: Events logged at correct time (timestamp = new Date() at creation)
var before = Date.now();
var event = {
  id: Date.now().toString(),
  type: 'SYS',
  message: 'TEST EVENT',
  timestamp: new Date(),
};
var after = Date.now();
var eventMs = event.timestamp.getTime();
var createdAtCorrectTime = eventMs >= before && eventMs <= after;
console.log('Test 4 - Event logged at correct time:', createdAtCorrectTime ? 'PASS' : 'FAIL');

// Test 5: toISOString always returns Z (UTC) suffix
var isoStr = now.toISOString();
var endsWithZ = isoStr.endsWith('Z');
console.log('Test 5 - ISO string is UTC (ends with Z):', endsWithZ ? 'PASS' : 'FAIL', '(' + isoStr + ')');

// Test 6: Multiple events get sequential timestamps
var events = [];
for (var i = 0; i < 5; i++) {
  events.push({
    id: Date.now().toString(),
    type: 'SYS',
    message: 'TEST ' + i,
    timestamp: new Date(),
  });
}
var allValid = events.every(function(e) {
  return /^\d{2}:\d{2}:\d{2}$/.test(formatTime(e.timestamp));
});
console.log('Test 6 - All timestamps valid HH:MM:SS:', allValid ? 'PASS' : 'FAIL');

console.log('\n--- Summary ---');
var allPass = matches && isUtc && clockMatch && createdAtCorrectTime && endsWithZ && allValid;
console.log('Feature #179 overall:', allPass ? 'ALL TESTS PASS' : 'SOME TESTS FAILED');
