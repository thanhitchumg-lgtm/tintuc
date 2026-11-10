// Máy chủ xem thử trên máy tính: node scripts/serve.mjs [cổng]
// Mô phỏng Firebase Hosting: thư mục có index.html, và đường dẫn /a/b/ chưa có sẽ rơi về /_viewer.html
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const PORT = Number(process.argv[2] || 5173);
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp',
};

function resolveFile(urlPath) {
  const clean = decodeURIComponent(urlPath.split('?')[0]);
  const target = path.normalize(path.join(ROOT, clean));
  if (!target.startsWith(ROOT)) return null;
  for (const c of [target, path.join(target, 'index.html')]) {
    if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
  }
  return null;
}

http.createServer((req, res) => {
  let file = resolveFile(req.url);
  let status = 200;
  if (!file) {
    const segs = req.url.split('?')[0].split('/').filter(Boolean);
    const last = segs[segs.length - 1] || '';
    // Khớp các rewrite trong firebase.json: /a, /a/b, /a/p/N
    if (segs.length >= 1 && segs.length <= 3 && !last.includes('.') && (segs.length < 3 || segs[1] === 'p')) file = path.join(ROOT, '_viewer.html');
    else { file = path.join(ROOT, '404.html'); status = 404; }
  }
  res.writeHead(status, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
  fs.createReadStream(file).pipe(res);
}).listen(PORT, () => console.log(`Xem thử tại http://localhost:${PORT}/`));
