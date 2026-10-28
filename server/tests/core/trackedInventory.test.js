import test from "node:test";
import assert from "node:assert/strict";
import { planTrackedInventory } from "../../services/trackedInventory.js";
import { getRemainingPurchaseQuantity, MAX_CART_ADD_QUANTITY } from "../../../client/src/utils/purchaseQuantity.js";
import * as clientStock from "../../../client/src/utils/productStock.js";
import * as serverStock from "../../utils/productStock.js";
import { addToCart } from "../../controllers/cartController.js";
import { quoteOrder } from "../../controllers/orderController.js";
import Product from "../../models/Product.js";
import User from "../../models/User.js";

const id = "507f1f77bcf86cd799439011";
const row = () => ({ _id: id, title: "Nước hoa", inventoryMode: "source", inStock: true, isPublished: true, sizes: ["50ml", "100ml", "150ml"], stockBySize: { "50ml": 12, "100ml": 30, "150ml": 0 }, inStockBySize: { "50ml": true, "100ml": true, "150ml": true }, price: { "50ml": 1000000, "100ml": 2000000, "150ml": 3000000 } });
const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });

test("switching to tracked inventory preserves quantities/prices and disables empty variants without enabling hidden ones", () => {
  const source = row(), before = structuredClone(source);
  source.isPublished = false;before.isPublished = false;
  source.inStockBySize["100ml"] = false;before.inStockBySize["100ml"] = false;
  const plan = planTrackedInventory([source]);
  assert.deepEqual(plan.changes[0].update, { inventoryMode: "tracked", inStock: true, inStockBySize: { "50ml": true, "100ml": false, "150ml": false } });
  assert.equal(plan.totals.totalQuantity, 42);
  assert.deepEqual(source, before);
  assert.throws(() => planTrackedInventory([{ ...source, stockBySize: { ...source.stockBySize, "50ml": -1 } }]), /Invalid stored quantity/);
});

test("remaining product quantity is the selected size stock minus the quantity already in cart", () => {
  const product = { ...row(), inventoryMode: "tracked" };
  assert.equal(getRemainingPurchaseQuantity(product, "50ml"), 12);
  assert.equal(getRemainingPurchaseQuantity(product, "50ml", 5), 7);
  assert.equal(getRemainingPurchaseQuantity(product, "50ml", 12), 0);
  assert.equal(getRemainingPurchaseQuantity(product, "50ml", 20), 0);
  assert.equal(getRemainingPurchaseQuantity(product, "100ml"), 30);
  assert.equal(getRemainingPurchaseQuantity(product, "150ml"), 0);
  assert.equal(getRemainingPurchaseQuantity({ ...product, inStock: false }, "50ml"), 0);
  assert.equal(MAX_CART_ADD_QUANTITY, 100);
  for (const size of product.sizes) assert.equal(clientStock.getPurchaseLimit(product, size), serverStock.getPurchaseLimit(product, size));
});

test("invalid saved quantities cannot become purchase limits", () => {
  for (const invalid of [-1, 1.5, Infinity, NaN, Number.MAX_SAFE_INTEGER + 1]) {
    const product = { ...row(), inventoryMode: "tracked", stockBySize: { "50ml": invalid } };
    assert.equal(clientStock.getSizeQuantity(product, "50ml"), 0);
    assert.equal(serverStock.getSizeQuantity(product, "50ml"), 0);
  }
});

test("cart accepts a quantity above ten when stock permits, and rejects additions beyond stock atomically", async t => {
  const product = { ...row(), inventoryMode: "tracked" };
  t.mock.method(Product, "findOne", async () => product);
  const writes = [];
  t.mock.method(User, "findOneAndUpdate", async (filter, update) => {
    writes.push({ filter, update });
    return { cartData: { [id]: { "100ml": 25 } } };
  });
  const req = quantity => ({ auth: () => ({ userId: "customer" }), user: { _id: "customer", cartData: {} }, body: { itemId: id, size: "100ml", quantity } });
  const valid = response();await addToCart(req(25), valid);
  assert.equal(valid.body.success, true);
  assert.equal(writes[0].filter.$or[1][`cartData.${id}.100ml`].$lte, 5);
  const invalid = response();await addToCart(req(31), invalid);
  assert.equal(invalid.statusCode, 400);assert.equal(writes.length, 1);
});

test("checkout rejects stock overflow including duplicate lines before quoting a price", async t => {
  t.mock.method(Product, "find", async () => [{ ...row(), inventoryMode: "tracked" }]);
  const res = response();
  await quoteOrder({ user: { _id: "customer" }, body: { items: [{ product: id, size: "50ml", quantity: 8 }, { product: id, size: "50ml", quantity: 5 }], shippingMethod: "standard" } }, res);
  assert.equal(res.statusCode, 400);assert.match(res.body.message, /12/);
});
