import test from "node:test";
import assert from "node:assert/strict";
import {
  FREE_SHIPPING_THRESHOLD,
  getOrderTotal,
  getShippingCharge,
  SHIPPING_METHODS,
  getShippingPricing,
} from "../../utils/orderPricing.js";
import { FREE_SHIPPING_THRESHOLD as CLIENT_THRESHOLD, SHIPPING_METHODS as CLIENT_METHODS } from "../../../client/src/utils/orderPricing.js";
import { hasAnyEnabledSize } from "../../utils/productStock.js";
import Product from "../../models/Product.js";
import { toggleStock } from "../../controllers/productController.js";
import { getProductPriceRange } from "../../../client/src/utils/productPrice.js";
import { formatVnd } from "../../../client/src/utils/money.js";

test("product cards show the lowest and highest variant prices in VND regardless of variant order", () => {
  const range = getProductPriceRange({ sizes: ["100ml", "10ml", "50ml"], price: { "100ml": 3950000, "10ml": 350000, "50ml": 2150000 } });
  assert.deepEqual(range, { min: 350000, max: 3950000 });
  assert.equal(`${formatVnd(range.min)} - ${formatVnd(range.max)}`, "350.000 ₫ - 3.950.000 ₫");
});

test("one price or multiple equal prices have a single display value", () => {
  assert.deepEqual(getProductPriceRange({ sizes: ["50ml"], price: { "50ml": 1000000 } }), { min: 1000000, max: 1000000 });
  assert.deepEqual(getProductPriceRange({ sizes: ["50ml", "100ml"], price: { "50ml": 1000000, "100ml": 1000000 } }), { min: 1000000, max: 1000000 });
});

test("a product-wide price range includes sold-out sizes and ignores removed size keys", () => {
  assert.deepEqual(getProductPriceRange({ sizes: ["10ml", "100ml"], price: { "10ml": 350000, "100ml": 3950000, removed: 9000000 },
    stockBySize: { "10ml": 1, "100ml": 0 }, displaySize: "10ml" }), { min: 350000, max: 3950000 });
});

test("missing and invalid prices cannot create a free, negative or infinite price on cards", () => {
  assert.equal(getProductPriceRange({ price: { a: 0, b: -100, c: null, d: true, e: "", f: Infinity, g: "bad" } }), null);
  assert.equal(getProductPriceRange(null), null);
  assert.deepEqual(getProductPriceRange({ price: { a: "350000", b: 3950000 } }), { min: 350000, max: 3950000 });
});

test("standard shipping is free from 1,000,000 VND before vouchers; express retains its fee", () => {
  assert.equal(FREE_SHIPPING_THRESHOLD, 1000000);
  assert.equal(getShippingCharge(999999), 30000);
  assert.equal(getShippingCharge(1000000), 0);
  assert.equal(getShippingCharge(0), 30000);
  assert.equal(getOrderTotal(500000), 530000);
  assert.equal(getOrderTotal(1000000), 1000000);
  assert.equal(getShippingCharge(1000000, "express"), 50000);
  assert.throws(() => getShippingCharge(500, "unknown"), /không hợp lệ/);
});

test("whole VND pricing preserves exact bank amounts and rejects totals outside safe integer bounds",()=>{
  assert.equal(getShippingPricing(1250000,0,"express").amount,1300000);
  assert.throws(()=>getShippingPricing(Number.MAX_SAFE_INTEGER,0,"express"),/giới hạn/);
});

test("urgent shipping has a deferred carrier fee and client options match server options", () => {
  assert.equal(CLIENT_THRESHOLD, FREE_SHIPPING_THRESHOLD);
  assert.deepEqual(CLIENT_METHODS, SHIPPING_METHODS);
  assert.equal(SHIPPING_METHODS.find((method) => method.id === "urgent").fee, null);
  for (const subtotal of [0, 500000, 1000000, 2000000]) assert.equal(getShippingCharge(subtotal, "urgent"), 0);
});

test("master stock follows whether at least one stocked size is enabled", () => {
  const product = {
    sizes: ["S", "M"],
    stockBySize: { S: 2, M: 3 },
    inStockBySize: { S: false, M: false },
  };

  assert.equal(hasAnyEnabledSize(product), false);
  product.inStockBySize.M = true;
  assert.equal(hasAnyEnabledSize(product), true);
  product.stockBySize.M = 0;
  assert.equal(hasAnyEnabledSize(product), false);
});

const setupStockToggle = (t, inStockBySize, stockBySize = { S: 2, M: 3, L: 0 }) => {
  const product = new Product({
    _id: "507f1f77bcf86cd799439011",
    sizes: ["S", "M", "L"],
    stockBySize,
    inStock: true,
    inStockBySize,
  });
  t.mock.method(Product, "findOne", async () => product);
  let savedProduct;
  t.mock.method(product, "save", async () => {
    assert.equal(product.isModified("inStockBySize"), true);
    savedProduct = product.toObject();
    return product;
  });
  return {
    saved: () => savedProduct,
    toggle: async (inStock, size) => {
      const res = {
        statusCode: 200,
        status(code) { this.statusCode = code; return this; },
        json(body) { this.body = body; return this; },
      };
      await toggleStock({
        user: { role: "owner" },
        body: { productId: String(product._id), inStock, ...(size && { size }) },
      }, res);
      return res;
    },
  };
};

for (const statuses of [{ S: true, M: false, L: true }, {}]) {
  test(`turning off master persists every size as off (${Object.keys(statuses).length ? "explicit" : "legacy"} flags)`, async (t) => {
    const { toggle, saved } = setupStockToggle(t, statuses);
    const res = await toggle(false);
    assert.equal(res.body.success, true);
    assert.equal(saved().inStock, false);
    assert.deepEqual(saved().inStockBySize, { S: false, M: false, L: false });
    assert.deepEqual(saved().stockBySize, { S: 2, M: 3, L: 0 });
    assert.deepEqual(res.body.product.inStockBySize, saved().inStockBySize);
  });
}

test("after master is off, enabling one stocked size restores only that size and master", async (t) => {
  const { toggle, saved } = setupStockToggle(t, { S: true, M: true });
  await toggle(false);
  const res = await toggle(true, "M");
  assert.equal(res.body.success, true);
  assert.equal(saved().inStock, true);
  assert.deepEqual(saved().inStockBySize, { S: false, M: true, L: false });
  await toggle(false, "M");
  assert.equal(saved().inStock, false);
});

test("master can reactivate all stocked sizes after every size is switched off", async (t) => {
  const { toggle, saved } = setupStockToggle(t, { S: true, M: true });
  await toggle(false);
  const res = await toggle(true);
  assert.equal(res.body.success, true);
  assert.equal(saved().inStock, true);
  assert.deepEqual(saved().inStockBySize, { S: true, M: true, L: false });
  assert.deepEqual(saved().stockBySize, { S: 2, M: 3, L: 0 });
  assert.equal((await toggle(true, "L")).statusCode, 400);
});

test("master enables previously disabled stocked sizes and leaves empty sizes off", async (t) => {
  const { toggle, saved } = setupStockToggle(t, { S: true, M: false, L: true });
  assert.equal((await toggle(true)).body.success, true);
  assert.deepEqual(saved().inStockBySize, { S: true, M: true, L: false });
});

test("master cannot activate when all sizes have zero quantity", async (t) => {
  const { toggle, saved } = setupStockToggle(t, {}, { S: 0, M: 0, L: 0 });
  await toggle(false);
  assert.equal((await toggle(true)).statusCode, 400);
  assert.equal(saved().inStock, false);
  assert.deepEqual(saved().inStockBySize, { S: false, M: false, L: false });
});
