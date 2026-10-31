import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import mongoose from 'mongoose';
import Product from '../models/Product.js';
import User from '../models/User.js';
import Order from '../models/Order.js';
import { getPurchaseLimit, isSizeEnabled } from '../utils/productStock.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const apply = process.argv.includes('--apply');
const database = process.argv.find(value => value.startsWith('--database='))?.slice(11);
const directory = path.join(root, '.qa-perfume/remove-test-variants-2026-10-31');
const maps = ['price', 'stockBySize', 'inStockBySize', 'sizeImages', 'variantMetadata'];
const suffix = /test\s*$/iu;
const isTest = (product, size) => suffix.test(size.replace(/\s*·\s*\d+$/u, '')) || suffix.test(product.variantMetadata?.[size]?.label || '');
const keys = product => [...new Set([...(product.sizes || []), ...maps.flatMap(field => Object.keys(product[field] || {}))])];
const removedKeys = product => keys(product).filter(size => isTest(product, size));
const keep = (map, removed) => Object.fromEntries(Object.entries(map || {}).filter(([size]) => !removed.has(size)));
const makeUpdate = product => {
  const removed = new Set(removedKeys(product));
  const sizes = product.sizes.filter(size => !removed.has(size));
  const update = { sizes, ...Object.fromEntries(maps.map(field => [field, keep(product[field], removed)])) };
  const current = { ...product, ...update };
  update.inStock = product.inStock === true && sizes.some(size => isSizeEnabled(current, size) && getPurchaseLimit(current, size) > 0 && Number.isSafeInteger(current.price[size]) && current.price[size] > 0);
  update.qualityIssues = (product.qualityIssues || []).filter(issue => !['zero_source_price', 'missing_sizes'].includes(issue));
  if (!sizes.length) update.qualityIssues.push('missing_sizes');
  if (sizes.some(size => !Number.isSafeInteger(update.price[size]) || update.price[size] <= 0)) update.qualityIssues.push('zero_source_price');
  return update;
};
const selection = 'title brand sizes price stockBySize inStockBySize sizeImages variantMetadata inStock inventoryMode qualityIssues updatedAt isDeleted';
const targetFilter = { isDeleted: { $ne: true } };
const refs = plans => plans.flatMap(plan => plan.removedKeys.map(size => ({ product: plan.id, size })));
async function references(plans, session) {
  const rows = refs(plans);
  if (!rows.length) return { carts: [], pendingOrders: [] };
  const pendingOrders = await Order.find({ paymentMethod: 'QR', isPaid: false, status: { $in: ['Awaiting Payment', 'Payment Review'] }, $or: rows.map(row => ({ items: { $elemMatch: row } })) }).select('_id').session(session || null).lean();
  const carts = await User.find({ $or: rows.map(row => ({ [`cartData.${row.product}.${row.size}`]: { $exists: true } })) }).select('_id cartData cartAddedAt updatedAt').sort({ _id: 1 }).session(session || null).lean();
  return { carts, pendingOrders };
}
const write = (name, value) => fs.writeFileSync(path.join(directory, name), JSON.stringify(value, null, 2));
const ejson = (name, value) => mongoose.mongo.BSON.EJSON.stringify(value, null, 2, { relaxed: false });
try {
  assert.equal(database, 'vouges', 'Explicit --database=vouges required');
  await mongoose.connect(process.env.MONGO_URI, { autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 15000 });
  assert.equal(mongoose.connection.name, database);
  fs.mkdirSync(directory, { recursive: true });
  if (!apply) {
    const products = await Product.find(targetFilter).select(selection).sort({ _id: 1 }).lean();
    const affected = products.filter(product => removedKeys(product).length);
    const plans = affected.map(product => ({ id: String(product._id), title: product.title, updatedAt: product.updatedAt.toISOString(), removedKeys: removedKeys(product), removedSizes: product.sizes.filter(size => isTest(product, size)), update: makeUpdate(product) }));
    const related = await references(plans);
    const totals = { products: plans.length, removedVariants: plans.reduce((sum, plan) => sum + plan.removedSizes.length, 0), removedStoredKeys: plans.reduce((sum, plan) => sum + plan.removedKeys.length, 0), removedQuantity: affected.reduce((sum, product) => sum + removedKeys(product).reduce((total, size) => total + (Number(product.stockBySize?.[size]) || 0), 0), 0), productsWithoutSizes: plans.filter(plan => !plan.update.sizes.length).map(({ id, title }) => ({ id, title })), referencedCarts: related.carts.length, pendingQrOrders: related.pendingOrders.length, labels: [...new Set(plans.flatMap(plan => plan.removedKeys))].sort() };
    write('plan.json', { database, preparedAt: new Date().toISOString(), totals, plans });
    console.log(JSON.stringify({ phase: 'preview', databaseWrites: 0, ...totals }, null, 2));
  } else {
    assert.ok(!fs.existsSync(path.join(directory, 'applied.json')), 'Already applied; inspect receipt first');
    const plan = JSON.parse(fs.readFileSync(path.join(directory, 'plan.json'), 'utf8'));
    assert.equal(plan.database, database);
    assert.ok(Date.now() - Date.parse(plan.preparedAt) < 60 * 60 * 1000, 'Preview expired');
    assert.ok(plan.plans.length, 'Nothing to remove');
    const ids = plan.plans.map(item => new mongoose.Types.ObjectId(item.id));
    const products = await Product.find({ _id: { $in: ids }, ...targetFilter }).sort({ _id: 1 }).lean();
    assert.equal(products.length, ids.length);
    for (const product of products) {
      const item = plan.plans.find(row => row.id === String(product._id));
      assert.equal(product.updatedAt.toISOString(), item.updatedAt, 'Concurrent product edit');
      assert.deepEqual(makeUpdate(product), item.update, 'Plan changed');
    }
    const related = await references(plan.plans);
    assert.equal(related.pendingOrders.length, 0, 'Pending QR order prevents capacity removal');
    const backupPath = path.join(root, '.backups', `remove-test-variants-${new Date().toISOString().replaceAll(/[:.]/g, '-')}`);
    fs.mkdirSync(backupPath, { recursive: true });
    fs.writeFileSync(path.join(backupPath, 'products.ejson'), ejson('products', products));
    fs.writeFileSync(path.join(backupPath, 'carts.ejson'), ejson('carts', related.carts));
    fs.copyFileSync(path.join(directory, 'plan.json'), path.join(backupPath, 'plan.json'));
    fs.copyFileSync(fileURLToPath(import.meta.url), path.join(backupPath, 'operation.js'));
    await mongoose.connection.transaction(async session => {
      const current = await Product.find({ _id: { $in: ids } }).sort({ _id: 1 }).session(session).lean();
      assert.ok(isDeepStrictEqual(current, products), 'Products changed after backup');
      const currentRelated = await references(plan.plans, session);
      assert.equal(currentRelated.pendingOrders.length, 0, 'Pending QR order prevents removal');
      assert.ok(isDeepStrictEqual(currentRelated.carts, related.carts), 'Carts changed after backup');
      const now = new Date();
      const result = await Product.collection.bulkWrite(plan.plans.map(item => ({ updateOne: { filter: { _id: new mongoose.Types.ObjectId(item.id), updatedAt: new Date(item.updatedAt), ...targetFilter }, update: { $set: { ...item.update, updatedAt: now } } } })), { session, ordered: true });
      assert.equal(result.matchedCount, plan.plans.length);
      for (const user of related.carts) {
        const cartData = structuredClone(user.cartData || {}), cartAddedAt = structuredClone(user.cartAddedAt || {});
        for (const item of plan.plans) for (const size of item.removedKeys) {
          if (cartData[item.id]) { delete cartData[item.id][size]; if (!Object.keys(cartData[item.id]).length) delete cartData[item.id]; }
          if (cartAddedAt[item.id]) { delete cartAddedAt[item.id][size]; if (!Object.keys(cartAddedAt[item.id]).length) delete cartAddedAt[item.id]; }
        }
        const changed = await User.collection.updateOne({ _id: user._id, updatedAt: user.updatedAt }, { $set: { cartData, cartAddedAt, updatedAt: now } }, { session });
        assert.equal(changed.matchedCount, 1);
      }
      const saved = await Product.find({ _id: { $in: ids } }).sort({ _id: 1 }).session(session).lean();
      for (const product of saved) {
        const previous = products.find(row => String(row._id) === String(product._id));
        const expected = plan.plans.find(row => row.id === String(product._id)).update;
        assert.equal(removedKeys(product).length, 0);
        for (const [field, value] of Object.entries(expected)) assert.deepEqual(product[field], value, field);
        for (const field of Object.keys(previous)) if (!(field in expected) && field !== 'updatedAt') assert.deepEqual(product[field], previous[field], `Unexpected field change: ${field}`);
      }
    });
    const remaining = (await Product.find(targetFilter).select(selection).lean()).filter(product => removedKeys(product).length);
    assert.equal(remaining.length, 0, 'Test variants still present');
    const receipt = { database, appliedAt: new Date().toISOString(), totals: plan.totals, backupPath, remainingTestVariants: 0, verified: true };
    write('applied.json', receipt);
    fs.writeFileSync(path.join(backupPath, 'result.json'), JSON.stringify(receipt, null, 2));
    fs.writeFileSync(path.join(root, 'data/test-variant-removal.json'), JSON.stringify(receipt, null, 2) + '\n');
    console.log(JSON.stringify({ phase: 'committed', ...receipt }, null, 2));
  }
} finally { await mongoose.disconnect(); }
