import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const types = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.xml':'application/xml; charset=utf-8','.txt':'text/plain; charset=utf-8'};
const server = http.createServer((req,res)=>{
  const pathname = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const normalized = path.normalize(pathname).replace(/^([.][.][/\\])+/, '');
  let target = path.resolve(root, `.${normalized}`);
  if (!target.startsWith(root + path.sep) && target !== root) { res.writeHead(403); res.end('Forbidden'); return; }
  try { if (fs.existsSync(target) && fs.statSync(target).isDirectory()) target = path.join(target,'index.html'); } catch {}
  fs.readFile(target,(err,buffer)=>{
    if(err){res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});res.end('Not found');return;}
    res.writeHead(200,{'Content-Type':types[path.extname(target)]||'application/octet-stream','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','Cache-Control':'no-store'});res.end(buffer);
  });
});
const port = Number(process.env.PORT || 4173);
server.listen(port,'0.0.0.0',()=>console.log(`Khaled Hany project: http://localhost:${port}`));
