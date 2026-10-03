import test from "node:test";
import assert from "node:assert/strict";
import {
  FREE_SHIPPING_THRESHOLD,
  getOrderTotal,
  getShippingCharge,
} from "../../utils/orderPricing.js";
import { hasAnyEnabledSize } from "../../utils/productStock.js";
import Product from "../../models/Product.js";
import { toggleStock } from "../../controllers/productController.js";

test("standard shipping is free from 500,000 VND; express retains its fee", () => {
  assert.equal(FREE_SHIPPING_THRESHOLD, 500);
  assert.equal(getShippingCharge(499.99), 30);
  assert.equal(getShippingCharge(500), 0);
  assert.equal(getOrderTotal(500), 500);
  assert.equal(getShippingCharge(1000, "express"), 50);
  assert.throws(() => getShippingCharge(500, "unknown"), /không hợp lệ/);
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
