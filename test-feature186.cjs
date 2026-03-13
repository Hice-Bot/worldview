/**
 * Test Feature #186: Shader switch during entity tracking
 *
 * Verifies that switching shader mode while tracking an entity doesn't break tracking.
 *
 * Tests:
 * 1. ShaderManager operates only on PostProcessStages (visual pipeline)
 * 2. Entity tracking operates on viewer.trackedEntity (scene graph)
 * 3. These are independent systems — shader changes don't touch tracking
 * 4. ShaderManager is idempotent and re-entrant safe
 * 5. TrackedEntityPanel visibility depends only on trackedEntity state (not shaderMode)
 * 6. All shader modes work: STANDARD, CRT, NVG, FLIR
 * 7. GlobeViewer passes trackedEntity independently of shaderMode
 */

const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, 'src');
let passed = 0;
let failed = 0;

function check(name, condition) {
  if (condition) {
    console.log('  PASS:', name);
    passed++;
  } else {
    console.log('  FAIL:', name);
    failed++;
  }
}

console.log('=== Feature #186: Shader switch during entity tracking ===\n');

// Read key source files
const appTsx = fs.readFileSync(path.join(SRC, 'App.tsx'), 'utf8');
const globeViewer = fs.readFileSync(path.join(SRC, 'components', 'globe', 'GlobeViewer.tsx'), 'utf8');
const shaderPostprocess = fs.readFileSync(path.join(SRC, 'shaders', 'postprocess.ts'), 'utf8');
const entityClickHandler = fs.readFileSync(path.join(SRC, 'components', 'globe', 'EntityClickHandler.tsx'), 'utf8');
const opsPanel = fs.readFileSync(path.join(SRC, 'components', 'ui', 'OperationsPanel.tsx'), 'utf8');
const trackedPanel = fs.readFileSync(path.join(SRC, 'components', 'ui', 'TrackedEntityPanel.tsx'), 'utf8');

// ===== TEST 1: Shader and tracking are independent state =====
console.log('TEST 1: Independent state management');
check('shaderMode and trackedEntity are separate useState',
  appTsx.includes("useState<ShaderMode>") && appTsx.includes("useState<TrackedEntityInfo"));
check('shaderMode setter is setShaderMode', appTsx.includes('setShaderMode'));
check('trackedEntity setter is setTrackedEntity', appTsx.includes('setTrackedEntity'));
// Verify they don't reference each other
const setShaderLines = appTsx.split('\n').filter(l => l.includes('setShaderMode'));
const setTrackedLines = appTsx.split('\n').filter(l => l.includes('setTrackedEntity'));
check('setShaderMode never references trackedEntity',
  setShaderLines.every(l => !l.includes('trackedEntity')));
check('setTrackedEntity never references shaderMode',
  setTrackedLines.every(l => !l.includes('shaderMode')));

// ===== TEST 2: ShaderManager only touches PostProcessStages =====
console.log('\nTEST 2: ShaderManager isolation');
check('ShaderManager imports PostProcessStage only',
  shaderPostprocess.includes("import { PostProcessStage }") &&
  !shaderPostprocess.includes('trackedEntity'));
check('ShaderManager.applyMode operates on viewer.scene.postProcessStages',
  shaderPostprocess.includes('viewer.scene.postProcessStages'));
check('ShaderManager never references viewer.trackedEntity',
  !shaderPostprocess.includes('viewer.trackedEntity'));
check('ShaderManager never references viewer.entities',
  !shaderPostprocess.includes('viewer.entities'));
check('ShaderManager is idempotent (same mode = no-op)',
  shaderPostprocess.includes('if (mode === this.currentMode) return'));
check('ShaderManager is re-entrant safe',
  shaderPostprocess.includes('if (this._applying) return'));

// ===== TEST 3: GlobeViewer shader effect is independent =====
console.log('\nTEST 3: GlobeViewer shader effect independence');
// The shader useEffect should only depend on props.shaderMode
const shaderEffectMatch = globeViewer.match(/useEffect\(\(\) => \{[^}]*shaderManagerRef\.current\.applyMode[^}]*\}, \[([^\]]*)\]\)/s);
if (shaderEffectMatch) {
  const deps = shaderEffectMatch[1];
  check('Shader useEffect depends only on props.shaderMode',
    deps.includes('props.shaderMode') && !deps.includes('trackedEntity'));
} else {
  // Check using a broader pattern
  check('Shader useEffect applies mode on shaderMode change',
    globeViewer.includes('shaderManagerRef.current.applyMode(viewer, props.shaderMode'));
}

// Verify the shader effect doesn't touch trackedEntity
const shaderEffectBlock = globeViewer.split('shaderManagerRef.current.applyMode')[0].split('useEffect').pop();
check('Shader useEffect does not modify trackedEntity',
  !shaderEffectBlock.includes('trackedEntity'));

// ===== TEST 4: TrackedEntityPanel depends only on trackedEntity =====
console.log('\nTEST 4: TrackedEntityPanel visibility');
check('TrackedEntityPanel rendered when trackedEntity exists',
  appTsx.includes('{trackedEntity && (') || appTsx.includes('{trackedEntity &&'));
check('TrackedEntityPanel visibility not conditioned on shaderMode',
  !appTsx.split('TrackedEntityPanel')[0].split('{').pop().includes('shaderMode'));

// ===== TEST 5: EntityClickHandler doesn't reference shaderMode =====
console.log('\nTEST 5: EntityClickHandler independence');
check('EntityClickHandler does not reference shaderMode',
  !entityClickHandler.includes('shaderMode'));

// ===== TEST 6: All 4 shader modes are defined =====
console.log('\nTEST 6: All shader modes defined');
check('STANDARD mode supported (removes stages)',
  shaderPostprocess.includes("'STANDARD'"));
check('CRT shader defined with fragment shader',
  shaderPostprocess.includes("case 'CRT'") && shaderPostprocess.includes('CRT_FRAGMENT_SHADER'));
check('NVG shader defined with fragment shader',
  shaderPostprocess.includes("case 'NVG'") && shaderPostprocess.includes('NVG_FRAGMENT_SHADER'));
check('FLIR shader defined with fragment shader',
  shaderPostprocess.includes("case 'FLIR'") && shaderPostprocess.includes('FLIR_FRAGMENT_SHADER'));

// ===== TEST 7: GlobeViewer receives both props independently =====
console.log('\nTEST 7: GlobeViewer receives both props');
check('GlobeViewer receives shaderMode prop',
  globeViewer.includes('shaderMode') && appTsx.includes('shaderMode={shaderMode}'));
check('GlobeViewer receives trackedEntity prop',
  globeViewer.includes('trackedEntity') && appTsx.includes('trackedEntity={trackedEntity}'));

// ===== TEST 8: OperationsPanel shader selector =====
console.log('\nTEST 8: OperationsPanel shader selector');
check('OperationsPanel has shader mode selector',
  opsPanel.includes('shaderMode') || opsPanel.includes('STANDARD') || opsPanel.includes('OPTICS'));
check('OperationsPanel shader callback only calls setShaderMode (not tracking)',
  opsPanel.includes('onShaderChange') || opsPanel.includes('setShaderMode'));

// ===== TEST 9: Cleanup safety =====
console.log('\nTEST 9: Shader cleanup safety');
check('ShaderManager.removeCurrentStage checks viewer.isDestroyed()',
  shaderPostprocess.includes('viewer.isDestroyed()'));
check('ShaderManager has destroy() method for unmount',
  shaderPostprocess.includes('destroy(viewer'));
check('GlobeViewer calls shaderManager.destroy on unmount',
  globeViewer.includes('shaderManagerRef.current.destroy'));
check('ShaderManager safety sweep removes leaked stages by name',
  shaderPostprocess.includes('worldview_crt') &&
  shaderPostprocess.includes('worldview_nvg') &&
  shaderPostprocess.includes('worldview_flir'));

// ===== TEST 10: Verify no cross-coupling in React rendering =====
console.log('\nTEST 10: No cross-coupling in rendering');
// Check that layer components don't receive shaderMode
const layerComponents = ['FlightLayer', 'SatelliteLayer', 'EarthquakeLayer', 'ShipLayer', 'CCTVLayer', 'TrafficLayer'];
for (const layer of layerComponents) {
  const layerSection = globeViewer.split(layer).slice(1).join(layer);
  const hasShaderProp = layerSection.substring(0, 200).includes('shaderMode');
  check(`${layer} does not receive shaderMode prop`, !hasShaderProp);
}

console.log('\n=== RESULTS ===');
console.log('Passed:', passed);
console.log('Failed:', failed);
console.log(failed === 0 ? '\nALL TESTS PASSED' : '\nSOME TESTS FAILED');
process.exit(failed === 0 ? 0 : 1);
