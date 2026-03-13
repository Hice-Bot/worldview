/**
 * Static code analysis of touch target sizes in WorldView UI components.
 * Tailwind CSS size reference:
 * w-8/h-8 = 32px, w-10/h-10 = 40px, w-11/h-11 = 44px, w-12/h-12 = 48px
 * py-1 = 4px, py-1.5 = 6px, py-2 = 8px, py-2.5 = 10px, py-3 = 12px
 * min-h-[44px] = explicit 44px minimum height
 * Text at 10px with py-2.5 (10px padding) = 10+20 = 30px (below 44)
 * BUT with border (2px) = 32px. Need to check carefully.
 * For INLINE elements, width is determined by content, so min-h matters more.
 */

const fs = require('fs');
const path = require('path');

const TAILWIND_SIZES = {
  'w-8': 32, 'h-8': 32,
  'w-10': 40, 'h-10': 40,
  'w-11': 44, 'h-11': 44,
  'w-12': 48, 'h-12': 48,
};

function checkFile(filePath, componentName) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  console.log('\n=== ' + componentName + ' ===');

  // Check for FAB/badge fixed-size buttons
  const fixedSizePattern = /w-(\d+)\s+h-(\d+)/g;
  let match;
  let lineNum = 0;
  for (const line of lines) {
    lineNum++;
    // Check fixed-size round buttons (FABs, close buttons)
    if (line.includes('rounded-full') && (line.includes('w-') && line.includes('h-'))) {
      const wMatch = line.match(/w-(\d+)/);
      const hMatch = line.match(/h-(\d+)/);
      if (wMatch && hMatch) {
        const w = parseInt(wMatch[1]) * 4; // Tailwind unit = 4px
        const h = parseInt(hMatch[1]) * 4;
        const pass = w >= 44 && h >= 44;
        const ariaLabel = line.match(/aria-label="([^"]+)"/);
        const context = ariaLabel ? ariaLabel[1] : 'round button';
        console.log((pass ? 'PASS' : 'FAIL') + ' [L' + lineNum + '] ' + context + ': ' + w + 'x' + h + 'px');
      }
    }

    // Check min-h-[44px] usage
    if (line.includes('min-h-[44px]')) {
      const ariaLabel = line.match(/aria-label="([^"]+)"/);
      console.log('PASS [L' + lineNum + '] min-h-[44px] applied' + (ariaLabel ? ' (' + ariaLabel[1] + ')' : ''));
    }
  }

  // Check button padding classes for adequate touch targets
  const paddingChecks = [
    { pattern: /py-0\.5/, height: 4, name: 'py-0.5 (4px padding)' },
    { pattern: /py-1\b/, height: 8, name: 'py-1 (8px total padding)' },
    { pattern: /py-1\.5/, height: 12, name: 'py-1.5 (12px total padding)' },
    { pattern: /py-2\b/, height: 16, name: 'py-2 (16px total padding)' },
    { pattern: /py-2\.5/, height: 20, name: 'py-2.5 (20px total padding)' },
    { pattern: /py-3\b/, height: 24, name: 'py-3 (24px total padding)' },
  ];

  lineNum = 0;
  for (const line of lines) {
    lineNum++;
    if (!line.includes('<button') && !line.includes('className=')) continue;

    for (const check of paddingChecks) {
      if (check.pattern.test(line)) {
        // Estimate height: padding + content (~12-16px for text) + border (2px)
        const estimatedHeight = check.height + 14 + 2; // padding + text + border
        const isWide = line.includes('w-full') || line.includes('grid');
        const pass = estimatedHeight >= 34; // Reasonable minimum for grid/full-width buttons
        // Just note them
      }
    }
  }

  // Specifically check for problematic py-0.5 in button contexts
  let prevLine = '';
  lineNum = 0;
  for (const line of lines) {
    lineNum++;
    if (line.includes('py-0.5') && (line.includes('button') || line.includes('className') || prevLine.includes('<button'))) {
      console.log('WARN [L' + lineNum + '] py-0.5 found (very small touch target ~24px)');
    }
    if (line.includes('py-1 ') && !line.includes('py-1.') && (line.includes('button') || line.includes('className') || prevLine.includes('<button'))) {
      console.log('INFO [L' + lineNum + '] py-1 found (~28px height)');
    }
    prevLine = line;
  }

  // Check grid gap sizes
  lineNum = 0;
  for (const line of lines) {
    lineNum++;
    if (line.includes('gap-1 ') || line.includes('gap-1"')) {
      console.log('WARN [L' + lineNum + '] gap-1 (4px) - tight spacing between touch targets');
    }
  }
}

const srcDir = path.join(__dirname, 'src/components/ui');

checkFile(path.join(srcDir, 'OperationsPanel.tsx'), 'OperationsPanel');
checkFile(path.join(srcDir, 'CCTVPanel.tsx'), 'CCTVPanel');
checkFile(path.join(srcDir, 'IntelFeed.tsx'), 'IntelFeed');

console.log('\n=== Summary ===');
console.log('All FAB buttons should be >= 44x44px (w-11 h-11 or w-12 h-12)');
console.log('All close buttons should be >= 44x44px');
console.log('Toggle switches should have py-2.5+ for adequate touch height');
console.log('Filter grids should have gap-1.5+ for adequate spacing');
