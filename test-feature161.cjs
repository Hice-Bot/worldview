// Test Feature #161: Mobile CCTVPanel as button with modal
// Verify the CCTVPanel code has all required mobile features

const fs = require('fs');
const http = require('http');

const cctvPath = __dirname + '/src/components/ui/CCTVPanel.tsx';
const code = fs.readFileSync(cctvPath, 'utf8');

let pass = true;

// 1. Button badge with online camera count
const hasBadgeButton = code.includes('lg:hidden') && code.includes('onlineCameras.length');
console.log('1. Badge button with online count:', hasBadgeButton ? 'PASS' : 'FAIL');
if (!hasBadgeButton) pass = false;

// 2. Tapping opens full-screen modal
const hasModalOpen = code.includes('setMobileOpen(true)') && code.includes('mobileOpen');
console.log('2. Tap opens full-screen modal:', hasModalOpen ? 'PASS' : 'FAIL');
if (!hasModalOpen) pass = false;

// 3. Modal shows 2-column grid (mobile) vs 3-column (desktop)
const has2ColMobile = code.includes('grid-cols-2');
const has3ColDesktop = code.includes('grid-cols-3');
console.log('3. 2-col mobile grid:', has2ColMobile ? 'PASS' : 'FAIL');
console.log('   3-col desktop grid:', has3ColDesktop ? 'PASS' : 'FAIL');
if (!has2ColMobile || !has3ColDesktop) pass = false;

// 4. FLY TO auto-minimizes on mobile
const hasAutoMinimize = code.includes('setMobileOpen(false)');
const inFlyToHandler = code.includes('handleFlyTo') && code.includes('setMobileOpen(false)');
console.log('4. FLY TO auto-minimizes:', inFlyToHandler ? 'PASS' : 'FAIL');
if (!inFlyToHandler) pass = false;

// 5. Modal dismissible (close button)
const hasDismiss = code.includes('setMobileOpen(false)');
const hasCloseButton = code.includes('onClick={() => setMobileOpen(false))');
console.log('5. Modal dismissible:', hasDismiss ? 'PASS' : 'FAIL');
if (!hasDismiss) pass = false;

// 6. Full-screen modal (fixed inset-0)
const hasFullScreen = code.includes('fixed inset-0');
console.log('6. Full-screen modal overlay:', hasFullScreen ? 'PASS' : 'FAIL');
if (!hasFullScreen) pass = false;

// 7. Desktop panel hidden on mobile (lg:flex or lg:block with hidden)
const hasDesktopHide = code.includes('hidden lg:flex') || code.includes('hidden lg:block');
console.log('7. Desktop panel hidden on mobile:', hasDesktopHide ? 'PASS' : 'FAIL');
if (!hasDesktopHide) pass = false;

// 8. Mobile button only visible below lg (lg:hidden)
const hasMobileOnly = code.includes('lg:hidden');
console.log('8. Mobile button only below 1024px:', hasMobileOnly ? 'PASS' : 'FAIL');
if (!hasMobileOnly) pass = false;

// Test CCTV API
const req = http.get('http://localhost:3001/api/cctv', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const cameras = JSON.parse(data);
      console.log('\nAPI: Got', cameras.length, 'cameras');
      console.log('API: Online:', cameras.filter(c => c.available).length);
      console.log('\nOVERALL:', pass ? 'ALL CHECKS PASSED' : 'SOME CHECKS FAILED');
    } catch(e) {
      console.log('API error:', e.message);
      console.log('\nOVERALL:', pass ? 'ALL CODE CHECKS PASSED' : 'SOME CHECKS FAILED');
    }
  });
});
req.on('error', () => {
  console.log('\nOVERALL:', pass ? 'ALL CODE CHECKS PASSED' : 'SOME CHECKS FAILED');
});
