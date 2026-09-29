import sharp from "sharp";
import { stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";

// Keep the originals; regenerate the smaller delivery assets with npm run optimize:images.
for (const name of ["bg", "banner", "features1", "features2", "hero"]) {
  const source = new URL(`../src/assets/${name}.png`, import.meta.url);
  const target = new URL(`../src/assets/${name}.webp`, import.meta.url);
  await sharp(fileURLToPath(source)).webp({ quality: 82, effort: 6 }).toFile(fileURLToPath(target));
  const before = (await stat(source)).size;
  const after = (await stat(target)).size;
  console.log(`${name}: ${before} -> ${after} bytes (${Math.round((1 - after / before) * 100)}% smaller)`);
}
