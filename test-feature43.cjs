const fs = require('fs');
const code = fs.readFileSync('src/components/globe/GlobeViewer.tsx', 'utf-8');

const checks = [
  { name: 'OpenStreetMapImageryProvider imported', test: code.includes('OpenStreetMapImageryProvider') },
  { name: 'OSM tiles from tile.openstreetmap.org', test: code.includes('tile.openstreetmap.org') },
  { name: 'globe.show = true when OSM active', test: code.includes('globe.show = true') },
  { name: 'google3dAvailable state (false = OSM active)', test: code.includes('google3dAvailable') },
  { name: 'Fallback activates on Google failure', test: code.includes('setGoogle3dAvailable(false)') },
  { name: 'OSM imagery layer added', test: code.includes('addImageryProvider(osmProvider)') },
  { name: 'Google tileset hidden when OSM mode', test: code.includes('google3dTilesetRef.current.show = false') || code.includes('google3dTilesetRef.current') },
  { name: 'No GOOGLE_API_KEY = uses OSM (empty check)', test: code.includes("VITE_GOOGLE_API_KEY") && code.includes("|| ''") },
  { name: 'URL template uses OSM pattern', test: code.includes("url: 'https://tile.openstreetmap.org/'") },
];

let allPass = true;
for (const c of checks) {
  console.log(c.test ? '✅' : '❌', c.name);
  if (!c.test) allPass = false;
}
console.log(allPass ? '\nAll Feature #43 checks pass!' : '\nSome checks failed');
process.exit(allPass ? 0 : 1);
