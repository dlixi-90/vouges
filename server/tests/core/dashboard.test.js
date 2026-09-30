import test from "node:test";
import assert from "node:assert/strict";
import Order from "../../models/Order.js";
import orderRouter from "../../routes/orderRoute.js";
import authUser, { requireOwner } from "../../middleware/authMiddleware.js";
import { dashboard } from "../../controllers/dashboardController.js";
import { getDashboardData } from "../../services/dashboardService.js";

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
  assert.deepEqual(calls.filter, { $or: [{ paymentMethod: "COD" }, { isPaid: true }] });
  assert.deepEqual(calls.pipeline[0].$match, calls.filter);
  // The aggregation has no page limit before computing all-order totals.
  assert.deepEqual(Object.keys(calls.pipeline[1]), ["$facet"]);
  const facets = calls.pipeline[1].$facet;
  assert.deepEqual(facets.totals[0].$group.totalRevenue, { $sum: { $cond: ["$isPaid", "$amount", 0] } });
  assert.equal(facets.months[0].$group._id.$dateToString.timezone, "Asia/Ho_Chi_Minh");
  assert.deepEqual(data.monthlyData.map((month) => month.key), ["2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"]);
  assert.deepEqual(data.monthlyData.map((month) => month.total), [0, 0, 0, 300, 0, 900]);
  assert.equal(data.monthlyData[5].successful, 500);
  assert.ok(calls.populate.every((entry) => entry.select));
});

test("empty dashboard returns a zero summary and six months without invalid pages", async (t) => {
  setup(t, [{ totals: [], months: [] }]);
  const data = await getDashboardData({});
  assert.equal(data.totalOrders, 0);
  assert.equal(data.totalRevenue, 0);
  assert.equal(data.totalPages, 1);
  assert.equal(data.monthlyData.length, 6);
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
