const fs = require('fs');
const data = JSON.parse(fs.readFileSync('/tmp/ships_response.json', 'utf8'));

console.log('Total ships:', data.length);
console.log('Is array:', Array.isArray(data));

// Check first 3 ships
for (let i = 0; i < 3 && i < data.length; i++) {
  console.log('---');
  console.log('Ship', i, JSON.stringify(data[i]).substring(0, 300));
}

// Check field coverage
const fields = ['mmsi', 'name', 'imo', 'callSign', 'lat', 'lon', 'sog', 'cog', 'heading', 'destination', 'shipType', 'draught', 'eta'];
fields.forEach(f => {
  const count = data.filter(s => s[f] !== undefined && s[f] !== null && s[f] !== '' && s[f] !== 0).length;
  console.log(f + ':', count, '/', data.length, '(' + (100*count/data.length).toFixed(1) + '%)');
});

// Ship type distribution
const types = {};
data.forEach(s => {
  const category = Math.floor(s.shipType / 10) * 10;
  types[category] = (types[category] || 0) + 1;
});
console.log('Ship type groups:', JSON.stringify(types));

// Check coordinate ranges
const latRange = [Math.min(...data.map(s => s.lat)), Math.max(...data.map(s => s.lat))];
const lonRange = [Math.min(...data.map(s => s.lon)), Math.max(...data.map(s => s.lon))];
console.log('Lat range:', latRange[0].toFixed(2), 'to', latRange[1].toFixed(2));
console.log('Lon range:', lonRange[0].toFixed(2), 'to', lonRange[1].toFixed(2));

// SOG distribution
const sogBuckets = { 'stopped': 0, 'slow(<5)': 0, 'medium(5-15)': 0, 'fast(>15)': 0 };
data.forEach(s => {
  if (s.sog <= 0.5) sogBuckets['stopped']++;
  else if (s.sog < 5) sogBuckets['slow(<5)']++;
  else if (s.sog <= 15) sogBuckets['medium(5-15)']++;
  else sogBuckets['fast(>15)']++;
});
console.log('SOG distribution:', JSON.stringify(sogBuckets));

// Check for named ships
const named = data.filter(s => s.name && s.name.length > 1);
console.log('Named ships:', named.length, '/', data.length);
console.log('Sample names:', named.slice(0, 10).map(s => s.name).join(', '));
