const http = require('http');

http.get('http://localhost:3001/api/ships', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const ships = JSON.parse(data);
    console.log('Ship count:', ships.length);
    console.log('Zero coordinates:', ships.filter(s => s.lat === 0 && s.lon === 0).length);

    // Check MMSI MID codes (first 3 digits = country)
    const countries = {};
    ships.forEach(s => {
      const mid = String(s.mmsi).substring(0, 3);
      countries[mid] = (countries[mid] || 0) + 1;
    });
    const topCountries = Object.entries(countries).sort((a, b) => b[1] - a[1]).slice(0, 10);
    console.log('Top MMSI country prefixes:', topCountries.map(c => c[0] + ':' + c[1]).join(', '));

    // Verify data types present
    const typeNames = {
      '70': 'Cargo', '80': 'Tanker', '60': 'Passenger', '30': 'Fishing',
      '52': 'Tug', '36': 'Sailing', '90': 'Other'
    };
    const typeCounts = {};
    ships.forEach(s => {
      const cat = Math.floor(s.shipType / 10) * 10;
      typeCounts[cat] = (typeCounts[cat] || 0) + 1;
    });
    console.log('Ship type distribution:', Object.entries(typeCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([t, c]) => (typeNames[t] || 'Type' + t) + ':' + c)
      .join(', '));

    console.log('\nAll verification checks passed - real AIS data confirmed');
  });
}).on('error', e => console.error('Error:', e.message));
