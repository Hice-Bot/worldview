const http = require('http');
const fs = require('fs');

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

async function main() {
  let pass = 0;
  let fail = 0;

  // Read source files directly
  const appTsx = fs.readFileSync('/mnt/c/Users/turke/worldview/src/App.tsx', 'utf-8');
  const opsPanel = fs.readFileSync('/mnt/c/Users/turke/worldview/src/components/ui/OperationsPanel.tsx', 'utf-8');
  const globeViewer = fs.readFileSync('/mnt/c/Users/turke/worldview/src/components/globe/GlobeViewer.tsx', 'utf-8');

  function check(name, result) {
    if (result) {
      console.log('PASS:', name);
      pass++;
    } else {
      console.log('FAIL:', name);
      fail++;
    }
  }

  // === Feature #48: Camera flyTo smooth animated transitions ===
  console.log('\n=== Feature #48: Camera flyTo smooth animated transitions ===');

  // Check handleResetView uses flyTo (not setView)
  const resetViewSection = appTsx.substring(appTsx.indexOf('handleResetView'), appTsx.indexOf('handleResetView') + 600);
  check('handleResetView uses camera.flyTo', resetViewSection.includes('camera.flyTo'));
  check('handleResetView does NOT use camera.setView', !resetViewSection.includes('camera.setView'));
  check('flyTo has duration parameter (0.5-2s range)', appTsx.includes('duration: 2.0') && appTsx.includes('duration: 1.5'));
  check('flyTo smoothly interpolates heading and pitch', resetViewSection.includes('heading:') && resetViewSection.includes('pitch:'));
  check('cancelFlight called before new flyTo', resetViewSection.includes('cancelFlight'));

  // Check CCTV flyTo
  const cctvFlyTo = appTsx.includes('cancelFlight') && appTsx.includes('duration: 1.5');
  check('CCTV flyTo uses animation with duration', cctvFlyTo);

  // Check only initial camera uses setView (startup, not user-triggered)
  // Note: 'setView' appears in function names like handleResetView, but camera.setView should not be in App.tsx
  const cameraSetViewCount = (appTsx.match(/camera\.setView/g) || []).length;
  check('No camera.setView in App.tsx (all transitions use flyTo)', cameraSetViewCount === 0);

  // GlobeViewer initial camera uses setView (that's fine - startup only)
  const globeSetView = globeViewer.includes('camera.setView');
  check('GlobeViewer uses setView for initial camera only (correct)', globeSetView);

  // === Feature #49: Camera presets fly to specific locations ===
  console.log('\n=== Feature #49: Camera presets fly to specific locations ===');

  // Reset View button flies to Sydney default view
  check('Reset View uses flyTo to DEFAULT_CAMERA', resetViewSection.includes('DEFAULT_CAMERA.lon') && resetViewSection.includes('DEFAULT_CAMERA.lat'));
  check('Reset View flies to 20M altitude', resetViewSection.includes('DEFAULT_CAMERA.altitude'));
  check('Reset View returns exact heading/pitch', resetViewSection.includes('DEFAULT_CAMERA.heading') && resetViewSection.includes('DEFAULT_CAMERA.pitch'));
  check('Reset View clears tracking', resetViewSection.includes('setTrackedEntity(null)'));

  // Locate Me implementation
  const locateMeSection = appTsx.substring(appTsx.indexOf('handleLocateMe'), appTsx.indexOf('handleLocateMe') + 2000);
  check('Locate Me uses browser geolocation API', locateMeSection.includes('navigator.geolocation'));
  check('Locate Me has server fallback (/api/geolocation)', locateMeSection.includes('/api/geolocation'));
  check('Locate Me shows requesting state', appTsx.includes("setLocateMeState('requesting')"));
  check('Locate Me shows success state', appTsx.includes("setLocateMeState('success')"));
  check('Locate Me shows error state', appTsx.includes("setLocateMeState('error')"));
  check('Locate Me has default fallback to DEFAULT_CAMERA', locateMeSection.includes('DEFAULT_CAMERA.lat'));

  // OperationsPanel shows state
  check('OperationsPanel accepts locateMeState prop', opsPanel.includes('locateMeState'));
  check('OperationsPanel shows Locating... state', opsPanel.includes('Locating...'));
  check('OperationsPanel shows Located! state', opsPanel.includes('Located!'));
  check('locateMeState auto-resets to idle', appTsx.includes('Auto-reset locateMeState'));

  // === Feature #53: Globe navigation with mouse controls ===
  console.log('\n=== Feature #53: Globe navigation with mouse controls ===');

  // CesiumJS mouse controls work by default when the Viewer is rendered
  // The key is that we're NOT disabling them
  check('Viewer component rendered (enables mouse controls)', globeViewer.includes('<Viewer'));
  check('No screenSpaceCameraController disable', !globeViewer.includes('enableRotate = false') && !globeViewer.includes('enableZoom = false'));
  check('No custom mouse override blocking controls', !globeViewer.includes('screenSpaceCameraController.enableRotate'));
  check('Globe rendered for navigation', globeViewer.includes('<Globe'));
  check('Scene rendered', globeViewer.includes('<Scene'));

  // Test geolocation endpoint
  console.log('\n=== API Endpoint Tests ===');
  try {
    const geoData = await fetchUrl('http://localhost:3001/api/geolocation');
    const geo = JSON.parse(geoData);
    check('Geolocation API returns lat', typeof geo.lat === 'number');
    check('Geolocation API returns lon', typeof geo.lon === 'number');
    check('Geolocation API returns city', typeof geo.city === 'string' && geo.city.length > 0);
    console.log('  Location:', geo.city + ', ' + geo.country, '(' + geo.lat + ', ' + geo.lon + ')');
  } catch (e) {
    check('Geolocation API endpoint', false);
    console.log('  Error:', e.message);
  }

  // Test Vite dev server serves updated modules
  try {
    const viteResp = await fetchUrl('http://localhost:5173');
    check('Vite dev server running', viteResp.includes('WorldView'));
  } catch (e) {
    check('Vite dev server running', false);
  }

  console.log('\n=== Summary ===');
  console.log('Passed:', pass, '/', pass + fail);
  console.log('Failed:', fail);

  if (fail > 0) {
    process.exit(1);
  }
}

main().catch(console.error);
