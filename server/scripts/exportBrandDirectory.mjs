// Read-only export for the header's immediately available public directory.
import "dotenv/config";
import fs from "node:fs/promises";
import mongoose from "mongoose";
import { getPublicBrands } from "../services/publicBrands.js";

try {
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
  const started = performance.now();
  const brands = (await getPublicBrands()).map(({ name, image }) => ({ name, image }));
  if (!brands.length) throw new Error("Cannot export an empty brand directory");
  const output = JSON.stringify({ brands }, null, 2) + "\n";
  await fs.writeFile(new URL("../../client/src/data/brandDirectory.json", import.meta.url), output);
  console.log(JSON.stringify({ brands: brands.length, bytes: Buffer.byteLength(output), readMs: Math.round(performance.now() - started), databaseWrites: 0 }));
} finally {
  await mongoose.disconnect();
}
