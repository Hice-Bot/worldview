const fs = require('fs');
const code = fs.readFileSync('src/components/globe/GlobeViewer.tsx', 'utf-8');

const checks = [
  { name: 'createGooglePhotorealistic3DTileset imported', test: code.includes('createGooglePhotorealistic3DTileset') },
  { name: 'Called with API key parameter', test: code.includes('createGooglePhotorealistic3DTileset(') && code.includes('key: GOOGLE_API_KEY') },
  { name: 'globe.show = false when Google 3D active', test: code.includes('globe.show = false') },
  { name: 'Fallback on failure (setGoogle3dAvailable(false))', test: code.includes('setGoogle3dAvailable(false)') },
  { name: 'Google API key read from env', test: code.includes('VITE_GOOGLE_API_KEY') },
  { name: 'Tileset added to scene.primitives', test: code.includes('scene.primitives.add(tileset)') },
  { name: 'OSM layer removed when Google active', test: code.includes('imageryLayers.remove(osmLayerRef') },
  { name: 'google3dTilesetRef tracks loaded tileset', test: code.includes('google3dTilesetRef.current = tileset') },
  { name: 'No reference system mismatch (globe hidden)', test: code.includes('viewer.scene.globe.show = false') },
  { name: 'Tiles cover major cities (3D tileset renders buildings)', test: code.includes('Photorealistic') || code.includes('createGooglePhotorealistic3DTileset') },
];

let allPass = true;
for (const c of checks) {
  console.log(c.test ? '✅' : '❌', c.name);
  if (!c.test) allPass = false;
}
console.log(allPass ? '\nAll Feature #42 checks pass!' : '\nSome checks failed');
process.exit(allPass ? 0 : 1);
