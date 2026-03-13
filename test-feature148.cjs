var http = require('http');

function testEndpoint(name, params) {
  return new Promise(function(resolve) {
    var qs = Object.keys(params).map(function(k) {
      return k + '=' + encodeURIComponent(params[k]);
    }).join('&');
    var url = 'http://localhost:3001/api/flights/live' + (qs ? '?' + qs : '');

    http.get(url, function(res) {
      var body = '';
      res.on('data', function(chunk) { body += chunk; });
      res.on('end', function() {
        console.log(name + ': status=' + res.statusCode + ' body=' + body.slice(0, 120));
        resolve(res.statusCode);
      });
    }).on('error', function(e) {
      console.log(name + ': error=' + e.message);
      resolve(-1);
    });
  });
}

var tests = [
  ['missing all params', {}],
  ['missing lon', { lat: '51.5' }],
  ['missing lat', { lon: '-0.12' }],
  ['lat not a number', { lat: 'abc', lon: '0' }],
  ['lon not a number', { lat: '0', lon: 'xyz' }],
  ['lat too high (91)', { lat: '91', lon: '0' }],
  ['lat too low (-91)', { lat: '-91', lon: '0' }],
  ['lon too high (181)', { lat: '0', lon: '181' }],
  ['lon too low (-181)', { lat: '0', lon: '-181' }],
  ['lat exactly 90', { lat: '90', lon: '0' }],
  ['lat exactly -90', { lat: '-90', lon: '0' }],
  ['lon exactly 180', { lat: '0', lon: '180' }],
  ['lon exactly -180', { lat: '0', lon: '-180' }],
  ['dist negative', { lat: '51.5', lon: '-0.12', dist: '-10' }],
  ['dist zero', { lat: '51.5', lon: '-0.12', dist: '0' }],
  ['dist not a number', { lat: '51.5', lon: '-0.12', dist: 'abc' }],
  ['dist positive', { lat: '51.5', lon: '-0.12', dist: '50' }],
  ['valid no dist (default)', { lat: '51.5', lon: '-0.12' }],
];

var i = 0;
var passed = 0;
var failed = 0;

function runNext() {
  if (i >= tests.length) {
    console.log('\nResults: ' + passed + ' passed, ' + failed + ' failed out of ' + tests.length);
    return;
  }
  var test = tests[i];
  var name = test[0];
  var params = test[1];
  i++;

  testEndpoint(name, params).then(function(status) {
    var expectError = false;
    if (name.indexOf('missing') === 0) expectError = true;
    if (name.indexOf('not a number') >= 0) expectError = true;
    if (name.indexOf('too high') >= 0) expectError = true;
    if (name.indexOf('too low') >= 0) expectError = true;
    if (name.indexOf('negative') >= 0) expectError = true;
    if (name.indexOf('zero') >= 0) expectError = true;
    if (name === 'dist not a number') expectError = true;

    if (expectError && status === 400) {
      passed++;
    } else if (!expectError && (status === 200 || status === 502 || status === 504)) {
      passed++;
    } else if (!expectError && status === 400) {
      failed++;
      console.log('  ^^^ FAIL: expected success but got 400');
    } else if (expectError && status !== 400) {
      failed++;
      console.log('  ^^^ FAIL: expected 400 but got ' + status);
    } else {
      passed++;
    }
    runNext();
  });
}

runNext();
