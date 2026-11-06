import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const publicFiles = [
  'index.html', 'owner', 'account', 'assets', 'config.js', 'favicon.svg',
  'manifest.webmanifest', 'robots.txt', 'sitemap.xml', '_headers', '_redirects'
];

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });
for (const entry of publicFiles) {
  const source = path.join(root, entry);
  if (!fs.existsSync(source)) throw new Error(`Required deployment input is missing: ${entry}`);
  fs.cpSync(source, path.join(dist, entry), { recursive: true });
}
fs.writeFileSync(path.join(dist, '.nojekyll'), '');

const required = [
  'index.html', 'owner/index.html', 'account/index.html', 'account/account.js', 'account/account.css', 'config.js',
  'assets/js/app.js', 'assets/js/three-scene.js',
  'assets/models/khaled-digital-core.glb', 'assets/textures/core-surface.png'
];
const missing = required.filter(item => !fs.existsSync(path.join(dist, item)));
if (missing.length) throw new Error(`Deployment output is incomplete: ${missing.join(', ')}`);
if (fs.existsSync(path.join(dist, 'original-source')) || fs.existsSync(path.join(dist, 'supabase'))) {
  throw new Error('Private source/backend materials must not be copied into the public deployment directory.');
}
console.log(`Built static website into ${path.relative(root, dist)} (${required.length} required deployment checks passed).`);
