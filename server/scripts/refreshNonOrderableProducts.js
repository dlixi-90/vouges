import 'dotenv/config';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import mongoose from 'mongoose';
import Product from '../models/Product.js';
import CatalogSource from '../models/CatalogSource.js';
import Order from '../models/Order.js';
import User from '../models/User.js';
import { planApanicheRefresh } from '../services/apanicheRefresh.js';
import { isSizeAvailable, getPurchaseLimit } from '../utils/productStock.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const directory = path.join(root, '.qa-perfume/source-refresh-2026-10-31');
const apply = process.argv.includes('--apply');
const verifyOnly = process.argv.includes('--verify');
const database = process.argv.find((arg) => arg.startsWith('--database='))?.slice(11);
const write = (name, value) => fs.writeFileSync(path.join(directory, name), JSON.stringify(value, null, 2));
const read = (name) => JSON.parse(fs.readFileSync(path.join(directory, name), 'utf8'));
const validPrice = (value) => Number.isSafeInteger(value) && value > 0;
const orderable = (product) => product.sizes.some((size) => validPrice(product.price?.[size]) && isSizeAvailable(product, size) && getPurchaseLimit(product, size) >= 1);
const visible = { isDeleted: { $ne: true }, isPublished: { $ne: false } };
const pendingFilter = (ids) => ({ paymentMethod: 'QR', isPaid: false, status: { $in: ['Awaiting Payment', 'Payment Review'] }, 'items.product': { $in: ids.map(String) } });
const ejson = (file, records) => fs.writeFileSync(file, mongoose.mongo.BSON.EJSON.stringify(records, null, 2, { relaxed: false }));
const csvCell = (value) => '"' + String(value ?? '').replace(/^[=+\-@]/, "'$&").replaceAll('"', '""') + '"';

async function checkReferences(plans, session) {
  const ids = plans.map((item) => item.id);
  const pending = await Order.find(pendingFilter(ids)).select('_id').session(session || null).lean();
  assert.equal(pending.length, 0, 'Pending QR orders reference target products; postpone this update');
  const cartFilter = { $or: ids.map((id) => ({ [`cartData.${id}`]: { $exists: true } })) };
  const carts = await User.find(cartFilter).select('_id cartData cartAddedAt updatedAt').session(session || null).lean();
  for (const plan of plans) for (const user of carts) for (const size of plan.removedSizes) {
    assert.ok(!(Number(user.cartData?.[plan.id]?.[size]) > 0), 'A removed capacity is still referenced by a cart');
  }
  return { carts, pending };
}

async function exportReport() {
  const products = await Product.find(visible).sort({ title: 1 }).lean();
  const blocked = products.filter((product) => !orderable(product));
  const byReason = {}, rows = [];
  for (const product of blocked) {
    const variants = product.sizes.map((size) => ({ size, price: product.price[size], quantity: product.stockBySize?.[size] ?? 0, enabled: product.inStockBySize?.[size] === true, purchaseLimit: getPurchaseLimit(product, size) }));
    const reasons = [];
    if (!variants.some((variant) => validPrice(variant.price))) reasons.push('Chưa có giá bán hợp lệ');
    if (!variants.some((variant) => variant.quantity > 0)) reasons.push('Hết tồn kho ở tất cả dung tích');
    if (!variants.some((variant) => variant.enabled)) reasons.push('Tất cả dung tích đang tắt');
    if (!product.inStock) reasons.push('Đang đánh dấu hết hàng');
    const primaryReason = reasons[0] || 'Cần kiểm tra cấu hình dung tích';
    byReason[primaryReason] = (byReason[primaryReason] || 0) + 1;
    rows.push({ id: String(product._id), title: product.title, brand: product.brand, category: product.category, primaryReason, reasons, sourceUrl: product.source?.url, variants });
  }
  const reportPath = path.join(root, '.qa-perfume/non-orderable-products-2026-10-31.csv');
  const report = { database: mongoose.connection.name, checkedAt: new Date().toISOString(), totalProducts: products.length, orderableProducts: products.length - blocked.length, partiallyOrderableProducts: products.filter((product) => orderable(product) && product.sizes.some((size) => !validPrice(product.price[size]) || !isSizeAvailable(product, size))).length, nonOrderableProducts: blocked.length, byReason, reportPath, products: rows };
  fs.writeFileSync(reportPath.replace(/\.csv$/, '.json'), JSON.stringify(report, null, 2));
  const headings = ['ID', 'Sản phẩm', 'Thương hiệu', 'Danh mục', 'Lý do chính', 'Các lý do', 'Dung tích, giá và tồn kho', 'Nguồn gốc'];
  const csvRows = rows.map((row) => [row.id, row.title, row.brand, row.category, row.primaryReason, row.reasons.join('; '), JSON.stringify(row.variants), row.sourceUrl]);
  fs.writeFileSync(reportPath, '\uFEFF' + [headings, ...csvRows].map((row) => row.map(csvCell).join(',')).join('\r\n'));
  console.log(JSON.stringify({ phase: 'verified', totalProducts: report.totalProducts, orderableProducts: report.orderableProducts, nonOrderableProducts: report.nonOrderableProducts, byReason, reportPath }));
  return report;
}

try {
  assert.equal(database, 'vouges', 'Explicit --database=vouges required');
  await mongoose.connect(process.env.MONGO_URI, { autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 15000 });
  assert.equal(mongoose.connection.name, database, 'Unexpected database');
  const targets = read('targets.json');
  const ids = targets.map((item) => new mongoose.Types.ObjectId(item.id));
  if (verifyOnly) {
    const receipt = read('applied.json');
    const saved = await Product.find({ _id: { $in: ids } }).lean();
    assert.equal(saved.length, targets.length);
    for (const product of saved) {
      const expected = receipt.plans.find((item) => item.id === String(product._id));
      for (const [field, value] of Object.entries(expected.update)) assert.deepEqual(product[field], value, `Unexpected persisted ${field}`);
    }
    await exportReport();
  } else if (!apply) {
    const fresh = read('results.json');
    assert.equal(fresh.length, targets.length);
    assert.ok(fresh.every((item) => item.status === 'ok' && Date.now() - Date.parse(item.fetchedAt) < 24 * 60 * 60 * 1000), 'Fresh complete source collection required');
    const products = await Product.find({ _id: { $in: ids }, ...visible }).lean();
    assert.equal(products.length, targets.length);
    const plans = products.map((product) => {
      assert.equal(orderable(product), false, 'Target has become orderable; refresh the audit first');
      const result = planApanicheRefresh(product, fresh.find((item) => item.sourceId === product.source.id));
      return { id: String(product._id), title: product.title, sourceId: product.source.id, updatedAt: product.updatedAt.toISOString(), ...result, becomesOrderable: orderable({ ...product, ...result.update }), priceMissing: !(result.update.sizes || product.sizes).some((size) => validPrice((result.update.price || product.price)[size])) };
    });
    const references = await checkReferences(plans);
    const totals = { products: plans.length, recoveredProducts: plans.filter((item) => item.becomesOrderable).length, remainingUnavailable: plans.filter((item) => !item.becomesOrderable).length, generatedQuantity: plans.reduce((sum, item) => sum + item.createdQuantity, 0), generatedStockRange: [1, 30], pricesBeforeMissing: products.filter((product) => !product.sizes.some((size) => validPrice(product.price[size]))).length, pricesAfterMissing: plans.filter((item) => item.priceMissing).length, removedSizes: plans.reduce((sum, item) => sum + item.removedSizes.length, 0), referencedCarts: references.carts.length, pendingQrOrders: references.pending.length };
    write('plan.json', { database, preparedAt: new Date().toISOString(), totals, plans });
    console.log(JSON.stringify({ phase: 'preview', databaseWrites: 0, ...totals }));
  } else {
    assert.ok(!fs.existsSync(path.join(directory, 'applied.json')), 'Already applied; use --verify');
    const plan = read('plan.json');
    assert.equal(plan.database, database);
    assert.equal(plan.plans.length, targets.length);
    assert.ok(Date.now() - Date.parse(plan.preparedAt) < 60 * 60 * 1000, 'Plan expired; preview again');
    const fresh = read('results.json');
    const products = await Product.find({ _id: { $in: ids } }).sort({ _id: 1 }).lean();
    const sources = await CatalogSource.find({ provider: 'apaniche', sourceId: { $in: targets.map((item) => item.sourceId) } }).sort({ _id: 1 }).lean();
    assert.equal(sources.length, targets.length);
    const references = await checkReferences(plan.plans);
    const backupPath = path.join(root, '.backups', `non-orderable-refresh-${new Date().toISOString().replaceAll(/[:.]/g, '-')}`);
    fs.mkdirSync(backupPath, { recursive: true });
    ejson(path.join(backupPath, 'products.ejson'), products);
    ejson(path.join(backupPath, 'catalog-sources.ejson'), sources);
    ejson(path.join(backupPath, 'carts.ejson'), references.carts);
    fs.copyFileSync(path.join(root, '.qa-perfume/non-orderable-products-2026-10-31.json'), path.join(backupPath, 'audit-before.json'));
    fs.copyFileSync(path.join(directory, 'plan.json'), path.join(backupPath, 'plan.json'));
    fs.copyFileSync(path.join(directory, 'results.json'), path.join(backupPath, 'fresh-source.json'));
    await mongoose.connection.transaction(async (session) => {
      await checkReferences(plan.plans, session);
      const before = await Product.find({ _id: { $in: ids } }).sort({ _id: 1 }).session(session).lean();
      assert.ok(isDeepStrictEqual(before, products), 'Products changed after backup');
      const currentSources = await CatalogSource.find({ _id: { $in: sources.map((item) => item._id) } }).sort({ _id: 1 }).session(session).lean();
      assert.ok(isDeepStrictEqual(currentSources, sources), 'Source records changed after backup');
      const now = new Date();
      const operations = plan.plans.map((item) => ({ updateOne: { filter: { _id: new mongoose.Types.ObjectId(item.id), updatedAt: new Date(item.updatedAt), ...visible }, update: { $set: { ...item.update, updatedAt: now } } } }));
      const changed = await Product.collection.bulkWrite(operations, { session, ordered: true });
      assert.equal(changed.matchedCount, plan.plans.length, 'Concurrent product changes; aborting');
      const sourceOperations = sources.map((source) => {
        const current = fresh.find((item) => item.sourceId === source.sourceId);
        const data = { ...source.data, ...current.parent, detailStatus: 'ok', detail: { sourceId: source.sourceId, status: 'ok', fetchedAt: current.fetchedAt, sourceUrl: current.parent.sourceUrl, data: current.data }, variantSupplements: [], refreshProvenance: { scope: 'non_orderable_products', refreshedAt: now.toISOString() } };
        return { updateOne: { filter: { _id: source._id, updatedAt: source.updatedAt }, update: { $set: { data, fetchedAt: new Date(current.fetchedAt), sourceUrl: current.parent.sourceUrl, updatedAt: now } } } };
      });
      const sourceChanged = await CatalogSource.collection.bulkWrite(sourceOperations, { session, ordered: true });
      assert.equal(sourceChanged.matchedCount, sources.length);
      const after = await Product.find({ _id: { $in: ids } }).session(session).lean();
      for (const product of after) {
        const previous = products.find((item) => String(item._id) === String(product._id));
        const expected = plan.plans.find((item) => item.id === String(product._id));
        const allowed = new Set([...Object.keys(expected.update), 'updatedAt']);
        for (const field of new Set([...Object.keys(product), ...Object.keys(previous)])) if (!allowed.has(field)) assert.deepEqual(product[field], previous[field], `Unexpected change to ${field}`);
        for (const [field, value] of Object.entries(expected.update)) assert.deepEqual(product[field], value);
        assert.equal(orderable(product), expected.becomesOrderable);
      }
    });
    const receipt = { ...plan, appliedAt: new Date().toISOString(), backupPath, verified: true };
    write('applied.json', receipt);
    fs.writeFileSync(path.join(backupPath, 'result.json'), JSON.stringify(receipt, null, 2));
    console.log(JSON.stringify({ phase: 'committed', ...plan.totals, backupPath }));
    const report = await exportReport();
    fs.writeFileSync(path.join(root, 'data/non-orderable-source-refresh.json'), JSON.stringify({ database, appliedAt: receipt.appliedAt, source: 'https://apaniche.vn', totals: plan.totals, generatedStock: { minimum: 1, maximum: 30, provenance: 'User-authorized random initialization; not supplier warehouse inventory' }, remainingNonOrderableProducts: report.nonOrderableProducts, backupPath, verified: true }, null, 2) + '\n');
  }
} finally { await mongoose.disconnect(); }
