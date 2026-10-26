import test from "node:test";
import assert from "node:assert/strict";
import Order from "../../models/Order.js";
import { getOrderStatus } from "../../controllers/orderController.js";

const orderId = "507f1f77bcf86cd799439011";
const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });
const request = (extra = {}) => ({ auth: () => ({ userId: "customer" }), user: { role: "user" }, params: { orderId }, query: { overview: "true" }, ...extra });
const mockOrder = (t, order) => {
  t.mock.method(Order, "exists", async () => false);
  t.mock.method(Order, "findById", async () => order);
};

test("overview validates order IDs before reading or populating records", async (t) => {
  const find = t.mock.method(Order, "findById", async () => { throw new Error("must not read"); });
  const res = response();
  await getOrderStatus(request({ params: { orderId: "invalid" } }), res);
  assert.equal(res.statusCode, 400);
  assert.equal(find.mock.callCount(), 0);
});

test("overview refuses another customer's order before loading delivery details", async (t) => {
  let populated = false;
  mockOrder(t, { userId: "another_customer", populate: async () => { populated = true; } });
  const res = response();
  await getOrderStatus(request(), res);
  assert.equal(res.statusCode, 403);
  assert.equal(populated, false);
  assert.equal(res.body.order, undefined);
});

test("overview returns a missing-order response without exposing delivery data", async (t) => {
  mockOrder(t, null);
  const res = response();
  await getOrderStatus(request(), res);
  assert.equal(res.statusCode, 404);
  assert.equal(res.body.order, undefined);
});

test("overview loads the saved address and preserves receipt snapshots over changed catalog prices", async (t) => {
  const order = { _id: orderId, userId: "customer", paymentMethod: "COD", status: "Order Placed", amount: 480,
    subtotal: 500, discount: 50, shipping: 30, voucherCode: "SAVE10", items: [{ product: "product", unitPrice: 500, title: "Saved title", quantity: 1, size: "100ml" }], address: "snapshot_address",
    async populate(paths) { assert.equal(paths, "items.product address"); this.items[0].product = { price: { "100ml": 999 }, title: "New title" }; this.address = { _id: "snapshot_address", street: "Saved delivery street" }; return this; } };
  mockOrder(t, order);
  const res = response();
  await getOrderStatus(request(), res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.order.address.street, "Saved delivery street");
  assert.equal(res.body.order.items[0].unitPrice, 500);
  assert.equal(res.body.order.items[0].title, "Saved title");
  assert.equal(res.body.order.amount, 480);
  assert.equal(res.body.order.shipping, 30);
  assert.equal(res.body.order.discount, 50);
});

test("normal QR polling does not populate overview data or alter its response", async (t) => {
  let populated = false;
  const fields = { _id: orderId, userId: "customer", paymentMethod: "QR", status: "Awaiting Payment", items: [{ product: "saved_product" }], address: "saved_address", createdAt: new Date(), paymentExpiresAt: new Date(Date.now() + 300000) };
  mockOrder(t, { ...fields, populate: async () => { populated = true; }, toObject: () => fields });
  const res = response();
  await getOrderStatus(request({ query: {} }), res);
  assert.equal(populated, false);
  assert.equal(res.body.order.address, "saved_address");
  assert.equal(res.body.order.items[0].product, "saved_product");
  assert.ok(res.body.order.paymentExpiresAt instanceof Date);
});

test("overview reports a loading failure rather than returning a partial receipt", async (t) => {
  mockOrder(t, { userId: "customer", populate: async () => { throw new Error("database unavailable"); } });
  const res = response();
  await getOrderStatus(request(), res);
  assert.equal(res.statusCode, 500);
  assert.equal(res.body.success, false);
  assert.equal(res.body.order, undefined);
});
