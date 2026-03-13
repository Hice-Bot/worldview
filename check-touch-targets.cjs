const fs = require('fs');

const files = [
  ['src/components/ui/OperationsPanel.tsx', 'OperationsPanel'],
  ['src/components/ui/CCTVPanel.tsx', 'CCTVPanel'],
  ['src/components/ui/IntelFeed.tsx', 'IntelFeed']
];

files.forEach(function(pair) {
  var file = pair[0], name = pair[1];
  var content = fs.readFileSync(file, 'utf8');
  var lines = content.split('\n');

  console.log('\n--- ' + name + ' ---');

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    var prevLine = i > 0 ? lines[i - 1] : '';

    // Check fixed-size round buttons (FABs, close buttons)
    if (line.includes('rounded-full') && line.includes('className')) {
      var wMatch = line.match(/\bw-(\d+)\b/);
      var hMatch = line.match(/\bh-(\d+)\b/);
      if (wMatch && hMatch) {
        var w = parseInt(wMatch[1]) * 4;
        var h = parseInt(hMatch[1]) * 4;
        if (w >= 16 && h >= 16) {
          var labelMatch = line.match(/aria-label="([^"]+)"/);
          var label = labelMatch ? labelMatch[1] : 'round button';
          var pass = w >= 44 && h >= 44;
          console.log((pass ? 'PASS' : 'FAIL') + ' L' + (i + 1) + ' ' + label + ': ' + w + 'x' + h + 'px');
        }
      }
    }

    // Check for min-h-[44px]
    if (line.includes('min-h-[44px]')) {
      console.log('PASS L' + (i + 1) + ' min-height 44px applied');
    }

    // Check py- padding on button elements
    if ((line.includes('<button') || prevLine.includes('<button')) && line.includes('className')) {
      var pyMatch = line.match(/py-(\d+\.?\d*)/);
      if (pyMatch) {
        var pyVal = parseFloat(pyMatch[1]);
        var pyPx = pyVal * 4; // Each Tailwind unit = 4px
        // With text ~12px + padding*2 + border 2px
        var estimatedH = 12 + pyPx * 2 + 2;
        if (estimatedH < 36) {
          console.log('WARN L' + (i + 1) + ' py-' + pyVal + ' estimated height ~' + estimatedH + 'px');
        }
      }
    }
  }
});

// Check for gap-1 in grid contexts (tight spacing)
console.log('\n--- Gap spacing checks ---');
files.forEach(function(pair) {
  var file = pair[0], name = pair[1];
  var content = fs.readFileSync(file, 'utf8');
  var lines = content.split('\n');
  for (var i = 0; i < lines.length; i++) {
    if (lines[i].includes('grid') && lines[i].match(/gap-1\b/) && !lines[i].match(/gap-1\.\d/)) {
      console.log('WARN ' + name + ' L' + (i + 1) + ' gap-1 (4px) in grid - tight touch target spacing');
    }
  }
});

console.log('\nDone.');
