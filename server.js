const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 8080;
const API_HOST = 'nsf.nesbbs.com';

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.wasm': 'application/wasm',
  '.json': 'application/json',
};

function proxyRequest(req, res, method) {
  const parsed = url.parse(req.url);
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', () => {
    const opts = {
      hostname: API_HOST,
      port: 443,
      path: parsed.path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'main-website': 'www.nesbbs.com',
        'Content-Length': Buffer.byteLength(body),
      },
    };
    const proxy = https.request(opts, (presp) => {
      res.writeHead(presp.statusCode, {
        'Content-Type': presp.headers['content-type'] || 'application/octet-stream',
        'Access-Control-Allow-Origin': '*',
      });
      presp.pipe(res);
    });
    proxy.on('error', (e) => {
      res.writeHead(502);
      res.end('Proxy error');
    });
    if (body) proxy.write(body);
    proxy.end();
  });
}

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url);
  const pathname = parsed.pathname;

  // Proxy API calls to nsf.nesbbs.com
  if (pathname.startsWith('/song/') || pathname.startsWith('/api/')) {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, main-website',
      });
      res.end();
      return;
    }
    proxyRequest(req, res, req.method);
    return;
  }

  // Serve static files
  let filePath = pathname === '/' ? '/index.html' : pathname;
  filePath = path.join('.', filePath);

  const ext = path.extname(filePath);
  const contentType = MIME[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log('Server running at http://localhost:' + PORT);
});
