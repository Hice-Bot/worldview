const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Check common locations for playwright-cli
const locations = [
  '/usr/local/bin/playwright-cli',
  '/usr/bin/playwright-cli',
  '/home/jef/.local/bin/playwright-cli',
  '/home/jef/.npm-global/bin/playwright-cli',
  path.join(process.cwd(), 'node_modules/.bin/playwright-cli'),
  path.join(process.cwd(), 'node_modules/@anthropic-ai/playwright-cli/dist/cli.js'),
];

locations.forEach(loc => {
  const exists = fs.existsSync(loc);
  if (exists) console.log('FOUND: ' + loc);
});

// Also try which
try {
  const which = execSync('which playwright-cli 2>/dev/null || echo NOT_FOUND').toString().trim();
  console.log('which: ' + which);
} catch (e) {
  console.log('which failed');
}

// Check node_modules for playwright-cli packages
const nmDir = path.join(process.cwd(), 'node_modules');
try {
  const dirs = fs.readdirSync(nmDir).filter(d => d.includes('playwright'));
  console.log('\nPlaywright packages in node_modules:');
  dirs.forEach(d => console.log('  ' + d));
} catch (e) {
  console.log('Cannot read node_modules');
}

// Look for anthropic packages
try {
  const atDir = path.join(nmDir, '@anthropic-ai');
  if (fs.existsSync(atDir)) {
    const items = fs.readdirSync(atDir);
    console.log('\n@anthropic-ai packages:');
    items.forEach(d => console.log('  ' + d));
  }
} catch (e) {}

// Check for global npm packages
try {
  const globalDir = execSync('npm root -g 2>/dev/null').toString().trim();
  console.log('\nGlobal npm root: ' + globalDir);
  if (fs.existsSync(globalDir)) {
    const items = fs.readdirSync(globalDir).filter(d => d.includes('playwright'));
    console.log('Playwright globals:');
    items.forEach(d => console.log('  ' + d));
  }
} catch (e) {}
