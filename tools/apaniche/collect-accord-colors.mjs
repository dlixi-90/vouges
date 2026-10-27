// Collect exact public CSS colors; never modify catalog records or percentages.
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { parseAccordColors, parseAccordLibrary } from "./accord-colors-parser.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const research = path.join(root, "data/research/apaniche");
const cache = path.join(root, ".qa-perfume/accord-colors");
await fs.mkdir(cache, { recursive: true });
const receipts = [], colors = new Map(), conflicts = [];
const key = url => new URL(url).pathname.replace(/\/+$/, "");
const request = async url => {
  const address = new URL(url);
  if (address.origin !== "https://apaniche.vn" || /^\/wp-(admin|login)/.test(address.pathname)) throw new Error("Outside public source scope");
  const file = path.join(cache, `${crypto.createHash("sha256").update(url).digest("hex")}.html`);
  let html, fetchedAt;
  try { html = await fs.readFile(file, "utf8"); fetchedAt = (await fs.stat(file)).mtime.toISOString(); } catch (error) { if (error.code !== "ENOENT") throw error; }
  if (!html) {
    await new Promise(resolve => setTimeout(resolve, 350));
    const response = await fetch(url, { signal: AbortSignal.timeout(30000), headers: { "User-Agent": "VeloursPublicCatalogResearch/1.0" } });
    if (!response.ok || new URL(response.url).origin !== address.origin) throw new Error(`Source returned ${response.status}: ${url}; collection stopped`);
    html = await response.text(); fetchedAt = new Date().toISOString();
    if (Buffer.byteLength(html) > 12 * 1024 * 1024) throw new Error("Source exceeds collection size limit");
    await fs.writeFile(file, html);
  }
  receipts.push({ url, fetchedAt, sha256: crypto.createHash("sha256").update(html).digest("hex") });
  return html;
};
const sourceUrl = "https://apaniche.vn/thu-vien-mui-huong";
const library = parseAccordLibrary(await request(sourceUrl));
if (library.length < 60) throw new Error(`Incomplete source library: ${library.length}`);
const products = JSON.parse(await fs.readFile(path.join(research, "products.json"), "utf8"));
const required = new Map(library.map(term => [key(term.url), term]));
for (const product of products) for (const accord of product.detail?.data?.accords || []) if (accord.url && !required.has(key(accord.url))) required.set(key(accord.url), { label: accord.label, url: accord.url, english: "" });
const remaining = new Set(required.keys()), visited = new Set();
while (remaining.size) {
  const ranked = products.filter(product => !visited.has(product.sourceUrl)).map(product => ({
    product, covered: new Set((product.detail?.data?.accords || []).map(accord => accord.url && key(accord.url)).filter(accord => remaining.has(accord))),
  })).sort((a, b) => b.covered.size - a.covered.size);
  const best = ranked[0];
  if (!best?.covered.size) throw new Error(`No example products for: ${[...remaining].join(", ")}`);
  const url = best.product.sourceUrl; visited.add(url);
  for (const row of parseAccordColors(await request(url))) {
    const id = key(row.url), previous = colors.get(id);
    if (previous && (previous.background !== row.background || previous.foreground !== row.foreground)) conflicts.push({ id, previous, alternative: { ...row, exampleUrl: url } });
    if (!previous) colors.set(id, { ...(required.get(id) || {}), ...row, exampleUrl: url });
    remaining.delete(id);
  }
  console.log(JSON.stringify({ checkedPages: visited.size, found: colors.size, remaining: remaining.size }));
}
if (conflicts.length) { await fs.writeFile(path.join(research, "accord-color-conflicts.json"), JSON.stringify(conflicts, null, 2)); throw new Error("Conflicting source colors require review"); }
const ordered = [...required.keys()].map(id => colors.get(id));
const report = { sourceUrl, collectedAt: new Date().toISOString(), libraryCount: library.length, catalogAccords: required.size, missing: [], conflicts, receipts, accords: ordered };
await fs.writeFile(path.join(research, "accord-colors.json"), JSON.stringify(report, null, 2) + "\n");
await fs.mkdir(path.join(root, "client/src/data"), { recursive: true });
const palette = Object.fromEntries(ordered.map(row => [key(row.url).slice(1), { label: row.label, english: row.english || "", background: row.background, foreground: row.foreground }]));
await fs.writeFile(path.join(root, "client/src/data/accordColors.json"), JSON.stringify(palette, null, 2) + "\n");
console.log(JSON.stringify({ complete: true, colors: ordered.length, pages: visited.size, missing: 0, conflicts: 0 }));
