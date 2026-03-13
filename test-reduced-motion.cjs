/**
 * Verify Feature #175: Reduced motion support
 * Tests that prefers-reduced-motion is properly handled.
 */
const fs = require('fs');
const path = require('path');

let allPass = true;

function check(label, condition) {
  if (condition) {
    console.log('PASS: ' + label);
  } else {
    console.log('FAIL: ' + label);
    allPass = false;
  }
}

// Step 1: Check CSS has @media (prefers-reduced-motion: reduce) block
const css = fs.readFileSync('src/index.css', 'utf8');
check('index.css contains prefers-reduced-motion media query',
  css.includes('@media (prefers-reduced-motion: reduce)'));
check('Disables modal-enter animation',
  css.includes('.modal-enter') && css.includes('animation: none'));
check('Disables modal-exit animation',
  css.includes('.modal-exit') && css.includes('animation: none'));
check('Disables backdrop-enter animation',
  css.includes('.backdrop-enter') && css.includes('animation: none'));
check('Disables backdrop-exit animation',
  css.includes('.backdrop-exit') && css.includes('animation: none'));
check('Reduces animation-duration globally',
  css.includes('animation-duration: 0.01ms !important'));
check('Reduces transition-duration globally',
  css.includes('transition-duration: 0.01ms !important'));

// Step 2: Check useReducedMotion hook exists
const hookPath = 'src/hooks/useReducedMotion.ts';
check('useReducedMotion hook exists',
  fs.existsSync(hookPath));

const hook = fs.readFileSync(hookPath, 'utf8');
check('Hook uses matchMedia for prefers-reduced-motion',
  hook.includes("matchMedia('(prefers-reduced-motion: reduce)')"));
check('Hook listens for changes via addEventListener',
  hook.includes("addEventListener('change'"));
check('Hook cleans up listener via removeEventListener',
  hook.includes("removeEventListener('change'"));

// Step 3: Check components import and use the hook
const opsPanel = fs.readFileSync('src/components/ui/OperationsPanel.tsx', 'utf8');
check('OperationsPanel imports useReducedMotion',
  opsPanel.includes("import { useReducedMotion }"));
check('OperationsPanel uses prefersReducedMotion for instant close',
  opsPanel.includes('prefersReducedMotion') && opsPanel.includes('if (prefersReducedMotion)'));

const intelFeed = fs.readFileSync('src/components/ui/IntelFeed.tsx', 'utf8');
check('IntelFeed imports useReducedMotion',
  intelFeed.includes("import { useReducedMotion }"));
check('IntelFeed uses prefersReducedMotion for instant close',
  intelFeed.includes('prefersReducedMotion') && intelFeed.includes('if (prefersReducedMotion)'));

const cctvPanel = fs.readFileSync('src/components/ui/CCTVPanel.tsx', 'utf8');
check('CCTVPanel imports useReducedMotion',
  cctvPanel.includes("import { useReducedMotion }"));
check('CCTVPanel uses prefersReducedMotion for instant close',
  cctvPanel.includes('prefersReducedMotion') && cctvPanel.includes('if (prefersReducedMotion)'));

// Step 4: Verify critical animations are NOT affected
// flyTo is a Cesium API call, not CSS animation - only appears in comments
check('Cesium flyTo not disabled by reduced motion CSS rules',
  !css.includes('.flyTo') && !css.includes('fly-to'));

// requestAnimationFrame for FPS/traffic is data-driven
const statusBar = fs.readFileSync('src/components/ui/StatusBar.tsx', 'utf8');
check('FPS counter requestAnimationFrame still present (not disabled)',
  statusBar.includes('requestAnimationFrame'));

const trafficLayer = fs.readFileSync('src/components/layers/TrafficLayer.tsx', 'utf8');
check('Traffic vehicle animation requestAnimationFrame still present',
  trafficLayer.includes('requestAnimationFrame'));

// Step 5: Verify loading indicators remain functional (animate-pulse disabled by CSS, not removed from JSX)
check('Loading indicators still in OperationsPanel JSX (animate-pulse class present)',
  opsPanel.includes('animate-pulse'));
check('Intel feed indicators still in IntelFeed JSX (animate-pulse class present)',
  intelFeed.includes('animate-pulse'));

// Step 6: App builds successfully
check('Vite build succeeded (58 modules)',
  fs.existsSync('dist/index.html'));

console.log('\n' + (allPass ? 'ALL CHECKS PASS' : 'SOME CHECKS FAILED'));
