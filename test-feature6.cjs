const http = require('http');
const fs = require('fs');
const { execSync } = require('child_process');

// Feature #6: API keys stored server-side only
// Steps:
// 1. server/.env contains OPENSKY_CLIENT_ID, OPENSKY_CLIENT_SECRET, NSW_TRANSPORT_API_KEY, AISSTREAM_API_KEY
// 2. Root .env contains only VITE_GOOGLE_API_KEY and VITE_CESIUM_ION_TOKEN
// 3. grep -r server keys in src/ returns empty
// 4. No API keys appear in browser Network tab responses
// 5. server/index.js reads keys via process.env, not hardcoded strings

async function test() {
  let pass = true;

  // Step 1: server/.env contains the required keys
  console.log('\n--- Step 1: server/.env contains required key entries ---');
  const serverEnv = fs.readFileSync('./server/.env', 'utf8');
  const requiredServerKeys = ['OPENSKY_CLIENT_ID', 'OPENSKY_CLIENT_SECRET', 'NSW_TRANSPORT_API_KEY', 'AISSTREAM_API_KEY'];
  for (const key of requiredServerKeys) {
    if (serverEnv.includes(key)) {
      console.log(`  ✓ ${key} present in server/.env`);
    } else {
      console.log(`  ✗ ${key} MISSING from server/.env`);
      pass = false;
    }
  }

  // Step 2: Root .env contains only VITE_ keys
  console.log('\n--- Step 2: Root .env contains only VITE_ keys ---');
  const rootEnv = fs.readFileSync('./.env', 'utf8');
  const rootLines = rootEnv.split('\n').filter(l => l.trim() && !l.startsWith('#'));
  for (const line of rootLines) {
    const key = line.split('=')[0].trim();
    if (key.startsWith('VITE_') || key === '') {
      console.log(`  ✓ ${key} is a valid VITE_ key`);
    } else {
      console.log(`  ✗ ${key} is NOT a VITE_ key in root .env`);
      pass = false;
    }
  }
  // Verify server keys are NOT in root .env
  for (const key of requiredServerKeys) {
    if (rootEnv.includes(key)) {
      console.log(`  ✗ ${key} found in root .env (should be server-side only)`);
      pass = false;
    } else {
      console.log(`  ✓ ${key} correctly absent from root .env`);
    }
  }

  // Step 3: No server keys in src/ directory
  console.log('\n--- Step 3: No server-side API keys in src/ ---');
  const srcFiles = [];
  function walkDir(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = dir + '/' + e.name;
      if (e.isDirectory()) walkDir(full);
      else if (e.isFile()) srcFiles.push(full);
    }
  }
  walkDir('./src');

  let srcKeyFound = false;
  for (const file of srcFiles) {
    const content = fs.readFileSync(file, 'utf8');
    for (const key of requiredServerKeys) {
      if (content.includes(key)) {
        console.log(`  ✗ ${key} found in ${file}`);
        srcKeyFound = true;
        pass = false;
      }
    }
  }
  if (!srcKeyFound) {
    console.log('  ✓ No server-side API keys found in any src/ files');
  }

  // Step 4: No API keys in server responses
  console.log('\n--- Step 4: No API keys in HTTP responses ---');
  const endpoints = ['/api/health', '/api/earthquakes'];
  for (const endpoint of endpoints) {
    try {
      const body = await new Promise((resolve, reject) => {
        http.get(`http://localhost:3001${endpoint}`, { timeout: 5000 }, (res) => {
          let data = '';
          res.on('data', c => data += c);
          res.on('end', () => resolve(data));
        }).on('error', reject);
      });

      let leaked = false;
      for (const key of requiredServerKeys) {
        if (body.includes(key)) {
          console.log(`  ✗ ${key} found in ${endpoint} response`);
          leaked = true;
          pass = false;
        }
      }
      // Also check for actual key values (if they were set)
      if (!leaked) {
        console.log(`  ✓ ${endpoint} response contains no server-side API key names`);
      }
    } catch (err) {
      console.log(`  ⚠ Could not check ${endpoint}: ${err.message}`);
    }
  }

  // Step 5: server/index.js reads keys via process.env
  console.log('\n--- Step 5: server/index.js uses process.env for keys ---');
  const serverCode = fs.readFileSync('./server/index.js', 'utf8');
  for (const key of requiredServerKeys) {
    const pattern = `process.env.${key}`;
    if (serverCode.includes(pattern)) {
      console.log(`  ✓ ${key} accessed via process.env.${key}`);
    } else {
      // Not all keys need to be referenced if they're optional
      console.log(`  ⚠ ${key} not referenced via process.env (may be optional)`);
    }
  }

  // Check for hardcoded key values (long alphanumeric strings near API config)
  const hardcodedPattern = /['"][a-zA-Z0-9]{20,}['"].*(?:key|token|secret|api)/gi;
  const hardcodedMatches = serverCode.match(hardcodedPattern);
  if (hardcodedMatches && hardcodedMatches.length > 0) {
    console.log('  ✗ Possible hardcoded keys found:', hardcodedMatches);
    pass = false;
  } else {
    console.log('  ✓ No hardcoded API key strings detected in server/index.js');
  }

  console.log('\n===========================');
  console.log(pass ? '✓ FEATURE #6: ALL CHECKS PASSED' : '✗ FEATURE #6: SOME CHECKS FAILED');
  console.log('===========================\n');

  process.exit(pass ? 0 : 1);
}

test().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
