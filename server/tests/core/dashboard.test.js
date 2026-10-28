import test from "node:test";
import assert from "node:assert/strict";
import Order from "../../models/Order.js";
import orderRouter from "../../routes/orderRoute.js";
import authUser, { requireOwner } from "../../middleware/authMiddleware.js";
import { dashboard } from "../../controllers/dashboardController.js";
import { getDashboardData } from "../../services/dashboardService.js";
import { allOrders } from "../../controllers/orderController.js";
import { catalogSummary } from "../../controllers/catalogController.js";
import Product from "../../models/Product.js";
import FragranceTerm from "../../models/FragranceTerm.js";
import { placedOrderFilter } from "../../utils/orderReporting.js";

const expectedOrderFilter = {
  status: { $in: ["Order Placed", "Packing", "Shipping", "Delivery"] },
  $or: [{ paymentMethod: "COD" }, { paymentMethod: "QR", isPaid: true }],
};

const setup = (t, summaries = [], orders = []) => {
  const calls = {};
  const query = {};
  for (const name of ["select", "sort", "skip", "limit", "populate"]) {
    query[name] = (value) => {
      (calls[name] ||= []).push(value);
      return query;
    };
  }
  query.lean = async () => orders;
  query.then = (resolve, reject) => Promise.resolve(orders).then(resolve, reject);
  t.mock.method(Order, "find", (filter) => { calls.filter = filter; return query; });
  t.mock.method(Order, "aggregate", async (pipeline) => { calls.pipeline = pipeline; return summaries; });
  return calls;
};

test("dashboard endpoint authenticates and checks owner before returning private data", () => {
  const routes = orderRouter.stack.map((layer) => layer.route).filter(Boolean);
  const route = routes.find((entry) => entry.path === "/dashboard");
  assert.deepEqual(route.stack.map((layer) => layer.handle), [authUser, requireOwner, dashboard]);
  assert.ok(routes.indexOf(route) < routes.findIndex((entry) => entry.path === "/:orderId"));
});

test("order pagination is bounded while revenue, count and chart cover the whole eligible catalog", async (t) => {
  const pageOrders = [{ _id: "order-on-page-two", items: [{ title: "Original name", unitPrice: 25, image: "snapshot.png" }] }];
  const calls = setup(t, [{
    totals: [{ totalOrders: 47, totalRevenue: 5200 }],
    months: [
      { _id: "2026-09", total: 900, successful: 500 },
      { _id: "2026-07", total: 300, successful: 200 },
      { _id: "2025-12", total: 800, successful: 800 },
    ],
  }], pageOrders);
  const data = await getDashboardData({ page: 2, pageSize: 10, timezone: "Asia/Ho_Chi_Minh" });
  assert.deepEqual(data.orders, pageOrders);
  assert.equal(data.totalOrders, 47);
  assert.equal(data.totalRevenue, 5200);
  assert.equal(data.totalPages, 5);
  assert.deepEqual(calls.skip, [10]);
  assert.deepEqual(calls.limit, [10]);
  assert.deepEqual(calls.sort, [{ createdAt: -1, _id: -1 }]);
  assert.deepEqual(calls.filter, expectedOrderFilter);
  assert.deepEqual(calls.pipeline[0].$match, calls.filter);
  // The aggregation has no page limit before computing all-order totals.
  assert.deepEqual(Object.keys(calls.pipeline[1]), ["$facet"]);
  const facets = calls.pipeline[1].$facet;
  assert.deepEqual(facets.totals[0].$group.totalRevenue, { $sum: { $cond: ["$isPaid", "$amount", 0] } });
  assert.equal(facets.months[0].$group._id.$dateToString.timezone, "Asia/Ho_Chi_Minh");
  assert.equal(facets.months.at(-1).$limit, 12);
  assert.deepEqual(data.monthlyData.map((month) => month.key), ["2025-10", "2025-11", "2025-12", "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"]);
  assert.deepEqual(data.monthlyData.map((month) => month.total), [0, 0, 800, 0, 0, 0, 0, 0, 0, 300, 0, 900]);
  assert.equal(data.monthlyData.at(-1).successful, 500);
  assert.deepEqual(data.monthlyData.slice(-6).map(month => month.total), [0, 0, 0, 300, 0, 900]);
  assert.deepEqual(data.monthlyData.slice(-3).map(month => month.total), [300, 0, 900]);
  assert.ok(calls.populate.every((entry) => entry.select));
});

test("empty dashboard returns a zero summary and twelve months without invalid pages", async (t) => {
  setup(t, [{ totals: [], months: [] }]);
  const data = await getDashboardData({});
  assert.equal(data.totalOrders, 0);
  assert.equal(data.totalRevenue, 0);
  assert.equal(data.totalPages, 1);
  assert.equal(data.monthlyData.length, 12);
  assert.ok(data.monthlyData.every((month) => month.total === 0 && month.successful === 0));
});

test("invalid page sizes, page numbers and timezones are rejected before database access", async (t) => {
  const find = t.mock.method(Order, "find", () => { throw new Error("Unexpected query"); });
  for (const query of [{ page: 0 }, { page: "abc" }, { page: "1.5" }, { pageSize: 1000 }, { pageSize: 0 }, { timezone: "invalid/zone" }, { timezone: {} }]) {
    const res = { status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
    await dashboard({ query }, res);
    assert.equal(res.code, 400);
  }
  assert.equal(find.mock.callCount(), 0);
});

test("dashboard responses cannot be stored by shared caches", async (t) => {
  setup(t);
  const headers = {};
  const res = { set(name, value) { headers[name] = value; return this; }, json(body) { this.body = body; return this; } };
  await dashboard({ query: {} }, res);
  assert.equal(res.body.success, true);
  assert.equal(headers["Cache-Control"], "private, no-store");
});

test("overview summary and both admin order APIs use the same confirmed-order eligibility", async t => {
  const calls = setup(t);
  t.mock.method(Product, "aggregate", async () => [{}]);
  t.mock.method(FragranceTerm, "aggregate", async () => []);
  const response = () => ({ set() { return this; }, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });
  const summary = response(); await catalogSummary({}, summary);
  assert.deepEqual(calls.pipeline[0].$match, expectedOrderFilter);
  assert.equal(summary.body.orders.count, 0);
  assert.equal(summary.body.orders.revenue, 0);
  const orders = response(); await allOrders({}, orders);
  assert.deepEqual(calls.filter, expectedOrderFilter);
  assert.equal(orders.body.dashboardData.totalOrders, 0);
  const dashboardData = await getDashboardData({});
  assert.deepEqual(calls.filter, expectedOrderFilter);
  assert.deepEqual(calls.pipeline[0].$match, expectedOrderFilter);
  assert.equal(dashboardData.totalOrders, 0);
});

test("only placed COD or successfully paid QR orders are eligible, including after fulfillment advances", () => {
  const filter = placedOrderFilter();
  assert.deepEqual(filter, expectedOrderFilter);
  const matches = order => filter.status.$in.includes(order.status) && filter.$or.some(branch => Object.entries(branch).every(([field, value]) => order[field] === value));
  for (const status of ["Order Placed", "Packing", "Shipping", "Delivery"]) {
    assert.equal(matches({ status, paymentMethod: "COD", isPaid: false }), true);
    assert.equal(matches({ status, paymentMethod: "COD", isPaid: true }), true);
    assert.equal(matches({ status, paymentMethod: "QR", isPaid: true }), true);
    assert.equal(matches({ status, paymentMethod: "QR", isPaid: false }), false);
  }
  for (const status of ["Awaiting Payment", "Payment Expired", "Payment Cancelled", "Payment Review"]) {
    for (const isPaid of [false, true]) assert.equal(matches({ status, paymentMethod: "QR", isPaid }), false);
  }
  filter.status.$in.push("Payment Cancelled");
  assert.deepEqual(placedOrderFilter(), expectedOrderFilter, "Callers cannot change another report's eligibility");
});
