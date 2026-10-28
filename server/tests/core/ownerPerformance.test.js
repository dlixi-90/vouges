import test from "node:test";
import assert from "node:assert/strict";
import Product from "../../models/Product.js";
import Order from "../../models/Order.js";
import FragranceTerm from "../../models/FragranceTerm.js";
import { catalogOverview } from "../../controllers/catalogController.js";
import catalogRouter from "../../routes/catalogRoute.js";
import authUser, { requireOwner } from "../../middleware/authMiddleware.js";
import { getDashboardData } from "../../services/dashboardService.js";
import { createResourceCache } from "../../../client/src/utils/resourceCache.js";
import { createStoreResources } from "../../../client/src/utils/storeResources.js";
import { createDashboardCache } from "../../../client/src/utils/dashboardCache.js";
import { defaultInboxPath, ownerDashboardKey, ownerOverviewPath, prefetchOwnerRoute, readOwnerDashboard } from "../../../client/src/utils/ownerPrefetch.js";

const response = () => ({ statusCode: 200, headers: {}, set(key, value) { this.headers[key] = value; return this; }, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });
const card = index => ({ _id: String(index).padStart(24, "0"), title: `Perfume ${index}`, price: { "100ml": 1000000 }, sizes: ["100ml"], images: ["https://example.com/avatar.webp", "https://example.com/gallery.webp"] });

test("the overview endpoint requires a verified owner and returns only its bounded widgets, without catalog filter scans or order history", async t => {
  assert.deepEqual(catalogRouter.stack.filter(layer => !layer.route).slice(0, 2).map(layer => layer.handle), [authUser, requireOwner]);
  assert.equal(catalogRouter.stack.find(layer => layer.route?.path === "/overview").route.stack[0].handle, catalogOverview);
  let reads = 0;
  t.mock.method(Product, "aggregate", async () => { reads++; return [{ total: [{ count: 2444 }], issues: [{ count: 9 }] }]; });
  t.mock.method(FragranceTerm, "aggregate", async () => { reads++; return [{ _id: "brand", count: 173 }]; });
  const lists = [];
  t.mock.method(Product, "find", filter => {
    reads++; const details = { filter }; lists.push(details);
    const query = { select(fields) { details.fields = fields; return this; }, sort(sort) { details.sort = sort; return this; }, limit(limit) { details.limit = limit; return this; }, async lean() { return Array.from({ length: details.limit }, (_, i) => card(i)); } };
    return query;
  });
  t.mock.method(Product, "distinct", () => assert.fail("Widget lists must not calculate catalog filter options"));
  t.mock.method(Order, "find", () => assert.fail("Overview must not fetch or populate order history"));
  t.mock.method(Order, "aggregate", async pipeline => {
    reads++;
    if (pipeline.some(stage => stage.$unwind)) return [card(99)];
    if (pipeline[1]?.$facet) return [{ totals: [{ totalOrders: 2, totalRevenue: 10 }], months: [{ _id: "2026-10", total: 20, successful: 10 }] }];
    assert.deepEqual(pipeline[0].$match, { status: { $in: ["Order Placed", "Packing", "Shipping", "Delivery"] }, $or: [{ paymentMethod: "COD" }, { paymentMethod: "QR", isPaid: true }] });
    return [{ count: 2, revenue: 10 }];
  });
  const res = response(); await catalogOverview({ query: { timezone: "Asia/Bangkok" } }, res);
  assert.equal(res.body.success, true); assert.equal(reads, 7);
  assert.deepEqual(lists.map(list => list.limit), [5, 4]);
  assert.ok(lists.every(list => !/fragrance|source|description/.test(list.fields)));
  assert.equal(res.body.recentProducts.length, 5); assert.equal(res.body.attentionProducts.length, 4);
  assert.equal(res.body.popularProducts[0]._id, card(99)._id);
  for (const group of ["recentProducts", "attentionProducts", "popularProducts"]) assert.ok(res.body[group].every(product => product.images.length === 1));
  assert.equal(res.body.sales.monthlyData.length, 12); assert.equal(res.body.sales.orders, undefined);
  assert.equal(res.body.metrics.total, 2444); assert.equal(res.body.orders.count, 2);
  assert.equal(res.headers["Cache-Control"], "private, no-store");
});

test("bad overview timezone input fails before database reads", async t => {
  const read = t.mock.method(Product, "aggregate", () => assert.fail("No malformed read"));
  for (const timezone of [{ $ne: null }, "bad/zone", "x".repeat(101)]) {
    const res = response(); await catalogOverview({ query: { timezone } }, res); assert.equal(res.statusCode, 400);
  }
  assert.equal(read.mock.callCount(), 0);
});

test("summary-only order analytics preserves totals and twelve months without populating an order page", async t => {
  t.mock.method(Order, "find", () => assert.fail("No order page read"));
  t.mock.method(Order, "aggregate", async () => [{ totals: [{ totalOrders: 35, totalRevenue: 123 }], months: [{ _id: "2026-10", total: 456, successful: 123 }] }]);
  const data = await getDashboardData({ includeOrders: false, timezone: "Asia/Bangkok" });
  assert.deepEqual(data.orders, []); assert.equal(data.totalOrders, 35); assert.equal(data.totalRevenue, 123);
  assert.equal(data.monthlyData.length, 12); assert.equal(data.monthlyData.at(-1).successful, 123);
});

const context = () => {
  const calls = [];
  const axios = { get: async (url, options) => {
    calls.push(url); assert.equal(options.headers.Authorization, "Bearer session");
    return { data: { success: true, dashboardData: { orders: [], totalRevenue: 123 }, vouchers: [], conversations: [], total: 0, unread: 0 } };
  } };
  const getToken = async () => "session";
  return { calls, axios, getToken, isOwner: true, authenticatedUserId: "owner", dashboardCache: createDashboardCache(), storeResources: createStoreResources({ axios, getToken, userId: "owner" }) };
};

test("hover, keyboard focus and subsequent page mount share one authenticated request per owner route", async () => {
  const ctx = context();
  for (const path of ["/owner", "/owner/orders", "/owner/vouchers", "/owner/messages"]) {
    await Promise.all([prefetchOwnerRoute(path, ctx), prefetchOwnerRoute(path, ctx)]);
  }
  await ctx.storeResources.loadCatalog(ownerOverviewPath);
  await ctx.storeResources.loadCatalog("/", "/api/vouchers");
  await ctx.storeResources.loadSupportInbox(defaultInboxPath);
  const data = await ctx.dashboardCache.load(ownerDashboardKey("owner"), signal => readOwnerDashboard({ ...ctx, signal }));
  assert.equal(data.totalRevenue, 123);
  assert.equal(ctx.calls.length, 4); assert.equal(new Set(ctx.calls).size, 4);
});

test("owner prefetch does not request private data before owner verification or while signed out", async () => {
  const ctx = context();
  for (const patch of [{ isOwner: null }, { isOwner: false }, { authenticatedUserId: null }]) {
    await prefetchOwnerRoute("/owner", { ...ctx, ...patch });
    await prefetchOwnerRoute("/owner/messages", { ...ctx, ...patch });
  }
  assert.equal(ctx.calls.length, 0);
});

test("confirmed voucher responses replace cached lists immediately without a second GET; manual refresh remains available", async () => {
  const ctx = context();
  await ctx.storeResources.loadCatalog("/", "/api/vouchers");
  const data = { success: true, vouchers: [{ code: "NEW", active: true }] };
  ctx.storeResources.setCatalog("/", "/api/vouchers", data);
  assert.equal(await ctx.storeResources.loadCatalog("/", "/api/vouchers"), data); assert.equal(ctx.calls.length, 1);
  await ctx.storeResources.loadCatalog("/", "/api/vouchers", { force: true }); assert.equal(ctx.calls.length, 2);
  ctx.storeResources.clear(); assert.equal(ctx.storeResources.peekCatalog("/", "/api/vouchers"), undefined);
});

test("a live inbox snapshot aborts an older JSON bootstrap and keeps searches isolated", async () => {
  let resolve;
  const resources = createStoreResources({ userId: "owner", getToken: async () => "session", axios: { get: async () => new Promise(done => { resolve = done; }) } });
  const old = resources.loadSupportInbox(defaultInboxPath);
  while (!resolve) await new Promise(done => setTimeout(done, 0));
  const current = { conversations: [{ _id: "newer", unreadStaff: 0 }], total: 1 };
  resources.setSupportInbox(defaultInboxPath, current);
  resolve({ data: { success: true, conversations: [{ _id: "outdated" }] } });
  await assert.rejects(old, { name: "AbortError" });
  assert.equal(resources.peekSupportInbox(defaultInboxPath), current);
  assert.equal(resources.peekSupportInbox("/api/support/inbox?search=other"), undefined);
  resources.clear(); assert.equal(resources.peekSupportInbox(defaultInboxPath), undefined);
});

test("private inbox snapshots expire and failed refreshes retain data, while a different account has no access to them", async () => {
  let now = 0, fail = false, calls = 0;
  const options = { userId: "owner", getToken: async () => "session", axios: { get: async () => {
    calls++; if (fail) throw new Error("offline"); return { data: { success: true, conversations: [], total: calls } };
  } } };
  const resources = createStoreResources({ ...options, cache: createResourceCache({ now: () => now, maxAge: 30000 }) });
  await resources.loadSupportInbox(defaultInboxPath); await resources.loadSupportInbox(defaultInboxPath); assert.equal(calls, 1);
  now = 30001; fail = true; await assert.rejects(resources.loadSupportInbox(defaultInboxPath));
  assert.equal(resources.peekSupportInbox(defaultInboxPath).total, 1);
  assert.equal(createStoreResources({ ...options, userId: "other" }).peekSupportInbox(defaultInboxPath), undefined);
  fail = false; await resources.loadSupportInbox(defaultInboxPath); assert.equal(resources.peekSupportInbox(defaultInboxPath).total, 3);
});
