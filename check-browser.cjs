const fs = require('fs');
const path = require('path');

const cacheDir = '/home/jef/.cache/ms-playwright/';
try {
  const entries = fs.readdirSync(cacheDir);
  console.log('Playwright browsers installed:');
  entries.forEach(e => console.log('  ' + e));
} catch (e) {
  console.log('No playwright cache dir found');
}

const chromiumDirs = [
  '/home/jef/.cache/ms-playwright/chromium-1208',
  '/home/jef/.cache/ms-playwright/chromium_headless_shell-1208',
  '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
];

chromiumDirs.forEach(d => {
  const exists = fs.existsSync(d);
  console.log((exists ? 'EXISTS' : 'MISSING') + ': ' + d);
});
