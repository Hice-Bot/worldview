const fs = require('fs');
const data = JSON.parse(fs.readFileSync('/tmp/satellites.json', 'utf8'));

if (!Array.isArray(data)) {
  process.stdout.write('ERROR: Response is not an array, got: ' + typeof data + '\n');
  process.stdout.write('First 500 chars: ' + JSON.stringify(data).substring(0, 500) + '\n');
  process.exit(1);
}

process.stdout.write('Total satellites: ' + data.length + '\n');

// Check structure
if (data.length > 0) {
  const first = data[0];
  process.stdout.write('First satellite: ' + first.name + '\n');
  process.stdout.write('  noradId: ' + first.noradId + '\n');
  process.stdout.write('  category: ' + first.category + '\n');
  process.stdout.write('  tle1 starts: ' + (first.tle1 || '').substring(0, 30) + '\n');
  process.stdout.write('  tle2 starts: ' + (first.tle2 || '').substring(0, 30) + '\n');

  // Count by category
  const cats = {};
  data.forEach(function(s) {
    cats[s.category] = (cats[s.category] || 0) + 1;
  });
  process.stdout.write('Categories: ' + JSON.stringify(cats) + '\n');

  // Check for ISS
  const iss = data.find(function(s) { return s.name.includes('ISS') || s.noradId === 25544; });
  process.stdout.write('ISS found: ' + (iss ? iss.name + ' (NORAD ' + iss.noradId + ')' : 'NO') + '\n');

  // Validate all have required fields
  let valid = true;
  data.forEach(function(s) {
    if (!s.name || !s.tle1 || !s.tle2 || !s.noradId) valid = false;
  });
  process.stdout.write('All have required fields: ' + valid + '\n');
}
