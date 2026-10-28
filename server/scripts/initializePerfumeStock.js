import "dotenv/config";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import Product from "../models/Product.js";
import CatalogMigration from "../models/CatalogMigration.js";
import { planInitialStock, planVariedStock, planRangeStock } from "../services/initialStock.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const varied = process.argv.includes("--vary-by-price");
const ranged = process.argv.includes("--range=1-30");
if (varied && ranged) throw new Error("Choose one stock distribution mode");
const stage = ranged ? "range" : varied ? "varied" : "initial";
const key = `perfume-${stage}-stock-v1`;
const quantity = Number(process.argv.find(arg => arg.startsWith("--quantity="))?.slice(11) ?? 3);
const apply = process.argv.includes("--apply");
const database = process.argv.find(arg => arg.startsWith("--database="))?.slice(11);
const selection = "title sizes stockBySize inStockBySize inStock inventoryMode isPublished isDeleted price updatedAt";
const filter = { isDeleted: { $ne: true } };
const { EJSON } = mongoose.mongo.BSON;

try {
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
  const db = mongoose.connection.db;
  if (database && db.databaseName !== database) throw new Error("Database does not match the explicit target");
  if (await CatalogMigration.exists({ key })) throw new Error("Starting stock has already been initialized; refusing to reset it");
  const previous = varied || ranged ? await CatalogMigration.findOne({ key: ranged ? "perfume-varied-stock-v1" : "perfume-initial-stock-v1" }).lean() : null;
  if ((varied || ranged) && !previous) throw new Error("The preceding stock initialization must exist before changing its distribution");
  const configuration = ranged ? { distribution: { minimum: 1, maximum: 30 } } : varied ? { distribution: { below1000000: [3, 5], from1000000: [2, 4], from5000000: [1, 2] } } : { quantity };
  const makePlan = products => ranged ? planRangeStock(products) : varied ? planVariedStock(products, previous.totals.quantityPerAvailableSize) : planInitialStock(products, quantity);
  const preview = makePlan(await Product.find(filter).select(selection).sort({ _id: 1 }).lean());
  assert.ok(preview.totals.products, "No products to initialize");
  console.log(JSON.stringify({ phase: "preview", database: db.databaseName, ...configuration, totals: preview.totals, databaseWrites: 0 }));
  if (apply) {
    if (!database) throw new Error("Use --database=THE_VERIFIED_DATABASE when applying");
    await CatalogMigration.init();
    const backupPath = path.join(root, ".backups", `${stage}-stock-${new Date().toISOString().replaceAll(/[:.]/g, "-")}`);
    fs.mkdirSync(backupPath, { recursive: true });
    let result;
    await mongoose.connection.transaction(async session => {
      if (await CatalogMigration.exists({ key }).session(session)) throw new Error("Starting stock has already been initialized");
      const products = await Product.find(filter).select(selection).sort({ _id: 1 }).session(session).lean();
      const plan = makePlan(products);
      assert.deepEqual(products, preview.changes.map(change => change.product), "Catalog changed since preview; rerun before applying");
      // Preserve typed identifiers/dates and every field that this migration changes.
      fs.writeFileSync(path.join(backupPath, "products.ejson"), EJSON.stringify(products, null, 2, { relaxed: false }));
      const appliedAt = new Date();
      const manifest = { key, database, ...configuration, totals: plan.totals, inventoryMode: "source", appliedAt, backupPath };
      fs.writeFileSync(path.join(backupPath, "manifest.json"), JSON.stringify(manifest, null, 2));
      const operations = plan.changes.filter(change => change.changed).map(({ product, stock }) => ({ updateOne: {
        filter: { _id: product._id, updatedAt: product.updatedAt },
        update: { $set: { stockBySize: stock, updatedAt: appliedAt } },
      } }));
      for (let offset = 0; offset < operations.length; offset += 200) {
        const batch = operations.slice(offset, offset + 200);
        const updated = await Product.collection.bulkWrite(batch, { session, ordered: true });
        assert.equal(updated.matchedCount, batch.length, "Concurrent catalog edit; all stock changes will roll back");
      }
      const saved = await Product.find(filter).select(selection).sort({ _id: 1 }).session(session).lean();
      assert.equal(saved.length, products.length);
      saved.forEach((product, index) => {
        assert.deepEqual(product.stockBySize, plan.changes[index].stock);
        for (const field of ["sizes", "inStockBySize", "inStock", "inventoryMode", "isPublished", "isDeleted", "price", "title"]) {
          assert.deepEqual(product[field], products[index][field], `Unexpected change: ${field}`);
        }
      });
      await CatalogMigration.create([{ key, source: "store-selected-initial-stock", appliedAt, totals: { ...plan.totals, ...(varied || ranged ? configuration : { quantityPerAvailableSize: quantity }) }, backupPath }], { session });
      result = { ...manifest, verified: true };
    });
    const reportPath = path.join(root, "data", ranged ? "inventory-range-distribution.json" : varied ? "inventory-distribution.json" : "inventory-initialization.json");
    fs.writeFileSync(reportPath, JSON.stringify(result, null, 2) + "\n");
    console.log(JSON.stringify({ phase: "committed", ...result, reportPath }));
  }
} finally {
  await mongoose.disconnect();
}
