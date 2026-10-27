import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { parseTree, text } from "./product-parser.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const sourceUrl = "https://apaniche.vn/thuong-hieu";
const imageDir = path.join(root, "client/public/images/brands");
const researchDir = path.join(root, "data/research/apaniche/brands");
const descendants = node => (node.children || []).filter(child => typeof child !== "string").flatMap(child => [child, ...descendants(child)]);
const htmlPath = path.join(researchDir, "source.html");
await fs.mkdir(imageDir, { recursive: true });
await fs.mkdir(researchDir, { recursive: true });
let html;
try { html = await fs.readFile(htmlPath, "utf8"); } catch {
  const response = await fetch(sourceUrl, { signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`Brand directory returned ${response.status}`);
  html = await response.text();
}
const items = descendants(parseTree(html)).filter(node => node.attrs?.class?.split(/\s+/).includes("brand-item"));
const brands = items.map(item => {
  const nodes = descendants(item), anchor = nodes.find(node => node.tag === "a" && node.attrs.href);
  const image = nodes.find(node => node.tag === "img" && /^https:\/\/apaniche\.vn\//.test(node.attrs["data-lazy-src"] || node.attrs.src || ""));
  return { name: anchor ? text(anchor) : "", sourceUrl: anchor?.attrs.href, sourceImage: image?.attrs["data-lazy-src"] || image?.attrs.src || "", image: "" };
}).filter(item => item.name && /^https:\/\/apaniche\.vn\//.test(item.sourceUrl));
if (brands.length < 100) throw new Error(`Incomplete brand directory: ${brands.length}`);
// 4711 has products but no tile in Apaniche's brand directory. Use its official logo.
brands.push({ name: "4711", sourceUrl: "https://4711.com/", sourceImage: "https://4711.com/cdn/shop/files/MicrosoftTeams-image_2.png?v=1709654190&width=212", image: "" });
let next = 0, done = 0;
const extensions = { "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png", "image/gif": "gif" };
await Promise.all(Array.from({ length: 4 }, async () => {
  while (next < brands.length) {
    const brand = brands[next++];
    const slug = brand.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 65);
    const hash = crypto.createHash("sha256").update(brand.sourceUrl).digest("hex").slice(0, 8);
    const urls = [...new Set([brand.sourceImage, brand.sourceImage.replace("/webp-express/webp-images", "").replace(/\.webp$/, "")])].filter(Boolean);
    for (const url of urls) {
      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
        const extension = extensions[(response.headers.get("content-type") || "").split(";")[0]];
        if (!response.ok || !extension) continue;
        const bytes = Buffer.from(await response.arrayBuffer());
        if (bytes.length < 150 || bytes.length > 2 * 1024 * 1024) continue;
        const file = `${slug}-${hash}.${extension}`;
        await fs.writeFile(path.join(imageDir, file), bytes);
        brand.image = `/images/brands/${file}`; brand.downloadedFrom = url; break;
      } catch { /* Try the original image URL if the WebP mirror is unavailable. */ }
    }
    done++;
    if (done % 25 === 0) console.log(JSON.stringify({ downloaded: brands.filter(item => item.image).length, checked: done, total: brands.length }));
  }
}));
const manifest = { sourceUrl, collectedAt: new Date().toISOString(), brands };
await fs.mkdir(path.join(root, "server/data"), { recursive: true });
await fs.writeFile(path.join(root, "server/data/brandImages.json"), JSON.stringify(manifest, null, 2) + "\n");
await fs.writeFile(path.join(researchDir, "images.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(JSON.stringify({ total: brands.length, downloaded: brands.filter(item => item.image).length, missing: brands.filter(item => !item.image).map(item => item.name) }));
