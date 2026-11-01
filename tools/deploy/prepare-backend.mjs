// Preserve shared utilities inside the Vercel function root, without changing app code.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const workspace = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const stage = path.join(workspace, '.deploy-media-backend');
try { await fs.access(stage); throw new Error('Generated backend staging directory already exists; remove it before preparing a new artifact'); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
const server = path.join(stage, 'server');
const shared = path.join(server, 'shared/client');
await fs.mkdir(path.join(shared, 'src'), { recursive: true });
const excluded = new Set(['node_modules', '.env', '.vercel', 'scripts', 'tests', 'previews']);
for (const item of await fs.readdir(path.join(workspace, 'server'), { withFileTypes: true })) {
  if (excluded.has(item.name) || item.name.startsWith('.env.')) continue;
  await fs.cp(path.join(workspace, 'server', item.name), path.join(server, item.name), { recursive: true });
}
for (const folder of ['utils', 'data']) await fs.cp(path.join(workspace, 'client/src', folder), path.join(shared, 'src', folder), { recursive: true });
await fs.writeFile(path.join(shared, 'package.json'), JSON.stringify({ type: 'module' }) + '\n');
let rewritten = 0;
async function rewrite(directory) {
  for (const item of await fs.readdir(directory, { withFileTypes: true })) {
    if (item.name === 'shared') continue;
    const filename = path.join(directory, item.name);
    if (item.isDirectory()) await rewrite(filename);
    else if (/\.(?:js|mjs)$/u.test(item.name)) {
      const before = await fs.readFile(filename, 'utf8');
      const after = before.replace(/(["'])(\.\.[^"']*\/client\/src\/[^"']+)\1/gu, (whole, quote, specifier) => {
        const resolved = path.resolve(path.dirname(filename), specifier);
        const outsideClient = path.join(stage, 'client/src');
        if (!resolved.startsWith(outsideClient + path.sep)) return whole;
        const target = path.join(shared, 'src', path.relative(outsideClient, resolved));
        const relative = path.relative(path.dirname(filename), target).replaceAll('\\', '/');
        return quote + (relative.startsWith('.') ? relative : './' + relative) + quote;
      });
      if (before !== after) { await fs.writeFile(filename, after); rewritten++; }
    }
  }
}
await rewrite(server);
const visited = new Set();
async function trace(filename) {
  if (visited.has(filename)) return;
  visited.add(filename);
  const source = await fs.readFile(filename, 'utf8');
  for (const match of source.matchAll(/(?:from\s*|import\s*)["'](\.[^"']+)["']/gu)) {
    const target = path.resolve(path.dirname(filename), match[1]);
    if (!target.startsWith(server + path.sep)) throw new Error(`Dependency leaves function root: ${match[1]}`);
    await fs.access(target);
    if (/\.(?:js|mjs)$/u.test(target)) await trace(target);
  }
}
await trace(path.join(server, 'server.js'));
await fs.writeFile(path.join(stage, '.vercelignore'), '**/.env\n**/.env.*\n**/node_modules\n**/tests\n**/scripts\n**/previews\n');
console.log(JSON.stringify({ artifact: '.deploy-media-backend', rewrittenModules: rewritten, tracedModules: visited.size, importsOutsideFunctionRoot: 0 }));
