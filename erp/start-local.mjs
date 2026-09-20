/**
 * Local static server for Delkor-Fiberk ERP.
 * Serves public/ when present, otherwise this folder (flat Vercel root).
 * /r/:code uses receipt.html — same rewrite as live.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = fs.existsSync(path.join(HERE, 'public', 'login.html'))
  ? path.join(HERE, 'public')
  : HERE;
const PORT = Number(process.env.PORT || 5500);
const HOST = '0.0.0.0';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.txt': 'text/plain; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.pdf': 'application/pdf',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.xls': 'application/vnd.ms-excel',
};

function safeFile(urlPath) {
  let p = decodeURIComponent(urlPath.split('?')[0] || '/');
  if (p.startsWith('/r/') || p === '/r') p = '/receipt.html';
  if (p === '/' || p === '') p = '/index.html';
  if (p.endsWith('/')) p += 'index.html';
  const abs = path.normalize(path.join(ROOT, p));
  if (!abs.startsWith(ROOT)) return null;
  return abs;
}

const server = http.createServer((req, res) => {
  const file = safeFile(req.url || '/');
  if (!file) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found: ' + (req.url || ''));
      return;
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    });
    res.end(data);
  });
});

server.listen(PORT, HOST, () => {
  console.log('');
  console.log('  Delkor-Fiberk ERP  (local)');
  console.log('  http://127.0.0.1:' + PORT + '/login.html');
  console.log('  Site folder: ' + ROOT);
  console.log('  Stop with Ctrl+C. Same folder deploys to Vercel.');
  console.log('');
});
