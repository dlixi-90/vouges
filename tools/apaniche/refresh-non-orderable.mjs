import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeApiProduct, parseJsonResponse, parseProductPage } from './product-parser.mjs';

// Read public source facts only. Never infer warehouse quantities from availability.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const report = JSON.parse(fs.readFileSync(path.join(root, '.qa-perfume/non-orderable-products-2026-10-31.json'), 'utf8'));
const originals = JSON.parse(fs.readFileSync(path.join(root, 'data/research/apaniche/products.json'), 'utf8'));
const sourceById = new Map(originals.map((item) => [item.sourceId, item]));
const { createHash } = await import('node:crypto');
const localId = (id) => createHash('sha256').update(`velours:apaniche:product:${id}`).digest('hex').slice(0, 24);
const sourceByLocalId = new Map(originals.map((item) => [localId(item.sourceId), item]));
const targets = report.products.map((item) => {
  const source = sourceByLocalId.get(item.id);
  if (!source) throw new Error(`Missing original source: ${item.id}`);
  return { id: item.id, sourceId: source.sourceId, title: item.title, url: source.sourceUrl };
});
const directory = path.join(root, '.qa-perfume/source-refresh-2026-10-31');
fs.mkdirSync(directory, { recursive: true });
const write = (name, value) => fs.writeFileSync(path.join(directory, name), JSON.stringify(value, null, 2));
const read = (name, fallback) => fs.existsSync(path.join(directory, name)) ? JSON.parse(fs.readFileSync(path.join(directory, name), 'utf8')) : fallback;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let lastStart = 0, stopped = false, requests = 0;
async function request(url, html = false) {
  if (new URL(url).origin !== 'https://apaniche.vn') throw new Error('Unexpected source origin');
  for (let attempt = 0; attempt < 3; attempt++) {
    const start = Math.max(Date.now(), lastStart + 400);
    lastStart = start;
    await sleep(Math.max(0, start - Date.now()));
    if (stopped) throw new Error('Source collection stopped');
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(30000), headers: { 'User-Agent': 'VeloursPublicCatalogResearch/1.0', Accept: html ? 'text/html' : 'application/json' } });
      requests++;
      if (new URL(response.url).origin !== 'https://apaniche.vn' || [401, 403, 429].includes(response.status)) {
        stopped = true;
        await response.body?.cancel();
        throw new Error(`Source access/rate limit: HTTP ${response.status}`);
      }
      if (!response.ok) { await response.body?.cancel(); const error = new Error(`HTTP ${response.status}`); error.status = response.status; throw error; }
      const reader = response.body.getReader(), decoder = new TextDecoder();
      let content = '', bytes = 0;
      try {
        while (true) {
          const chunk = await reader.read();
          if (chunk.done) break;
          bytes += chunk.value.byteLength;
          if (bytes > 12 * 1024 * 1024) throw new Error('Response too large');
          content += decoder.decode(chunk.value, { stream: true });
          const boundary = html ? content.search(/\bid=["']reviews["']/i) : -1;
          if (boundary > 0) { content = content.slice(0, boundary); await reader.cancel(); break; }
        }
        content += decoder.decode();
      } finally { reader.releaseLock(); }
      return { content, fetchedAt: new Date().toISOString(), sourceUrl: response.url, status: response.status };
    } catch (error) {
      if (stopped || error.status && error.status < 500 || attempt === 2) throw error;
      await sleep(1500 * (attempt + 1));
    }
  }
}

const robots = await request('https://apaniche.vn/robots.txt');
if (/Disallow:\s*\/\s*(?:\r?\n|$)/i.test(robots.content)) throw new Error('Source disallows collection');
write('targets.json', targets);
const fields = 'id,name,slug,permalink,sku,type,prices,images,attributes,variations,categories,brands,is_in_stock,is_purchasable,on_sale';
let parents = read('parents.json', null);
if (!parents) {
  const url = `https://apaniche.vn/wp-json/wc/store/v1/products?per_page=100&include=${targets.map((item) => item.sourceId).join(',')}&_fields=${fields}`;
  const response = await request(url);
  const raw = parseJsonResponse(response.content);
  if (!Array.isArray(raw) || raw.some((item) => !sourceById.has(item.id))) throw new Error('Unexpected source products');
  fs.writeFileSync(path.join(directory, 'parents-response.json'), response.content);
  parents = raw.map((item) => normalizeApiProduct(item, response.fetchedAt));
  write('parents.json', parents);
}
const parentMap = new Map(parents.map((item) => [item.sourceId, item]));
const results = read('results.json', []);
const complete = new Set(results.filter((item) => item.status === 'ok').map((item) => item.sourceId));
let next = 0;
const todo = targets.filter((item) => !complete.has(item.sourceId));
await Promise.all(Array.from({ length: 2 }, async () => {
  while (!stopped) {
    const target = todo[next++];
    if (!target) return;
    let result;
    try {
      const parent = parentMap.get(target.sourceId);
      if (!parent) throw new Error('Parent not returned by public source API');
      const response = await request(parent.sourceUrl, true);
      fs.writeFileSync(path.join(directory, `${target.sourceId}.html`), response.content);
      const data = parseProductPage(response.content, response.sourceUrl);
      if (!data.pageTitle || /captcha|access denied|just a moment/i.test(data.pageTitle)) throw new Error('Unverified product page');
      const canonicalName = (value) => String(value).toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
      if (canonicalName(data.pageTitle) !== canonicalName(parent.name)) throw new Error('Page title does not match source API identity');
      const variants = [...(data.variants || [])];
      for (const reference of parent.variantReferences || []) {
        if (variants.some((item) => item.sourceId === reference.sourceId)) continue;
        const supplement = await request(`https://apaniche.vn/wp-json/wc/store/v1/products/${reference.sourceId}?_fields=id,parent,prices,images,is_in_stock,is_purchasable,sku`);
        const raw = parseJsonResponse(supplement.content);
        if (raw.id !== reference.sourceId || raw.parent !== parent.sourceId) throw new Error('Variation parent identity mismatch');
        const normalized = normalizeApiProduct(raw, supplement.fetchedAt);
        variants.push({ ...normalized, attributes: Object.fromEntries((reference.attributes || []).map((attribute) => [`attribute_${parent.attributes.find((item) => item.name === attribute.name)?.taxonomy || attribute.name}`, attribute.value])), sku: raw.sku || '', detailSource: 'public_store_api', fetchedAt: supplement.fetchedAt });
      }
      result = { ...target, status: 'ok', fetchedAt: response.fetchedAt, parent, data: { ...data, variants } };
    } catch (error) { result = { ...target, status: 'error', error: error.message, fetchedAt: new Date().toISOString() }; }
    const existing = results.findIndex((item) => item.sourceId === target.sourceId);
    if (existing >= 0) results[existing] = result; else results.push(result);
    write('results.json', results);
    console.log(JSON.stringify({ completed: results.length, total: targets.length, title: target.title, status: result.status, error: result.error, variants: result.data?.variants?.length }));
  }
}));
const summary = { checkedAt: new Date().toISOString(), total: targets.length, complete: results.filter((item) => item.status === 'ok').length, failed: results.filter((item) => item.status !== 'ok').map(({ title, error }) => ({ title, error })), requests, directory };
write('summary.json', summary);
console.log(JSON.stringify(summary));
if (summary.complete !== targets.length) process.exitCode = 1;
