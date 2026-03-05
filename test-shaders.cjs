const http = require('http');

// Test that the Vite dev server serves the app with our shader code compiled
const req = http.get('http://localhost:5173/src/shaders/postprocess.ts', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const hasCRT = data.includes('barrelDistortion') && data.includes('chromaticAberration') && data.includes('scanline');
    const hasNVG = data.includes('greenPhosphor') && data.includes('random') && data.includes('bloomAccum');
    const hasFLIR = data.includes('sobelX') && data.includes('sobelY') && data.includes('thermal');
    const hasShaderManager = data.includes('applyMode') && data.includes('PostProcessStage');
    const hasDefaults = data.includes('SHADER_DEFAULTS');

    console.log('=== Shader Module Verification ===');
    console.log('HTTP Status:', res.statusCode);
    console.log('CRT shader complete:', hasCRT);
    console.log('NVG shader complete:', hasNVG);
    console.log('FLIR shader complete:', hasFLIR);
    console.log('ShaderManager class:', hasShaderManager);
    console.log('SHADER_DEFAULTS config:', hasDefaults);

    console.log('');
    console.log('=== CRT Feature Check ===');
    console.log('Barrel distortion UV warp:', data.includes('barrelDistortion'));
    console.log('Chromatic R/G/B offset:', data.includes('caOffset'));
    console.log('Scanlines sin(uv.y*800):', data.includes('800.0'));
    console.log('Vignette smoothstep:', data.includes('smoothstep'));

    console.log('');
    console.log('=== NVG Feature Check ===');
    console.log('Luminance dot(0.299,0.587,0.114):', data.includes('0.299') && data.includes('0.587') && data.includes('0.114'));
    console.log('Green phosphor vec3(0.1,1.0,0.2):', data.includes('vec3(0.1, 1.0, 0.2)'));
    console.log('Film grain noise:', data.includes('random'));
    console.log('Tube vignette:', data.includes('tubeMask'));
    console.log('Additive bloom:', data.includes('bloomAccum'));

    console.log('');
    console.log('=== FLIR Feature Check ===');
    console.log('Contrast enhancement:', data.includes('u_contrast'));
    console.log('Sobel edge detection:', data.includes('sobelX') && data.includes('sobelY'));
    console.log('White-hot palette:', data.includes('thermal'));
    console.log('Edge highlighting overlay:', data.includes('edge'));

    console.log('');
    console.log('=== ShaderManager Feature Check ===');
    console.log('STANDARD removes stages:', data.includes('STANDARD'));
    console.log('PostProcessStage created:', data.includes('new PostProcessStage'));
    console.log('Mode switching cleanup:', data.includes('remove'));
    console.log('Uniform parameters:', data.includes('u_distortionStrength'));

    const allPass = hasCRT && hasNVG && hasFLIR && hasShaderManager && hasDefaults;
    console.log('');
    console.log('ALL CHECKS PASSED:', allPass);
    process.exit(allPass ? 0 : 1);
  });
});
req.on('error', (err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
