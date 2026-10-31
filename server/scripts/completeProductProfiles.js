import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Product from '../models/Product.js';
import { prepareProfileCompletion } from '../services/productProfileCompletion.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
dotenv.config({ path: path.join(root, 'server/.env'), quiet: true });
const args = process.argv.slice(2), apply = args.includes('--apply');
const manifestFile = args.find(arg => arg.startsWith('--manifest='))?.slice(11) || 'data/product-profile-completion-2026-10-31.json';
const manifest = JSON.parse(fs.readFileSync(path.resolve(root, manifestFile), 'utf8'));
if (!Array.isArray(manifest.products) || !manifest.products.length || new Set(manifest.products.map(p => p.id)).size !== manifest.products.length) throw new Error('Invalid completion manifest');
if (apply && !args.includes('--database=vouges')) throw new Error('Apply requires --database=vouges');
const protectedFields = ['title', 'description', 'descriptionContent', 'ingredients', 'category', 'catalogScope', 'popular', 'price', 'sizes', 'stockBySize', 'inStockBySize', 'inStock', 'inventoryMode', 'isPublished', 'isDeleted', 'deletedAt', 'variantMetadata', 'sizeImages', 'imageProcessing'];
const protectedHash = products => crypto.createHash('sha256').update(JSON.stringify(products.map(p => [String(p._id), ...protectedFields.map(field => p[field])]))).digest('hex');
let backupDirectory;
try {
  await mongoose.connect(process.env.MONGO_URI, { autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 20000 });
  if (mongoose.connection.name !== 'vouges') throw new Error('Unexpected database');
  const products = await Product.find({ _id: { $in: manifest.products.map(p => p.id) } }).sort({ _id: 1 }).lean();
  if (products.length !== manifest.products.length) throw new Error('Some reviewed products no longer exist');
  if (products.every(p => p.source?.profileCompletion?.runId === manifest.runId)) {
    console.log(JSON.stringify({ applied: false, alreadyApplied: true, products: products.length }));
  } else {
    const now = new Date();
    const updates = manifest.products.map(record => {
      const product = products.find(p => String(p._id) === record.id);
      return { record, product, set: prepareProfileCompletion(product, record, manifest.runId, now) };
    });
    const fieldChanges = updates.filter(p => Object.keys(p.record.changes).length).length;
    const summary = { database: mongoose.connection.name, reviewed: updates.length, fieldChanges, complete: updates.filter(p => !p.set.qualityIssues.length).length, unresolved: updates.filter(p => p.set.qualityIssues.length).length, applied: false };
    if (apply) {
      backupDirectory = path.join(root, '.backups', `complete-product-profiles-${now.toISOString().replace(/[:.]/g, '-')}`);
      fs.mkdirSync(backupDirectory, { recursive: true });
      fs.writeFileSync(path.join(backupDirectory, 'products.ejson'), mongoose.mongo.BSON.EJSON.stringify(products, null, 2, { relaxed: false }));
      fs.copyFileSync(path.resolve(root, manifestFile), path.join(backupDirectory, 'manifest.json'));
      const beforeHash = protectedHash(products);
      await mongoose.connection.transaction(async session => {
        for (const { product, set } of updates) {
          const result = await Product.updateOne({ _id: product._id, updatedAt: product.updatedAt, isDeleted: { $ne: true } }, { $set: { ...set, updatedAt: now } }, { session, runValidators: true, timestamps: false });
          if (result.matchedCount !== 1) throw new Error(`Concurrent product edit: ${product.source.id}`);
        }
        const after = await Product.find({ _id: { $in: products.map(p => p._id) } }).sort({ _id: 1 }).session(session).lean();
        if (protectedHash(after) !== beforeHash) throw new Error('Protected commerce/editorial fields changed');
        for (const { record, set } of updates) {
          const saved = after.find(p => String(p._id) === record.id);
          if (JSON.stringify(saved.qualityIssues) !== JSON.stringify(set.qualityIssues) || saved.source.profileCompletion.runId !== manifest.runId) throw new Error('Post-write verification failed');
        }
      });
      summary.applied = true;
      summary.protectedFieldsUnchanged = true;
      summary.backupDirectory = path.relative(root, backupDirectory);
      fs.writeFileSync(path.join(backupDirectory, 'result.json'), JSON.stringify(summary, null, 2));
    }
    console.log(JSON.stringify(summary));
  }
} finally { await mongoose.disconnect(); }
