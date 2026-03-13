const http = require('http');

function fetch(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

async function main() {
  const raw = await fetch('http://localhost:3001/api/earthquakes');
  const parsed = JSON.parse(raw);
  console.log('Type:', typeof parsed);
  console.log('Is array:', Array.isArray(parsed));
  if (Array.isArray(parsed)) {
    console.log('Length:', parsed.length);
    console.log('First:', JSON.stringify(parsed[0]).substring(0, 300));
  } else {
    console.log('Keys:', Object.keys(parsed));
    if (parsed.features) {
      console.log('Features length:', parsed.features.length);
      console.log('First feature:', JSON.stringify(parsed.features[0]).substring(0, 300));
    }
    if (parsed.data) {
      console.log('Data length:', parsed.data.length);
    }
  }
}

main().catch(e => console.error('Error:', e.message));
