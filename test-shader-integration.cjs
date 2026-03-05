const http = require('http');

// Test that GlobeViewer imports and uses ShaderManager
const req = http.get('http://localhost:5173/src/components/globe/GlobeViewer.tsx', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('=== GlobeViewer Shader Integration ===');
    console.log('HTTP Status:', res.statusCode);
    console.log('Imports ShaderManager:', data.includes('ShaderManager'));
    console.log('Creates shaderManagerRef:', data.includes('shaderManagerRef'));
    console.log('Calls applyMode:', data.includes('applyMode'));
    console.log('Responds to shaderMode prop:', data.includes('props.shaderMode'));
    console.log('Cleanup on destroy:', data.includes('destroy'));

    const allPass = data.includes('ShaderManager') &&
                    data.includes('shaderManagerRef') &&
                    data.includes('applyMode') &&
                    data.includes('props.shaderMode');
    console.log('');
    console.log('INTEGRATION PASS:', allPass);
    process.exit(allPass ? 0 : 1);
  });
});
req.on('error', (err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
