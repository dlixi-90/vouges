import test from "node:test";
import assert from "node:assert/strict";
import { planInitialStock, planVariedStock, planRangeStock } from "../../services/initialStock.js";

const product = () => ({ _id: "one", inventoryMode: "source", inStock: true, isPublished: true, sizes: ["50ml", "100ml"], price: { "50ml": 1500000, "100ml": 2000000 }, stockBySize: { "50ml": 0, "100ml": 0 }, inStockBySize: { "50ml": true, "100ml": false } });

test("initializes each available size and leaves sold-out sizes zero without changing the product", () => {
  const input = product(), before = structuredClone(input);
  const plan = planInitialStock([input], 3);
  assert.deepEqual(plan.changes[0].stock, { "50ml": 3, "100ml": 0 });
  assert.deepEqual(plan.totals, { products: 1, changedProducts: 1, variants: 2, stockedVariants: 1, zeroVariants: 1, totalQuantity: 3 });
  assert.deepEqual(input, before);
});

test("product-level sold-out and zero-price flags both prevent positive stock", () => {
  const soldOut = { ...product(), inStock: false };
  const noPrice = { ...product(), price: { "50ml": 0, "100ml": 0 } };
  const plan = planInitialStock([soldOut, noPrice], 3);
  assert.equal(plan.totals.totalQuantity, 0);
  assert.equal(plan.totals.zeroVariants, 4);
});

test("hidden products can carry internal inventory without being published", () => {
  const hidden = { ...product(), isPublished: false };
  const plan = planInitialStock([hidden], 3);
  assert.equal(plan.changes[0].stock["50ml"], 3);
  assert.equal(hidden.isPublished, false);
});

test("refuses to overwrite existing inventory or initialize tracked stock", () => {
  assert.throws(() => planInitialStock([{ ...product(), stockBySize: { "50ml": 2 } }], 3), /overwritten/);
  assert.throws(() => planInitialStock([{ ...product(), inventoryMode: "tracked" }], 3), /tracked/);
  for (const quantity of [0, -1, 1.5, NaN, Infinity]) assert.throws(() => planInitialStock([product()], quantity), /positive integer/);
});

test("varied stock stays small, follows price bands, and remains stable per product/size", () => {
  const products = [500000, 1000000, 4999999, 5000000, 20000000].flatMap(price => Array.from({ length: 40 }, (_, index) => ({
    ...product(), _id: `${price}-${index}`, price: { "50ml": price, "100ml": price }, stockBySize: { "50ml": 3, "100ml": 0 },
  })));
  const before = structuredClone(products);
  const plan = planVariedStock(products, 3);
  assert.deepEqual(plan, planVariedStock(products, 3));
  assert.deepEqual(products, before);
  for (const { product: source, stock } of plan.changes) {
    const amount = source.price["50ml"], quantity = stock["50ml"];
    assert.ok(amount >= 5000000 ? quantity >= 1 && quantity <= 2 : amount >= 1000000 ? quantity >= 2 && quantity <= 4 : quantity >= 3 && quantity <= 5);
    assert.equal(stock["100ml"], 0);
  }
  for (const quantity of [1, 2, 3, 4, 5]) assert.ok(plan.totals.quantities[quantity] > 0);
  assert.equal(plan.totals.zeroVariants, 200);
  assert.equal(Object.values(plan.totals.quantities).reduce((sum, count) => sum + count, 0), plan.totals.variants);
});

test("varying stock preserves sold-out products and refuses intervening stock edits", () => {
  const soldOut = { ...product(), inStock: false };
  assert.equal(planVariedStock([soldOut], 3).totals.totalQuantity, 0);
  assert.throws(() => planVariedStock([{ ...product(), stockBySize: { "50ml": 7, "100ml": 0 } }], 3), /refusing to overwrite/);
  assert.throws(() => planVariedStock([{ ...product(), inventoryMode: "tracked" }], 3), /tracked/);
});

test("range allocation spans 1 through 30 for available sizes and leaves sold-out sizes zero", () => {
  const uniform = Array.from({ length: 1000 }, (_, index) => ({ ...product(), _id: `range-${index}`, stockBySize: { "50ml": 3, "100ml": 0 } }));
  const products = planVariedStock(uniform, 3).changes.map(({ product: row, stock }) => ({ ...row, stockBySize: stock }));
  const before = structuredClone(products);
  const plan = planRangeStock(products);
  assert.deepEqual(plan, planRangeStock(products));
  assert.deepEqual(products, before);
  for (const { stock } of plan.changes) {
    assert.ok(Number.isSafeInteger(stock["50ml"]) && stock["50ml"] >= 1 && stock["50ml"] <= 30);
    assert.equal(stock["100ml"], 0);
  }
  for (let quantity = 1; quantity <= 30; quantity++) assert.ok(plan.totals.quantities[quantity] > 0);
  assert.equal(plan.totals.zeroVariants, 1000);
  assert.equal(planRangeStock([{ ...product(), inStock: false }]).totals.totalQuantity, 0);
  assert.throws(() => planRangeStock([{ ...products[0], stockBySize: { "50ml": 31, "100ml": 0 } }]), /refusing to overwrite/);
  assert.throws(() => planRangeStock([{ ...products[0], inventoryMode: "tracked" }]), /tracked/);
});
