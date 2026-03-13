const http = require('http');
http.get('http://localhost:3001/api/cctv', (res) => {
  let d = '';
  res.on('data', (c) => d += c);
  res.on('end', () => {
    const cams = JSON.parse(d);
    const zeroCoords = cams.filter(c => Math.abs(c.lat) <= 0.01 || Math.abs(c.lon) <= 0.01);
    console.log('Cameras with near-zero coords:', zeroCoords.length);
    zeroCoords.slice(0, 10).forEach(c => console.log('  ', c.name, 'lat:', c.lat, 'lon:', c.lon, c.country));
  });
});
