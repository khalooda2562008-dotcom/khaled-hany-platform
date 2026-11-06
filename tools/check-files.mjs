import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const files=['index.html','owner/index.html','account/index.html','account/account.js','account/account.css','config.js','assets/css/site.css','assets/css/owner.css','assets/js/app.js','assets/js/owner.js','assets/js/three-scene.js','assets/js/supabase.js','supabase/migrations/202611060001_initial_schema.sql','supabase/bootstrap/primary-owner.sql','supabase/functions/_shared/http.ts','.github/workflows/ci.yml','assets/models/khaled-digital-core.glb','assets/textures/core-surface.png','README.md','.env.example','.gitignore','tools/build.mjs'];
const missing=files.filter(f=>!fs.existsSync(path.join(root,f)));
if(missing.length){console.error('Missing files:',missing.join(', '));process.exit(1);}
const max=100*1024*1024;
for(const f of files){const size=fs.statSync(path.join(root,f)).size;if(size>max)throw new Error(`Unexpected large source file: ${f}`);}
const glb = fs.readFileSync(path.join(root,'assets/models/khaled-digital-core.glb'));
if (glb.subarray(0,4).toString('ascii') !== 'glTF') throw new Error('GLB asset signature is invalid.');
const png = fs.readFileSync(path.join(root,'assets/textures/core-surface.png'));
if (png.subarray(0,8).toString('hex') !== '89504e470d0a1a0a') throw new Error('PBR texture is not a valid PNG.');
console.log(`Checked ${files.length} required project files and verified GLB/PNG asset signatures.`);
