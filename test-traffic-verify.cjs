const http = require('http');

const url = 'http://localhost:3001/api/traffic/roads?south=-33.88&west=151.19&north=-33.86&east=151.22';

http.get(url, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    const data = JSON.parse(body);

    // 1. HTTP 200 check
    console.log('HTTP Status:', res.statusCode);

    // 2. Total segments
    console.log('Total segments:', data.length);
    console.log('At least 50 segments:', data.length >= 50);

    // 3. Classifications
    const classes = {};
    data.forEach(s => { classes[s.classification] = (classes[s.classification] || 0) + 1; });
    console.log('Classifications:', JSON.stringify(classes));

    // 4. All have geometry arrays
    const allHaveGeom = data.every(s => s.geometry && Array.isArray(s.geometry) && s.geometry.length >= 2);
    console.log('All have geometry arrays:', allHaveGeom);

    // 5. All have classification
    const allHaveClass = data.every(s => !!s.classification);
    console.log('All have classification:', allHaveClass);

    // 6. Length range (realistic meters)
    let minLen = Infinity, maxLen = 0;
    data.forEach(s => {
      if (s.length < minLen) minLen = s.length;
      if (s.length > maxLen) maxLen = s.length;
    });
    console.log('Length range:', minLen.toFixed(1), 'to', maxLen.toFixed(1), 'meters');
    console.log('Lengths realistic:', minLen > 0 && maxLen < 50000);

    // 7. Valid OSM highway types
    const osmTypes = ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'residential', 'unclassified', 'service', 'motorway_link', 'trunk_link', 'primary_link', 'secondary_link', 'tertiary_link'];
    const allValidTypes = data.every(s => osmTypes.includes(s.classification));
    console.log('All valid OSM highway types:', allValidTypes);
    if (!allValidTypes) {
      const invalid = [...new Set(data.filter(s => !osmTypes.includes(s.classification)).map(s => s.classification))];
      console.log('Invalid types found:', invalid);
    }

    // 8. Coordinates trace real Sydney streets
    const lats = [], lons = [];
    data.forEach(s => {
      s.geometry.forEach(coord => {
        lons.push(coord[0]);
        lats.push(coord[1]);
      });
    });
    const avgLat = lats.reduce((a,b) => a+b, 0) / lats.length;
    const avgLon = lons.reduce((a,b) => a+b, 0) / lons.length;
    console.log('Avg coordinates:', avgLat.toFixed(4), avgLon.toFixed(4));
    console.log('In Sydney area:', avgLat > -34 && avgLat < -33.5 && avgLon > 151 && avgLon < 151.5);

    // 9. Sample road names
    const namedRoads = data.filter(s => s.name).slice(0, 10).map(r => r.name);
    console.log('Sample road names:', namedRoads.join(', '));

    // 10. Check segment structure
    const sample = data[0];
    console.log('Sample segment keys:', Object.keys(sample).join(', '));
    console.log('Sample segment:', JSON.stringify(sample).substring(0, 200));
  });
}).on('error', err => {
  console.error('Request failed:', err.message);
});
