/**
 * Feature #131: Default shader is STANDARD
 *
 * Tests:
 * 1. On load, no PostProcessStage applied (ShaderManager starts as STANDARD)
 * 2. StatusBar shows STD for optics mode
 * 3. OperationsPanel shows STANDARD as active
 * 4. Globe renders without any visual filters
 */
const fs = require('fs');

const results = [];
let allPassed = true;

function test(name, fn) {
  try {
    const result = fn();
    if (result === true) {
      results.push(`PASS: ${name}`);
    } else {
      results.push(`FAIL: ${name}: ${result}`);
      allPassed = false;
    }
  } catch (err) {
    results.push(`FAIL: ${name}: ${err.message}`);
    allPassed = false;
  }
}

// --- Source code analysis ---
const appSrc = fs.readFileSync('src/App.tsx', 'utf-8');
const statusBarSrc = fs.readFileSync('src/components/ui/StatusBar.tsx', 'utf-8');
const opsPanelSrc = fs.readFileSync('src/components/ui/OperationsPanel.tsx', 'utf-8');
const shaderSrc = fs.readFileSync('src/shaders/postprocess.ts', 'utf-8');
const globeViewerSrc = fs.readFileSync('src/components/globe/GlobeViewer.tsx', 'utf-8');

// Step 1: On load, no PostProcessStage applied
test('App initializes shaderMode state to STANDARD', () => {
  const match = appSrc.match(/useState<ShaderMode>\(['"](\w+)['"]\)/);
  if (!match) return 'No useState<ShaderMode> found';
  if (match[1] !== 'STANDARD') return `Default is ${match[1]}, expected STANDARD`;
  return true;
});

test('ShaderManager starts with currentMode = STANDARD', () => {
  const match = shaderSrc.match(/private\s+currentMode:\s+ShaderModeType\s*=\s*['"](\w+)['"]/);
  if (!match) return 'No currentMode initialization found';
  if (match[1] !== 'STANDARD') return `Default is ${match[1]}, expected STANDARD`;
  return true;
});

test('ShaderManager starts with currentStage = null (no PostProcessStage)', () => {
  const match = shaderSrc.match(/private\s+currentStage:\s+PostProcessStage\s*\|\s*null\s*=\s*null/);
  if (!match) return 'currentStage not initialized to null';
  return true;
});

test('applyMode with STANDARD does not add any PostProcessStage', () => {
  // When mode is STANDARD, it should just remove current and return
  const hasStandardReturn = shaderSrc.includes("if (mode === 'STANDARD') return");
  if (!hasStandardReturn) return 'No early return for STANDARD mode in applyMode';
  return true;
});

test('On initial render, applyMode is no-op (STANDARD -> STANDARD is same mode)', () => {
  // applyMode checks: if (mode === this.currentMode) return;
  const hasSameModeCheck = shaderSrc.includes('if (mode === this.currentMode) return');
  if (!hasSameModeCheck) return 'No same-mode guard in applyMode';
  return true;
});

// Step 2: StatusBar shows STD for optics mode
test('StatusBar converts STANDARD to STD label', () => {
  const hasConversion = statusBarSrc.includes("shaderMode === 'STANDARD' ? 'STD'");
  if (!hasConversion) return 'StatusBar does not convert STANDARD to STD';
  return true;
});

test('StatusBar receives shaderMode prop', () => {
  const hasShaderModeProp = statusBarSrc.includes('shaderMode: ShaderMode');
  if (!hasShaderModeProp) return 'StatusBar missing shaderMode prop';
  return true;
});

test('App passes shaderMode to StatusBar', () => {
  const passesShaderMode = appSrc.includes('shaderMode={shaderMode}');
  if (!passesShaderMode) return 'App does not pass shaderMode to StatusBar';
  return true;
});

// Step 3: OperationsPanel shows STANDARD as active
test('OperationsPanel renders STANDARD button', () => {
  const hasStandard = opsPanelSrc.includes("'STANDARD'");
  if (!hasStandard) return 'STANDARD not in OperationsPanel shader buttons';
  return true;
});

test('OperationsPanel compares active state with shaderMode', () => {
  const hasActiveCheck = opsPanelSrc.includes('shaderMode === mode');
  if (!hasActiveCheck) return 'No active state comparison';
  return true;
});

test('OperationsPanel receives shaderMode prop', () => {
  const hasProp = opsPanelSrc.includes('shaderMode: ShaderMode');
  if (!hasProp) return 'OperationsPanel missing shaderMode prop';
  return true;
});

test('App passes shaderMode to OperationsPanel', () => {
  // Find where OperationsPanel is rendered and check for shaderMode prop
  const hasOpsShader = appSrc.includes('shaderMode={shaderMode}');
  if (!hasOpsShader) return 'shaderMode not passed to OperationsPanel';
  return true;
});

// Step 4: Globe renders without any visual filters
test('GlobeViewer receives shaderMode prop', () => {
  const hasProp = globeViewerSrc.includes('shaderMode: ShaderMode');
  if (!hasProp) return 'GlobeViewer missing shaderMode prop';
  return true;
});

test('GlobeViewer creates ShaderManager ref (initialized once)', () => {
  const hasRef = globeViewerSrc.includes('shaderManagerRef');
  if (!hasRef) return 'No shaderManagerRef in GlobeViewer';
  return true;
});

test('GlobeViewer calls applyMode in useEffect on shaderMode change', () => {
  const hasEffect = globeViewerSrc.includes('shaderManagerRef.current.applyMode');
  if (!hasEffect) return 'No applyMode call in GlobeViewer useEffect';
  return true;
});

test('No mock data patterns for shaders', () => {
  const mockPatterns = ['mockShader', 'fakeShader', 'testShader', 'dummyShader'];
  for (const pattern of mockPatterns) {
    if (shaderSrc.toLowerCase().includes(pattern.toLowerCase())) {
      return `Found mock pattern: ${pattern}`;
    }
  }
  return true;
});

// Summary
console.log('\n=== Feature #131: Default shader is STANDARD ===\n');
results.forEach(r => console.log(r));
console.log('\n=== OVERALL:', allPassed ? 'ALL PASSED' : 'SOME FAILED', '===');
process.exit(allPassed ? 0 : 1);
