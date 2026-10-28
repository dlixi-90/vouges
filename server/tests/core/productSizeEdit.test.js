import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import Product from "../../models/Product.js";
import Category from "../../models/Category.js";
import Order from "../../models/Order.js";
import User from "../../models/User.js";
import { updateProduct } from "../../controllers/productController.js";
import { getSizeRenames, buildCartSizeRename } from "../../utils/productVariants.js";
import { saveCatalogProduct } from "../../controllers/catalogController.js";
import CatalogSource from "../../models/CatalogSource.js";
import { renameCatalogSize, catalogSizeRenames } from "../../../client/src/utils/catalogVariantEdit.js";

const id = "507f1f77bcf86cd799439011";
const updatedAt = new Date("2026-09-01T00:00:00Z");
const makeRequest = (overrides = {}) => ({
  params: { productId: id },
  files: [],
  body: { productData: JSON.stringify({
    title: "Product", description: "Description", category: "Care", type: "Lotion",
    sizes: ["Large"], price: { Large: 100 }, stockBySize: { Large: 6 },
    existingImages: ["image.png"], sizeRenames: [{ from: "M", to: "Large" }],
    expectedUpdatedAt: updatedAt.toISOString(), ...overrides,
  }) },
});
const response = () => ({
  statusCode: 200,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});

const setup = (t, { pendingQr = false, stale = false } = {}) => {
  const session = {};
  t.mock.method(Product, "findOne", async () => ({
    _id: id, updatedAt, sizes: ["M"], images: ["image.png"],
    inStock: true, inStockBySize: { M: false },
  }));
  t.mock.method(Category, "findOne", async () => ({
    name: "Care", types: [{ name: "Lotion", nameKey: "lotion" }],
  }));
  t.mock.method(mongoose.connection, "transaction", async (callback) => callback(session));
  const reservation = t.mock.method(Order, "exists", (filter) => {
    assert.equal(filter.items.$elemMatch.product, id);
    assert.ok(filter.items.$elemMatch.size.$in.includes("M"));
    return { session: async () => pendingQr ? { _id: "reserved_order" } : null };
  });
  const save = t.mock.method(Product, "findOneAndUpdate", async (_filter, data, options) => {
    assert.equal(options.session, session);
    return stale ? null : { _id: id, ...data };
  });
  const carts = t.mock.method(User, "updateMany", async (_filter, _data, options) => {
    assert.equal(options.session, session);
    assert.equal(options.updatePipeline, true);
  });
  const orders = t.mock.method(Order, "updateMany", async () => { throw new Error("Order history must not change"); });
  return { save, carts, orders, reservation };
};

test("admin rename keeps price, stock and disabled availability under the new size", async (t) => {
  const { carts, orders } = setup(t);
  const res = response();
  await updateProduct(makeRequest(), res);
  assert.equal(res.body.success, true);
  assert.deepEqual(res.body.product.sizes, ["Large"]);
  assert.deepEqual(res.body.product.price, { Large: 100 });
  assert.deepEqual(res.body.product.stockBySize, { Large: 6 });
  assert.deepEqual(res.body.product.inStockBySize, { Large: false });
  assert.equal(carts.mock.callCount(), 1);
  assert.equal(orders.mock.callCount(), 0);
});

test("product edit accepts only a type ID and stores the category resolved by the server", async (t) => {
  setup(t);
  const typeId = "507f1f77bcf86cd799439012";
  t.mock.method(Category, "findOne", async () => ({
    name: "Hair Care", types: [{ _id: typeId, name: "Shampoo", nameKey: "shampoo" }],
  }));
  const res = response();
  await updateProduct(makeRequest({ typeId, category: undefined, type: undefined }), res);
  assert.equal(res.body.success, true);
  assert.equal(res.body.product.category, "Hair Care");
  assert.equal(res.body.product.type, "Shampoo");
  assert.equal(Object.hasOwn(res.body.product, "typeId"), false);
});

test("rename is blocked while QR holds the old size, before any writes", async (t) => {
  const { save, carts } = setup(t, { pendingQr: true });
  const res = response();
  await updateProduct(makeRequest(), res);
  assert.equal(res.statusCode, 409);
  assert.match(res.body.message, /QR/);
  assert.equal(save.mock.callCount(), 0);
  assert.equal(carts.mock.callCount(), 0);
});

test("concurrent product changes prevent stale inventory overwrites and cart migration", async (t) => {
  const { carts } = setup(t, { stale: true });
  const res = response();
  await updateProduct(makeRequest(), res);
  assert.equal(res.statusCode, 409);
  assert.equal(carts.mock.callCount(), 0);
});

test("a form loaded before another inventory change is rejected before saving", async (t) => {
  const { save, carts } = setup(t);
  const res = response();
  await updateProduct(makeRequest({ expectedUpdatedAt: "2026-08-01T00:00:00Z" }), res);
  assert.equal(res.statusCode, 409);
  assert.equal(save.mock.callCount(), 0);
  assert.equal(carts.mock.callCount(), 0);
});

test("blank, duplicate and unsafe size names cannot be saved", async (t) => {
  const { save, carts } = setup(t);
  for (const sizes of [[""], ["Large", "large"], ["a.b"], ["$M"], ["__proto__"]]) {
    const res = response();
    await updateProduct(makeRequest({ sizes }), res);
    assert.equal(res.statusCode, 400);
  }
  assert.equal(save.mock.callCount(), 0);
  assert.equal(carts.mock.callCount(), 0);
});

test("normal price and stock edits do not migrate cart size keys", async (t) => {
  const { carts, reservation } = setup(t);
  const res = response();
  await updateProduct(makeRequest({ sizes: ["M"], price: { M: 80 }, stockBySize: { M: 4 }, sizeRenames: [] }), res);
  assert.equal(res.body.success, true);
  assert.equal(carts.mock.callCount(), 0);
  assert.equal(reservation.mock.callCount(), 0);
});

test("rename mapping rejects copied and unknown source rows, and supports swapping names", () => {
  const current = { sizes: ["S", "M"] };
  for (const sizeRenames of [
    [{ from: "XL", to: "L" }],
    [{ from: "S", to: "L" }, { from: "M", to: "L" }],
    [{ from: "S", to: "L" }],
  ]) {
    assert.throws(() => getSizeRenames({ sizeRenames }, current, ["S", "M", "L"]));
  }
  const swap = [{ from: "S", to: "M" }, { from: "M", to: "S" }];
  assert.deepEqual(getSizeRenames({ sizeRenames: swap }, current, ["S", "M"]), swap);
});

const perfume = () => ({ _id: id, updatedAt, title: "Perfume", catalogScope: "perfume", inventoryMode: "tracked", sizes: ["100ml", "50ml"],
  price: { "100ml": 1600000, "50ml": 900000 }, stockBySize: { "100ml": 6, "50ml": 0 }, inStockBySize: { "100ml": false, "50ml": false },
  sizeImages: { "100ml": "https://example.com/100ml.webp" }, variantMetadata: { "100ml": { sourceId: 123, sku: "SOURCE-100" } },
  images: ["https://example.com/avatar.webp"], fragrance: {}, qualityIssues: [], brand: "Chanel", concentration: "EDP" });

test("catalog rename draft carries price, stock, image and metadata through repeated edits without changing the original", () => {
  const original = perfume(), before = structuredClone(original);
  const first = renameCatalogSize(original, "100ml", " 100ml Test ");
  const final = renameCatalogSize(first, "100ml Test", "75ml");
  for (const field of ["price", "stockBySize", "inStockBySize", "sizeImages", "variantMetadata"]) {
    assert.deepEqual(final[field]["75ml"], original[field]["100ml"]);
    assert.equal(Object.hasOwn(final[field], "100ml"), false);
    assert.equal(Object.hasOwn(final[field], "100ml Test"), false);
  }
  assert.deepEqual(catalogSizeRenames(final), [{ from: "100ml", to: "75ml" }]);
  assert.deepEqual(original, before);
  assert.deepEqual(catalogSizeRenames(renameCatalogSize(final, "75ml", "100ml")), []);
});

test("catalog rename rejects blank, duplicate and unsafe names; new rows do not invent persisted renames", () => {
  const original = perfume();
  for (const name of ["", "  ", "50ML", "bad.name", "$bad", "__proto__", "constructor", "prototype", "x".repeat(51)]) {
    assert.throws(() => renameCatalogSize(original, "100ml", name));
  }
  assert.equal(renameCatalogSize(original, "100ml", "100ml"), original);
  const draft = { ...original, sizes: [...original.sizes, "30"], sizeOrigins: { "100ml": "100ml", "50ml": "50ml", "30": null }, price: { ...original.price, "30": 300000 } };
  const renamed = renameCatalogSize(draft, "30", "30ml");
  assert.deepEqual(catalogSizeRenames(renamed), []); assert.equal(renamed.price["30ml"], 300000);
});

const catalogSetup = (t, { pendingQr = false, stale = false } = {}) => {
  const current = perfume(), session = {};
  t.mock.method(Product, "findOne", async () => current);
  const transaction = t.mock.method(mongoose.connection, "transaction", async callback => callback(session));
  const hold = t.mock.method(Order, "exists", filter => {
    assert.equal(filter.items.$elemMatch.product, id);
    assert.ok(filter.items.$elemMatch.size.$in.includes("100ml"));
    return { session: async selected => { assert.equal(selected, session); return pendingQr ? { _id: "held" } : null; } };
  });
  const save = t.mock.method(Product, "findOneAndUpdate", async (filter, { $set }, options) => {
    assert.deepEqual(filter, { _id: id, updatedAt }); assert.equal(options.session, session);
    return stale ? null : { ...current, ...$set };
  });
  const carts = t.mock.method(User, "updateMany", async (filter, pipeline, options) => {
    assert.equal(options.session, session); assert.equal(options.updatePipeline, true);
    assert.ok(filter.$or.some(row => Object.hasOwn(row, `cartData.${id}.100ml`)));
    assert.ok(pipeline[0].$set[`cartAddedAt.${id}.75ml`]);
  });
  t.mock.method(Order, "updateMany", () => assert.fail("Order history is immutable"));
  t.mock.method(CatalogSource, "updateOne", () => assert.fail("Original catalog source is immutable"));
  const request = patch => ({ method: "PATCH", params: { id }, body: { expectedUpdatedAt: updatedAt.toISOString(), sizes: ["75ml", "50ml"], sizeRenames: [{ from: "100ml", to: "75ml" }], ...patch } });
  return { current, request, hold, save, carts, transaction };
};

test("catalog save renames stored variant data and saved carts atomically while preserving disabled status and source metadata", async t => {
  const { request, current, carts, transaction } = catalogSetup(t);
  const res = response(); await saveCatalogProduct(request(), res);
  assert.equal(res.body.success, true); assert.equal(transaction.mock.callCount(), 1);
  for (const field of ["price", "stockBySize", "inStockBySize", "sizeImages", "variantMetadata"]) {
    assert.deepEqual(res.body.product[field]["75ml"], current[field]["100ml"]);
    assert.equal(Object.hasOwn(res.body.product[field], "100ml"), false);
  }
  assert.equal(carts.mock.callCount(), 1);
  assert.equal(res.body.product.inStockBySize["75ml"], false);
});

test("catalog rename honors simultaneous new price, stock, availability and image edits", async t => {
  const { request } = catalogSetup(t);
  const res = response(); await saveCatalogProduct(request({ price: { "75ml": 1200000 }, stockBySize: { "75ml": 3 }, inStockBySize: { "75ml": true }, sizeImages: { "75ml": null } }), res);
  assert.equal(res.body.success, true);
  assert.equal(res.body.product.price["75ml"], 1200000); assert.equal(res.body.product.stockBySize["75ml"], 3);
  assert.equal(res.body.product.inStockBySize["75ml"], true); assert.equal(res.body.product.sizeImages["75ml"], undefined);
});

test("catalog rename is blocked before writes when QR still holds the old capacity", async t => {
  const { request, save, carts } = catalogSetup(t, { pendingQr: true });
  const res = response(); await saveCatalogProduct(request(), res);
  assert.equal(res.statusCode, 409); assert.match(res.body.message, /QR/);
  assert.equal(save.mock.callCount(), 0); assert.equal(carts.mock.callCount(), 0);
});

test("stale catalog writes never migrate cart sizes", async t => {
  const { request, carts } = catalogSetup(t, { stale: true });
  const res = response(); await saveCatalogProduct(request(), res);
  assert.equal(res.statusCode, 409); assert.equal(carts.mock.callCount(), 0);
});

test("catalog rejects unknown rename sources and duplicate targets before opening a transaction", async t => {
  const { request, transaction, save, carts } = catalogSetup(t);
  for (const sizeRenames of [[{ from: "wrong", to: "75ml" }], [{ from: "100ml", to: "75ml" }, { from: "50ml", to: "75ml" }]]) {
    const res = response(); await saveCatalogProduct(request({ sizeRenames }), res); assert.equal(res.statusCode, 400);
  }
  assert.equal(transaction.mock.callCount(), 0); assert.equal(save.mock.callCount(), 0); assert.equal(carts.mock.callCount(), 0);
});

test("cart rename moves ordering timestamps alongside quantities, including simultaneous swaps", () => {
  const { pipeline } = buildCartSizeRename(id, [{ from: "100ml", to: "75ml" }]);
  assert.deepEqual(pipeline[1].$unset, [`cartData.${id}.100ml`, `cartAddedAt.${id}.100ml`]);
  assert.equal(pipeline[0].$set[`cartAddedAt.${id}.75ml`].$ifNull[0], `$cartAddedAt.${id}.100ml`);
  const swapped = buildCartSizeRename(id, [{ from: "100ml", to: "50ml" }, { from: "50ml", to: "100ml" }]);
  assert.equal(swapped.pipeline.length, 1);
  assert.equal(swapped.pipeline[0].$set[`cartData.${id}.50ml`].$add[1], 0);
  assert.equal(swapped.pipeline[0].$set[`cartAddedAt.${id}.50ml`].$ifNull[0], `$cartAddedAt.${id}.100ml`);
});
