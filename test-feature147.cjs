const http = require('http');

function testUrl(name, urlParam) {
  return new Promise((resolve) => {
    const queryUrl = urlParam !== undefined
      ? 'http://localhost:3001/api/cctv/image?url=' + encodeURIComponent(urlParam)
      : 'http://localhost:3001/api/cctv/image';

    http.get(queryUrl, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        console.log(name + ': status=' + res.statusCode + ' body=' + body.slice(0, 120));
        resolve(res.statusCode);
      });
    }).on('error', (e) => {
      console.log(name + ': error=' + e.message);
      resolve(-1);
    });
  });
}

(function run() {
  const tests = [
    ['missing url param', undefined],
    ['empty string', ''],
    ['spaces only', '   '],
    ['not a url', 'not-a-url'],
    ['just text', 'hello world'],
    ['file protocol', 'file:///etc/passwd'],
    ['ftp protocol', 'ftp://example.com/file'],
    ['javascript protocol', 'javascript:alert(1)'],
    ['data protocol', 'data:text/html,hello'],
    ['valid https', 'https://httpbin.org/status/200'],
    ['long url 2048', 'https://example.com/' + 'a'.repeat(2048)],
    ['long url 5000', 'https://example.com/' + 'a'.repeat(5000)],
    ['long url 10000', 'https://example.com/' + 'a'.repeat(10000)],
  ];

  let i = 0;
  function next() {
    if (i >= tests.length) return;
    const [name, url] = tests[i];
    i++;
    testUrl(name, url).then(() => next());
  }
  next();
})();
