import test from "node:test";
import assert from "node:assert/strict";
import Order from "../../models/Order.js";
import { listPopularProducts } from "../../controllers/productController.js";
import productRouter from "../../routes/productRoute.js";

const response = () => ({
  statusCode: 200,
  headers: {},
  status(code) { this.statusCode = code; return this; },
  set(name, value) { this.headers[name] = value; return this; },
  json(body) { this.body = body; return this; },
});

test("visitors and admins use the same public popular products endpoint", () => {
  const route = productRouter.stack.find((layer) => layer.route?.path === "/popular").route;
  assert.equal(route.methods.get, true);
  assert.equal(route.stack.length, 1);
  assert.equal(route.stack[0].handle, listPopularProducts);
});

test("popular products refreshes after sales change and prevents stale HTTP caching", async (t) => {
  let ranking = [{ _id: "product_a", title: "A", soldQuantity: 2 }];
  t.mock.method(Order, "aggregate", async () => structuredClone(ranking));
  const first = response();
  await listPopularProducts({}, first);
  assert.equal(first.headers["Cache-Control"], "no-store");
  assert.equal(first.body.products[0]._id, "product_a");

  ranking = [
    { _id: "product_b", title: "B", soldQuantity: 5 },
    ...ranking,
  ];
  const second = response();
  await listPopularProducts({}, second);
  assert.equal(second.body.products[0]._id, "product_b");
  assert.equal(second.body.products[0].soldQuantity, 5);
});

test("no sales is a successful empty result; database failures are not reported as no sales", async (t) => {
  t.mock.method(Order, "aggregate", async () => []);
  const empty = response();
  await listPopularProducts({}, empty);
  assert.deepEqual(empty.body, { success: true, products: [] });

  t.mock.method(Order, "aggregate", async () => {
    throw new Error("private database connection details");
  });
  t.mock.method(console, "error", () => {});
  const failure = response();
  await listPopularProducts({}, failure);
  assert.equal(failure.statusCode, 500);
  assert.equal(failure.body.success, false);
  assert.equal(failure.body.message, "Không thể tải sản phẩm bán chạy");
  assert.equal(JSON.stringify(failure.body).includes("private database"), false);
});
