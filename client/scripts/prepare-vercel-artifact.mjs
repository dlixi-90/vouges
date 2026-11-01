// Create a production Build Output API artifact without buffering/copying the media corpus.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const client = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const workspace = path.dirname(client);
const backendValue = process.argv.find(value => value.startsWith('--backend='))?.slice(10);
if (!backendValue) throw new Error('Pass the production API origin with --backend=https://...');
const backend = new URL(backendValue);
if (backend.protocol !== 'https:' || backend.username || backend.password || ['localhost', '127.0.0.1'].includes(backend.hostname)) throw new Error('A public HTTPS backend is required');
process.chdir(client);
process.env.VITE_BACKEND_URL = backend.origin;

const assets = path.join(client, 'dist/assets');
if (!assets.startsWith(path.join(client, 'dist') + path.sep)) throw new Error('Unexpected generated asset directory');
await fs.rm(assets, { recursive: true, force: true });
await build({ root: client, configFile: path.join(client, 'vite.config.js'), mode: 'production', build: { emptyOutDir: false, copyPublicDir: false } });
const html = await fs.readFile(path.join(client, 'dist/index.html'), 'utf8');
if (!html.includes(`href="${backend.origin}"`) || /href="https?:\/\/(?:localhost|127\.0\.0\.1)/u.test(html)) throw new Error('Production backend connection hint is missing');

const output = path.join(workspace, '.deploy-media-frontend/.vercel/output');
const staticDirectory = path.join(output, 'static');
if (!staticDirectory.startsWith(path.join(workspace, '.deploy-media-frontend') + path.sep)) throw new Error('Unexpected artifact directory');
await fs.rm(staticDirectory, { recursive: true, force: true });
await fs.mkdir(staticDirectory, { recursive: true });
let files = 0;
async function linkTree(source, target) {
  await fs.mkdir(target, { recursive: true });
  for (const item of await fs.readdir(source, { withFileTypes: true })) {
    const from = path.join(source, item.name), to = path.join(target, item.name);
    if (item.isDirectory()) await linkTree(from, to);
    else if (item.isFile()) { await fs.link(from, to); files++; }
    else throw new Error('Unexpected symbolic link in frontend assets');
  }
}
await linkTree(path.join(client, 'public'), staticDirectory);
await linkTree(assets, path.join(staticDirectory, 'assets'));
await fs.link(path.join(client, 'dist/index.html'), path.join(staticDirectory, 'index.html')); files++;
await fs.writeFile(path.join(output, 'config.json'), JSON.stringify({ version: 3, routes: [
  { src: '/assets/(.*)', headers: { 'Cache-Control': 'public, max-age=31536000, immutable' }, continue: true },
  { src: '/fonts/(.*)', headers: { 'Cache-Control': 'public, max-age=31536000, immutable' }, continue: true },
  { src: '/images/(.*)', headers: { 'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800' }, continue: true },
  { handle: 'filesystem' }, { src: '/(.*)', dest: '/index.html' },
] }, null, 2) + '\n');
console.log(JSON.stringify({ artifact: path.relative(workspace, output).replaceAll('\\', '/'), files, backend: backend.origin, publicImagesCopied: false }));
