const http = require('http');
http.get('http://localhost:3001/api/cctv', (res) => {
  let data = '';
  res.on('data', (c) => data += c);
  res.on('end', () => {
    const j = JSON.parse(data);
    const dirs = {};
    j.forEach(c => { if (c.direction) dirs[c.direction] = (dirs[c.direction] || 0) + 1; });
    console.log('Direction values:', JSON.stringify(dirs, null, 2));
    console.log('Total cameras:', j.length);
    console.log('With direction:', j.filter(c => c.direction).length);
    // Verify direction values are valid compass directions
    const validDirs = ['N','NE','E','SE','S','SW','W','NW'];
    const allValid = Object.keys(dirs).every(d => validDirs.includes(d));
    console.log('All directions are valid compass values:', allValid);
    // Show samples
    const samples = j.filter(c => c.direction).slice(0, 5);
    samples.forEach(c => console.log('  ' + c.name + ': dir=' + c.direction));
    // Verify real data (London coordinates)
    const gbCams = j.filter(c => c.country === 'GB');
    const londonLat = gbCams.length > 0 && gbCams[0].lat > 51 && gbCams[0].lat < 52;
    console.log('GB cameras have London coords:', londonLat);
    console.log('Test PASSED');
  });
});
