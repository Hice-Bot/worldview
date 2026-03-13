const http = require('http');

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString()));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function main() {
  const cameras = await fetchJSON('http://localhost:3001/api/cctv');
  const total = cameras.length;
  const online = cameras.filter(c => c.available).length;
  const offline = cameras.filter(c => !c.available).length;

  process.stdout.write('Total cameras: ' + total + '\n');
  process.stdout.write('Online (available=true): ' + online + '\n');
  process.stdout.write('Offline (available=false): ' + offline + '\n');
  process.stdout.write('Has available field: ' + (cameras[0] && 'available' in cameras[0]) + '\n');
  process.stdout.write('Sample camera: ' + JSON.stringify(cameras[0]).substring(0, 200) + '\n');

  // Check countries
  const countries = {};
  cameras.forEach(c => { countries[c.country] = (countries[c.country] || 0) + 1; });
  process.stdout.write('Countries: ' + JSON.stringify(countries) + '\n');
}

main().catch(e => process.stderr.write('Error: ' + e.message + '\n'));
