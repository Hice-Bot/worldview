// WCAG AA contrast ratio checker
// AA: 4.5:1 for normal text, 3:1 for large text (18px+ or 14px bold)

function srgbToLinear(v) {
  v = v / 255;
  if (v <= 0.03928) { return v / 12.92; }
  return Math.pow((v + 0.055) / 1.055, 2.4);
}

function luminance(r, g, b) {
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

function contrastRatio(l1, l2) {
  var lighter = Math.max(l1, l2);
  var darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// StatusBar background: rgba(0,10,15,0.85) on black ~ rgb(0,9,13)
var statusBgLum = luminance(0, 9, 13);
// Dark panel background: approximately rgb(0,0,0)
var panelBgLum = luminance(0, 0, 0);

var statusColors = [
  ['green #4ade80 (ACFT/SATS)', 74, 222, 128],
  ['amber #fbbf24 (SEIS)', 251, 191, 36],
  ['red #f87171 (CCTV)', 248, 113, 113],
  ['cyan #22d3ee (AIS)', 34, 211, 238],
  ['teal #00ffc8 (UTC clock)', 0, 255, 200],
  ['teal/70 (LAT/LON labels)', 0, 179, 140],
  ['teal/90 (LAT/LON values)', 0, 230, 180],
  ['STANDARD mode white/50', 128, 128, 128],
];

var panelColors = [
  ['white/80 (panel text)', 204, 204, 204],
  ['white/90 (active label)', 230, 230, 230],
  ['white/60 (button text)', 153, 153, 153],
  ['white/50 (labels, inactive text - FIXED)', 128, 128, 128],
  ['cyan-300 (active toggle)', 103, 232, 249],
  ['red-400 (error state)', 248, 113, 113],
  ['amber-400 (CRT mode)', 251, 191, 36],
  ['green-400 (NVG mode)', 74, 222, 128],
  ['green-300 (sat active)', 134, 239, 172],
  ['white/70 (intel message)', 179, 179, 179],
];

var allPass = true;

console.log('=== StatusBar Contrast (bg ~rgb(0,9,13)) ===');
statusColors.forEach(function(c) {
  var lum = luminance(c[1], c[2], c[3]);
  var ratio = contrastRatio(lum, statusBgLum);
  var pass = ratio >= 4.5 ? 'AA-PASS' : ratio >= 3 ? 'AA-Large-PASS' : 'FAIL';
  if (pass === 'FAIL') allPass = false;
  console.log('  ' + c[0] + ': ' + ratio.toFixed(1) + ':1 -> ' + pass);
});

console.log('');
console.log('=== Panel Contrast (bg ~rgb(0,0,0)) ===');
panelColors.forEach(function(c) {
  var lum = luminance(c[1], c[2], c[3]);
  var ratio = contrastRatio(lum, panelBgLum);
  var pass = ratio >= 4.5 ? 'AA-PASS' : ratio >= 3 ? 'AA-Large-PASS' : 'FAIL';
  if (pass === 'FAIL') allPass = false;
  console.log('  ' + c[0] + ': ' + ratio.toFixed(1) + ':1 -> ' + pass);
});

console.log('');
console.log(allPass ? 'ALL COLORS PASS WCAG AA' : 'SOME COLORS FAIL');
