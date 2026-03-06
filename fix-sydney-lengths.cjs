// Fix Sydney roads fallback data to include proper Haversine lengths
const fs = require('fs');

function haversineDistance(p1, p2) {
  const R = 6371000; // Earth radius in meters
  const toRad = (deg) => deg * Math.PI / 180;
  const dLat = toRad(p2[1] - p1[1]);
  const dLon = toRad(p2[0] - p1[0]);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(p1[1])) * Math.cos(toRad(p2[1])) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function calcRoadLength(geometry) {
  let total = 0;
  for (let i = 1; i < geometry.length; i++) {
    total += haversineDistance(geometry[i - 1], geometry[i]);
  }
  return Math.round(total * 100) / 100; // round to 2 decimals
}

// Read the file as text and extract the JSON array
const fileContent = fs.readFileSync('server/data/sydneyRoads.js', 'utf8');

// Extract the array from the export statement
const match = fileContent.match(/export const sydneyRoads = (\[[\s\S]*\]);?\s*$/);
if (!match) {
  console.error('Could not parse sydneyRoads.js');
  process.exit(1);
}

const roads = JSON.parse(match[1]);
let fixedCount = 0;

roads.forEach(road => {
  if (road.geometry && road.geometry.length >= 2) {
    const newLen = calcRoadLength(road.geometry);
    if (road.length === 0 || road.length === undefined) {
      fixedCount++;
    }
    road.length = newLen;
  }
});

// Write back
const output = `/**
 * Static Sydney CBD road data - ${roads.length} road segments
 * Exported from OpenStreetMap via Overpass API on 2026-03-05.
 * Used as fallback when Overpass API fails or times out.
 * Lengths calculated via Haversine formula.
 */
export const sydneyRoads = ${JSON.stringify(roads, null, 2)};
`;

fs.writeFileSync('server/data/sydneyRoads.js', output);
console.log('Fixed ' + fixedCount + ' roads with zero/missing length');
console.log('Total roads: ' + roads.length);
console.log('Sample lengths: ' + roads.slice(0, 5).map(r => r.length).join(', '));
console.log('All have positive length: ' + roads.every(r => r.length > 0));
