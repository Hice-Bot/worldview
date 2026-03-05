const fs = require('fs');
const data = JSON.parse(fs.readFileSync('/tmp/earthquakes.json', 'utf8'));
const features = data.features || [];
const results = {
  type: data.type,
  count: features.length,
  isFeatureCollection: data.type === 'FeatureCollection',
  countGte5: features.length >= 5
};

if (features.length > 0) {
  const f = features[0];
  results.firstFeature = {
    geomType: f.geometry && f.geometry.type,
    coordinates: f.geometry && f.geometry.coordinates,
    mag: f.properties && f.properties.mag,
    place: f.properties && f.properties.place,
    time: f.properties && f.properties.time
  };

  let validCoords = true;
  let allHavePlace = true;
  let allHaveTime = true;
  const mags = [];

  for (const feat of features) {
    const p = feat.properties || {};
    const c = (feat.geometry && feat.geometry.coordinates) || [];
    if (p.mag != null) mags.push(p.mag);
    if (c.length >= 2) {
      if (c[0] < -180 || c[0] > 180 || c[1] < -90 || c[1] > 90) validCoords = false;
    }
    if (!p.place) allHavePlace = false;
    if (!p.time) allHaveTime = false;
  }

  results.allCoordsValid = validCoords;
  results.allHavePlace = allHavePlace;
  results.allHaveTime = allHaveTime;
  results.minMag = Math.min(...mags);
  results.maxMag = Math.max(...mags);
  results.allMagsGte2_5 = mags.every(function(m) { return m >= 2.5; });
  results.magCount = mags.length;
}

// Print results line by line
Object.keys(results).forEach(function(key) {
  const val = results[key];
  if (typeof val === 'object' && val !== null) {
    Object.keys(val).forEach(function(k) {
      process.stdout.write('  ' + k + ': ' + JSON.stringify(val[k]) + '\n');
    });
  } else {
    process.stdout.write(key + ': ' + JSON.stringify(val) + '\n');
  }
});
