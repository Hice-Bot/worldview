// Quick test: verify satellite API returns ISS + other satellites
var http = require('http');
http.get('http://localhost:3001/api/satellites', function(res) {
  var data = '';
  res.on('data', function(c) { data += c; });
  res.on('end', function() {
    var j = JSON.parse(data);
    console.log('Total satellites:', j.length);
    var iss = j.filter(function(s) { return s.noradId === 25544; });
    console.log('ISS entries:', iss.length);
    if (iss.length) console.log('ISS name:', iss[0].name);
    var others = j.filter(function(s) { return s.noradId !== 25544; });
    console.log('Other satellites:', others.length);
    if (others.length) console.log('Sample other:', others[0].name);
  });
});
