import test from "node:test";
import assert from "node:assert/strict";
import { createDashboardCache } from "../../../client/src/utils/dashboardCache.js";

const deferred = () => {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
};

test("returning to Dashboard reuses fresh data without another request", async () => {
  const cache = createDashboardCache();
  const data = { orders: [], totalRevenue: 123 };
  let calls = 0;
  const request = async () => { calls++; return data; };
  await cache.load("owner:UTC:1", request);
  assert.equal(cache.peek("owner:UTC:1"), data);
  assert.equal(await cache.load("owner:UTC:1", request), data);
  assert.equal(calls, 1);
  assert.equal(cache.peek("other:UTC:1"), undefined);
  assert.equal(cache.peek("owner:UTC:2"), undefined);
});

test("stale data remains available while a shared background refresh runs", async () => {
  let clock = 0;
  const cache = createDashboardCache({ now: () => clock });
  await cache.load("one", async () => ({ totalRevenue: 10 }));
  clock = 30001;
  const pending = deferred();
  let calls = 0;
  const request = () => { calls++; return pending.promise; };
  const first = cache.load("one", request);
  assert.equal(cache.load("one", request), first);
  assert.equal(cache.peek("one").totalRevenue, 10);
  pending.resolve({ totalRevenue: 20 });
  await first;
  assert.equal(calls, 1);
  assert.equal(cache.peek("one").totalRevenue, 20);
});

test("sign-out removes private cache and late requests cannot refill it", async () => {
  const cache = createDashboardCache();
  await cache.load("saved", async () => ({ orders: [] }));
  const pending = deferred();
  const request = cache.load("pending", () => pending.promise);
  await Promise.resolve();
  cache.clear();
  pending.resolve({ orders: [{ customer: "old-user" }] });
  await assert.rejects(request, { name: "AbortError" });
  assert.equal(cache.peek("saved"), undefined);
  assert.equal(cache.peek("pending"), undefined);
});

test("confirmed status changes invalidate old totals and abort stale reads", async () => {
  const cache = createDashboardCache();
  await cache.load("one", async () => ({ orders: [{ _id: "order", status: "Shipping" }], totalRevenue: 0 }));
  const pending = deferred();
  const old = cache.load("one", () => pending.promise, { force: true });
  await Promise.resolve();
  cache.updateOrder({ _id: "order", status: "Delivery", isPaid: true });
  assert.equal(cache.peek("one").orders[0].isPaid, true);
  await cache.load("one", async () => ({ orders: [], totalRevenue: 99 }));
  pending.resolve({ orders: [], totalRevenue: 0 });
  await assert.rejects(old, { name: "AbortError" });
  assert.equal(cache.peek("one").totalRevenue, 99);
});

test("failed refresh retains visible data and can be retried", async () => {
  const cache = createDashboardCache();
  await cache.load("one", async () => ({ totalRevenue: 20 }));
  cache.invalidate();
  await assert.rejects(cache.load("one", async () => { throw new Error("offline"); }));
  assert.equal(cache.peek("one").totalRevenue, 20);
  await cache.load("one", async () => ({ totalRevenue: 30 }));
  assert.equal(cache.peek("one").totalRevenue, 30);
});
