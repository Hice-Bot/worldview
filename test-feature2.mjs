// Feature 2: Vite frontend builds and loads - Server-side verification
// Tests that Vite dev server is running, serving React app, and HMR is active

async function testFeature2() {
  let allPassed = true;

  // Test 1: Vite dev server responds on port 5173
  console.log('TEST 1: Vite dev server responds on port 5173');
  const res = await fetch('http://localhost:5173/');
  console.log('  Status:', res.status);
  if (res.status !== 200) { console.log('  FAIL'); allPassed = false; }
  else console.log('  PASS');

  // Test 2: HTML contains root React mount point
  const html = await res.text();
  console.log('\nTEST 2: HTML contains root React mount point');
  const hasRoot = html.includes('<div id="root">');
  console.log('  Has #root div:', hasRoot);
  if (!hasRoot) { console.log('  FAIL'); allPassed = false; }
  else console.log('  PASS');

  // Test 3: HTML loads React app entry (main.tsx)
  console.log('\nTEST 3: HTML loads React app entry module');
  const hasMainTsx = html.includes('src/main.tsx');
  console.log('  Has main.tsx entry:', hasMainTsx);
  if (!hasMainTsx) { console.log('  FAIL'); allPassed = false; }
  else console.log('  PASS');

  // Test 4: Vite HMR client script is injected
  console.log('\nTEST 4: Vite HMR client script is injected');
  const hasHMR = html.includes('/@vite/client');
  console.log('  Has @vite/client:', hasHMR);
  if (!hasHMR) { console.log('  FAIL'); allPassed = false; }
  else console.log('  PASS');

  // Test 5: Vite HMR client endpoint is accessible
  console.log('\nTEST 5: Vite HMR client endpoint responds');
  const hmrRes = await fetch('http://localhost:5173/@vite/client');
  console.log('  Status:', hmrRes.status);
  if (hmrRes.status !== 200) { console.log('  FAIL'); allPassed = false; }
  else console.log('  PASS');

  // Test 6: React Refresh is configured (for HMR)
  console.log('\nTEST 6: React Refresh (HMR) is configured');
  const hasReactRefresh = html.includes('@react-refresh') || html.includes('react-refresh');
  console.log('  Has React Refresh:', hasReactRefresh);
  if (!hasReactRefresh) { console.log('  FAIL'); allPassed = false; }
  else console.log('  PASS');

  // Test 7: main.tsx module can be fetched (React app compiles)
  console.log('\nTEST 7: main.tsx module can be fetched (React app compiles)');
  const mainRes = await fetch('http://localhost:5173/src/main.tsx');
  console.log('  Status:', mainRes.status);
  const mainContent = await mainRes.text();
  const hasReactDOM = mainContent.includes('createRoot') || mainContent.includes('ReactDOM');
  console.log('  Contains React createRoot/ReactDOM:', hasReactDOM);
  if (mainRes.status !== 200 || !hasReactDOM) { console.log('  FAIL'); allPassed = false; }
  else console.log('  PASS');

  // Test 8: App.tsx module can be fetched (main component compiles)
  console.log('\nTEST 8: App.tsx module can be fetched');
  const appRes = await fetch('http://localhost:5173/src/App.tsx');
  console.log('  Status:', appRes.status);
  if (appRes.status !== 200) { console.log('  FAIL'); allPassed = false; }
  else console.log('  PASS');

  console.log('\n=============================');
  if (allPassed) {
    console.log('ALL TESTS PASSED');
  } else {
    console.log('SOME TESTS FAILED');
    process.exit(1);
  }
}

testFeature2();
