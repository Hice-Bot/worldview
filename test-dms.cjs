// Test DMS conversion function
function toDMS(decimal, isLat) {
  const hemisphere = isLat
    ? (decimal >= 0 ? 'N' : 'S')
    : (decimal >= 0 ? 'E' : 'W');
  const abs = Math.abs(decimal);
  const deg = Math.floor(abs);
  const minFloat = (abs - deg) * 60;
  const min = Math.floor(minFloat);
  const sec = ((minFloat - min) * 60).toFixed(1);
  return `${deg}\u00B0${min.toString().padStart(2, '0')}'${sec.toString().padStart(4, '0')}"${hemisphere}`;
}

function formatAltitude(meters) {
  if (meters < 1000) {
    return `${Math.round(meters)}m`;
  }
  return `${(meters / 1000).toFixed(1)}km`;
}

// Test cases
const tests = [
  // DMS tests
  { fn: () => toDMS(-33.8688, true), expected: 'contains S', check: r => r.includes('S') },
  { fn: () => toDMS(-33.8688, true), expected: 'starts with 33', check: r => r.startsWith('33') },
  { fn: () => toDMS(151.2093, false), expected: 'contains E', check: r => r.includes('E') },
  { fn: () => toDMS(151.2093, false), expected: 'starts with 151', check: r => r.startsWith('151') },
  { fn: () => toDMS(40.7128, true), expected: 'contains N', check: r => r.includes('N') },
  { fn: () => toDMS(-73.9352, false), expected: 'contains W', check: r => r.includes('W') },
  { fn: () => toDMS(0.0, true), expected: 'contains N', check: r => r.includes('N') },
  { fn: () => toDMS(0.0, false), expected: 'contains E', check: r => r.includes('E') },

  // Altitude tests
  { fn: () => formatAltitude(500), expected: '500m', check: r => r === '500m' },
  { fn: () => formatAltitude(999), expected: '999m', check: r => r === '999m' },
  { fn: () => formatAltitude(1000), expected: '1.0km', check: r => r === '1.0km' },
  { fn: () => formatAltitude(20000000), expected: '20000.0km', check: r => r === '20000.0km' },
  { fn: () => formatAltitude(1500), expected: '1.5km', check: r => r === '1.5km' },
];

let pass = 0;
for (const t of tests) {
  const result = t.fn();
  const ok = t.check(result);
  console.log(ok ? 'PASS' : 'FAIL', `${result} (expected: ${t.expected})`);
  if (ok) pass++;
}
console.log(`\n${pass}/${tests.length} tests passed`);
