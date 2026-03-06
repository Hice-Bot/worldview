var http = require('http');

// Feature #8: Express CORS enabled for development
// Steps:
// 1. Server uses cors middleware
// 2. OPTIONS preflight requests return Access-Control-Allow-Origin: *
// 3. Cross-origin fetch from different port works without errors
// 4. CORS headers present on all /api/ responses

var pass = true;
var completed = 0;
var totalTests = 4;

function done() {
  completed++;
  if (completed >= totalTests) {
    console.log('\n===========================');
    console.log(pass ? '✓ FEATURE #8: ALL CHECKS PASSED' : '✗ FEATURE #8: SOME CHECKS FAILED');
    console.log('===========================\n');
    process.exit(pass ? 0 : 1);
  }
}

// Step 1: Server uses cors middleware
console.log('\n--- Step 1: Server uses cors middleware ---');
var fs = require('fs');
var serverCode = fs.readFileSync('./server/index.js', 'utf8');
if (serverCode.includes("import cors from 'cors'") && serverCode.includes('app.use(cors())')) {
  console.log('  ✓ cors imported and app.use(cors()) present');
} else {
  console.log('  ✗ cors middleware not properly configured');
  pass = false;
}
// Check package.json for cors dependency
var pkg = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
if (pkg.dependencies && pkg.dependencies.cors) {
  console.log('  ✓ cors package in dependencies: ' + pkg.dependencies.cors);
} else {
  console.log('  ✗ cors not in dependencies');
  pass = false;
}
done();

// Step 2: OPTIONS preflight requests return Access-Control-Allow-Origin: *
console.log('\n--- Step 2: OPTIONS preflight returns CORS headers ---');
var options = {
  hostname: 'localhost',
  port: 3001,
  path: '/api/health',
  method: 'OPTIONS',
  headers: {
    'Origin': 'http://localhost:5173',
    'Access-Control-Request-Method': 'GET',
    'Access-Control-Request-Headers': 'content-type'
  }
};
var req2 = http.request(options, function(res) {
  var acao = res.headers['access-control-allow-origin'];
  var acam = res.headers['access-control-allow-methods'];
  console.log('  Status:', res.statusCode);
  console.log('  Access-Control-Allow-Origin:', acao || 'NOT SET');
  console.log('  Access-Control-Allow-Methods:', acam || 'NOT SET');
  if (acao === '*' || acao === 'http://localhost:5173') {
    console.log('  ✓ CORS preflight returns valid Allow-Origin');
  } else {
    console.log('  ✗ CORS preflight missing Allow-Origin header');
    pass = false;
  }
  if (res.statusCode === 204 || res.statusCode === 200) {
    console.log('  ✓ Preflight status OK: ' + res.statusCode);
  } else {
    console.log('  ⚠ Preflight status: ' + res.statusCode);
  }
  done();
});
req2.on('error', function(e) { console.log('  ✗ Error:', e.message); pass = false; done(); });
req2.end();

// Step 3: Cross-origin fetch from different port works
console.log('\n--- Step 3: Cross-origin GET with Origin header works ---');
var options3 = {
  hostname: 'localhost',
  port: 3001,
  path: '/api/health',
  method: 'GET',
  headers: { 'Origin': 'http://localhost:9999' }  // different port = cross-origin
};
var req3 = http.request(options3, function(res) {
  var acao = res.headers['access-control-allow-origin'];
  var data = '';
  res.on('data', function(c) { data += c; });
  res.on('end', function() {
    console.log('  Status:', res.statusCode);
    console.log('  Access-Control-Allow-Origin:', acao || 'NOT SET');
    if (acao === '*') {
      console.log('  ✓ Cross-origin request accepted with wildcard origin');
    } else {
      console.log('  ✗ Cross-origin request missing CORS header');
      pass = false;
    }
    if (res.statusCode === 200) {
      console.log('  ✓ Got valid response: ' + data.substring(0, 60) + '...');
    }
    done();
  });
});
req3.on('error', function(e) { console.log('  ✗ Error:', e.message); pass = false; done(); });
req3.end();

// Step 4: CORS headers on multiple /api/ endpoints
console.log('\n--- Step 4: CORS headers on all /api/ responses ---');
var endpoints = ['/api/health', '/api/earthquakes', '/api/cctv'];
var checked = 0;
var allHaveCors = true;
endpoints.forEach(function(ep) {
  var opts = {
    hostname: 'localhost',
    port: 3001,
    path: ep,
    method: 'GET',
    headers: { 'Origin': 'http://localhost:5173' }
  };
  var r = http.request(opts, function(res) {
    var acao = res.headers['access-control-allow-origin'];
    res.resume(); // drain response
    res.on('end', function() {
      if (acao === '*') {
        console.log('  ✓ ' + ep + ': Access-Control-Allow-Origin: ' + acao);
      } else {
        console.log('  ✗ ' + ep + ': Missing CORS header');
        allHaveCors = false;
      }
      checked++;
      if (checked >= endpoints.length) {
        if (!allHaveCors) pass = false;
        done();
      }
    });
  });
  r.on('error', function(e) {
    console.log('  ✗ ' + ep + ' error: ' + e.message);
    allHaveCors = false;
    checked++;
    if (checked >= endpoints.length) { pass = false; done(); }
  });
  r.end();
});
