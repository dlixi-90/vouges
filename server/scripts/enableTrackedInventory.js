import "dotenv/config";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import Product from "../models/Product.js";
import Order from "../models/Order.js";
import CatalogMigration from "../models/CatalogMigration.js";
import { planTrackedInventory } from "../services/trackedInventory.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const key = "perfume-tracked-inventory-v1";
const apply = process.argv.includes("--apply");
const database = process.argv.find(arg => arg.startsWith("--database="))?.slice(11);
const filter = { isDeleted: { $ne: true } };
const selection = "title sizes stockBySize inStockBySize inStock inventoryMode price isPublished updatedAt";
const pendingQr = { paymentMethod: "QR", isPaid: false, status: "Awaiting Payment" };
try {
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
  if (database && mongoose.connection.name !== database) throw new Error("Database does not match target");
  if (await CatalogMigration.exists({ key })) throw new Error("Tracked inventory migration already applied");
  if (await Order.exists(pendingQr)) throw new Error("Pending QR orders must finish before inventory mode changes");
  const preview = planTrackedInventory(await Product.find(filter).select(selection).sort({ _id: 1 }).lean());
  assert.ok(preview.totals.products);
  console.log(JSON.stringify({ phase: "preview", database: mongoose.connection.name, totals: preview.totals, databaseWrites: 0 }));
  if (apply) {
    if (!database) throw new Error("Explicit --database target required");
    await CatalogMigration.init();
    const backupPath = path.join(root, ".backups", `tracked-inventory-${new Date().toISOString().replaceAll(/[:.]/g, "-")}`);
    fs.mkdirSync(backupPath, { recursive: true });
    let result;
    await mongoose.connection.transaction(async session => {
      if (await CatalogMigration.exists({ key }).session(session)) throw new Error("Migration already applied");
      if (await Order.exists(pendingQr).session(session)) throw new Error("Pending QR order prevents inventory mode changes");
      const products = await Product.find(filter).select(selection).sort({ _id: 1 }).session(session).lean();
      assert.deepEqual(products, preview.changes.map(change => change.product), "Catalog changed since preview");
      const plan = planTrackedInventory(products), appliedAt = new Date();
      fs.writeFileSync(path.join(backupPath, "products.ejson"), mongoose.mongo.BSON.EJSON.stringify(products, null, 2, { relaxed: false }));
      const manifest = { key, database, inventoryMode: "tracked", totals: plan.totals, appliedAt, backupPath };
      fs.writeFileSync(path.join(backupPath, "manifest.json"), JSON.stringify(manifest, null, 2));
      const operations = plan.changes.filter(change => change.changed).map(({ product, update }) => ({ updateOne: { filter: { _id: product._id, updatedAt: product.updatedAt }, update: { $set: { ...update, updatedAt: appliedAt } } } }));
      for (let offset = 0; offset < operations.length; offset += 200) {
        const batch = operations.slice(offset, offset + 200);
        const changed = await Product.collection.bulkWrite(batch, { session, ordered: true });
        assert.equal(changed.matchedCount, batch.length, "Concurrent edit; rolling back migration");
      }
      const saved = await Product.find(filter).select(selection).sort({ _id: 1 }).session(session).lean();
      assert.equal(saved.length, products.length);
      saved.forEach((product, index) => {
        assert.equal(product.inventoryMode, "tracked");
        assert.deepEqual(product.stockBySize, products[index].stockBySize);
        assert.deepEqual(product.price, products[index].price);
        assert.equal(product.isPublished, products[index].isPublished);
        assert.deepEqual(product.inStockBySize, plan.changes[index].update.inStockBySize);
      });
      await CatalogMigration.create([{ key, source: "store-quantity-inventory", appliedAt, totals: plan.totals, backupPath }], { session });
      result = { ...manifest, verified: true };
    });
    fs.writeFileSync(path.join(root, "data", "tracked-inventory.json"), JSON.stringify(result, null, 2) + "\n");
    console.log(JSON.stringify({ phase: "committed", ...result }));
  }
} finally { await mongoose.disconnect(); }
