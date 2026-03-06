const http = require('http');

http.get('http://localhost:5173/api/ships', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const ships = JSON.parse(data);
    console.log('Via Vite proxy - ship count:', ships.length);
    console.log('First vessel:', JSON.stringify(ships[0]).substring(0, 200));
    console.log('Vite proxy working:', ships.length > 0 ? 'YES' : 'NO');
  });
}).on('error', e => console.error('Error:', e.message));
