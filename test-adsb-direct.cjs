const https = require('https');

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      var data = '';
      res.on('data', function(chunk) { data += chunk; });
      res.on('end', function() {
        try { resolve(JSON.parse(data)); }
        catch(e) { reject(new Error('Invalid JSON: ' + data.substring(0, 200))); }
      });
    }).on('error', reject);
  });
}

async function main() {
  try {
    console.log('Testing adsb.fi direct regional query...');
    var result = await fetchJSON('https://api.adsb.fi/v2/lat/-33.8/lon/151.2/dist/100');
    var ac = result.ac || [];
    console.log('adsb.fi count:', ac.length);
    if (ac.length > 0) {
      console.log('Sample:', JSON.stringify(ac[0], null, 2));
      console.log('\nFields available:', Object.keys(ac[0]).join(', '));
      var withReg = ac.filter(function(a) { return a.r && a.r.length > 0; });
      var withFlight = ac.filter(function(a) { return a.flight && a.flight.trim().length > 0; });
      console.log('With registration:', withReg.length, '/', ac.length);
      console.log('With flight/callsign:', withFlight.length, '/', ac.length);
    }
  } catch(err) {
    console.error('Error:', err.message);
  }
}

main();
