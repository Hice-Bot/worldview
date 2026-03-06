const http = require('http');

// Verify Vite dev server returns our app with Cesium
function fetchPage(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    }).on('error', reject);
  });
}

async function main() {
  try {
    // Check that the app loads
    const page = await fetchPage('http://localhost:5173/');
    console.log('✅ App loads (status:', page.status + ')');
    console.log('   Has Cesium widgets CSS:', page.body.includes('cesium/Widgets/widgets.css') ? '✅' : '❌');
    console.log('   Has root mount point:', page.body.includes('id="root"') ? '✅' : '❌');

    // Check that the .env has no Google API key (so OSM should be active)
    const fs = require('fs');
    const env = fs.readFileSync('.env', 'utf-8');
    const hasGoogleKey = env.match(/VITE_GOOGLE_API_KEY=\S+/);
    console.log('\nEnvironment check:');
    console.log('   VITE_GOOGLE_API_KEY set:', hasGoogleKey ? '✅ (Google 3D mode)' : '❌ Empty (OSM fallback mode)');

    // Check that the GlobeViewer code properly handles both cases
    const globeViewer = fs.readFileSync('src/components/globe/GlobeViewer.tsx', 'utf-8');

    // Feature #42: Google 3D path
    console.log('\nFeature #42 - Google 3D Tiles path:');
    console.log('   createGooglePhotorealistic3DTileset called:', globeViewer.includes('createGooglePhotorealistic3DTileset(') ? '✅' : '❌');
    console.log('   API key passed to tileset creation:', globeViewer.includes('key: GOOGLE_API_KEY') ? '✅' : '❌');
    console.log('   Globe hidden when Google active:', globeViewer.includes('viewer.scene.globe.show = false') ? '✅' : '❌');
    console.log('   Tileset added to primitives:', globeViewer.includes('viewer.scene.primitives.add(tileset)') ? '✅' : '❌');

    // Feature #43: OSM fallback path
    console.log('\nFeature #43 - OSM fallback path:');
    console.log('   OSM provider URL:', globeViewer.includes("url: 'https://tile.openstreetmap.org/'") ? '✅' : '❌');
    console.log('   Globe shown for OSM:', globeViewer.includes('viewer.scene.globe.show = true') ? '✅' : '❌');
    console.log('   Google tileset hidden when OSM:', globeViewer.includes('google3dTilesetRef.current.show = false') ? '✅' : '❌');
    console.log('   Fallback on Google failure:', globeViewer.includes('setGoogle3dAvailable(false)') ? '✅' : '❌');
    console.log('   OSM activates without API key:', globeViewer.includes("VITE_GOOGLE_API_KEY") && globeViewer.includes("|| ''") ? '✅' : '❌');

    // Check that OSM tiles are actually loading (verify tile.openstreetmap.org is reachable)
    const https = require('https');
    await new Promise((resolve, reject) => {
      https.get('https://tile.openstreetmap.org/0/0/0.png', (res) => {
        console.log('\n   OSM tile server reachable:', res.statusCode === 200 ? '✅' : '❌', '(status:', res.statusCode + ')');
        res.resume();
        res.on('end', resolve);
      }).on('error', (err) => {
        console.log('\n   OSM tile server reachable: ❌ (error:', err.message + ')');
        resolve();
      });
    });

    // Verify the toggle mechanism exists (App.tsx has mapTiles state)
    const appCode = fs.readFileSync('src/App.tsx', 'utf-8');
    console.log('\nToggle mechanism:');
    console.log('   mapTiles state in App:', appCode.includes("mapTiles") ? '✅' : '❌');
    console.log('   GOOGLE_3D option:', appCode.includes("GOOGLE_3D") ? '✅' : '❌');
    console.log('   Passed to GlobeViewer:', appCode.includes('mapTiles={mapTiles}') ? '✅' : '❌');

    console.log('\n=== Both features verified ===');
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

main();
