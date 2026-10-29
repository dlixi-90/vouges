import test from "node:test";
import assert from "node:assert/strict";
import { createResourceCache } from "../../../client/src/utils/resourceCache.js";
import { createStoreResources } from "../../../client/src/utils/storeResources.js";

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

test("prefetch and mounted consumers share one request and reuse it for 30 seconds", async () => {
  let clock = 0;
  const cache = createResourceCache({ now: () => clock });
  const pending = deferred();
  let calls = 0;
  const request = () => { calls++; return pending.promise; };
  const first = cache.load("reviews:p:1", request);
  assert.equal(cache.load("reviews:p:1", request), first);
  pending.resolve({ count: 2 });
  await first;
  clock = 29999;
  assert.deepEqual(await cache.load("reviews:p:1", request), { count: 2 });
  assert.equal(calls, 1);
  clock = 30000;
  const next = deferred();
  const refresh = cache.load("reviews:p:1", () => { calls++; return next.promise; });
  assert.deepEqual(cache.peek("reviews:p:1"), { count: 2 });
  next.resolve({ count: 3 });
  await refresh;
  assert.equal(calls, 2);
  assert.deepEqual(cache.peek("reviews:p:1"), { count: 3 });
});

test("sign-out clears data and late responses cannot repopulate the cache", async () => {
  const cache = createResourceCache();
  cache.set("saved", { private: true });
  const pending = deferred();
  const request = cache.load("membership:old", () => pending.promise);
  await Promise.resolve();
  cache.clear();
  pending.resolve({ private: true });
  await assert.rejects(request, { name: "AbortError" });
  assert.equal(cache.peek("membership:old"), undefined);
  assert.equal(cache.peek("saved"), undefined);
});

test("review saves invalidate every public page and replace pending own-review reads", async () => {
  const cache = createResourceCache();
  cache.set("reviews:p:1", { count: 10 });
  cache.set("reviews:p:2", { count: 10 });
  cache.set("reviews:other:1", { count: 2 });
  const resources = createStoreResources({ cache, userId: "buyer" });
  const pending = deferred();
  const old = cache.load("own-review:buyer:p", () => pending.promise);
  await Promise.resolve();
  resources.invalidateReviews("p");
  resources.setOwnReview("p", { eligible: true, review: { rating: 5 } });
  pending.resolve({ eligible: false });
  await assert.rejects(old, { name: "AbortError" });
  assert.equal(resources.peekReviews("p"), undefined);
  assert.equal(resources.peekReviews("p", 2), undefined);
  assert.equal(resources.peekReviews("other").count, 2);
  assert.equal(resources.peekOwnReview("p").review.rating, 5);
});

test("failed reads can retry; failed refreshes retain the last successful snapshot", async () => {
  const cache = createResourceCache();
  await assert.rejects(cache.load("one", async () => { throw new Error("offline"); }));
  await cache.load("one", async () => ({ count: 1 }));
  await assert.rejects(cache.load("one", async () => { throw new Error("offline"); }, { force: true }));
  assert.deepEqual(cache.peek("one"), { count: 1 });
  await cache.load("one", async () => ({ count: 2 }), { force: true });
  assert.deepEqual(cache.peek("one"), { count: 2 });
});

test("the cache is bounded and keeps pending requests shared during eviction", async () => {
  const cache = createResourceCache({ maxEntries: 2 });
  const pending = deferred();
  const first = cache.load("pending", () => pending.promise);
  cache.set("old", 1);
  cache.set("new", 2);
  assert.equal(cache.peek("old"), undefined);
  assert.equal(cache.load("pending", assert.fail), first);
  pending.resolve(3);
  assert.equal(await first, 3);
});

test("membership and checkout share one authenticated request containing profile and vouchers", async () => {
  let calls = 0;
  const resources = createStoreResources({ userId: "buyer", getToken: async () => "session", axios: {
    get: async (url, options) => {
      calls++;
      assert.equal(url, "/api/vouchers/mine");
      assert.equal(options.headers.Authorization, "Bearer session");
      assert.equal(options.timeout, 15000);
      return { data: { success: true, profile: { birthday: "2000-01-01" }, vouchers: [{ code: "SAVE10" }] } };
    },
  } });
  const [member, wallet] = await Promise.all([resources.loadMembership(), resources.loadMembership()]);
  assert.equal(calls, 1);
  assert.equal(member, wallet);
  assert.equal(member.userId, "buyer");
  assert.equal(member.profile.birthday, "2000-01-01");
  resources.invalidateMembership();
  assert.equal(resources.peekMembership(), undefined);
  await resources.loadMembership();
  assert.equal(calls, 2);
});

test("customer order prefetch and history share pages, refresh after checkout and remain account scoped", async () => {
  const calls=[];
  const resources=createStoreResources({userId:"buyer",getToken:async()=>"session",axios:{get:async(url,options)=>{
    assert.equal(options.headers.Authorization,"Bearer session");calls.push(options.params?.page);return {data:{success:true,orders:[],page:options.params?.page}};
  }}});
  await Promise.all([resources.loadOrders(),resources.loadOrders()]);assert.deepEqual(calls,[1]);
  await resources.loadOrders(2);assert.deepEqual(calls,[1,2]);
  resources.invalidateOrders();assert.equal(resources.peekOrders(),undefined);
  await resources.loadOrders();assert.deepEqual(calls,[1,2,1]);
  assert.equal(createStoreResources({userId:"other"}).peekOrders(),undefined);
  resources.clear();assert.equal(resources.peekOrders(),undefined);
  assert.equal(await createStoreResources({}).loadOrders(),null);
});

test("checkout address lists reuse authenticated reads and refresh after address edits", async () => {
  let reads=0;
  const resources=createStoreResources({userId:"buyer",getToken:async()=>"session",axios:{get:async(url)=>{
    assert.equal(url,"/api/addresses");reads++;return {data:{success:true,addresses:[{_id:"home"}]}};
  }}});
  await Promise.all([resources.loadAddresses(),resources.loadAddresses()]);assert.equal(reads,1);
  await resources.loadAddresses();assert.equal(reads,1);
  resources.invalidateAddresses();await resources.loadAddresses();assert.equal(reads,2);
  resources.clear();assert.equal(resources.peekAddresses(),undefined);
  assert.equal(await createStoreResources({}).loadAddresses(),null);
});

test("account-scoped resources never share private data; guests skip private requests", async () => {
  const alice = createStoreResources({ userId: "alice" });
  const bob = createStoreResources({ userId: "bob" });
  alice.setOwnReview("p", { eligible: true, review: { comment: "Private" } });
  assert.equal(bob.peekOwnReview("p"), undefined);
  const guest = createStoreResources({ axios: { get: assert.fail }, getToken: assert.fail });
  assert.equal(await guest.loadMembership(), null);
  assert.equal(await guest.loadOwnReview("p"), null);
});

test("public review prefetch stays anonymous and separates products and pages", async () => {
  const calls = [];
  const resources = createStoreResources({ userId: "buyer", getToken: assert.fail, axios: {
    get: async (url, options) => {
      calls.push([url, options.params.page]);
      assert.equal(options.headers, undefined);
      return { data: { success: true, reviews: [], count: 0, average: 0 } };
    },
  } });
  await Promise.all([resources.loadReviews("one"), resources.loadReviews("one"), resources.loadReviews("one", 2), resources.loadReviews("two")]);
  assert.deepEqual(calls, [["/api/products/one/reviews", 1], ["/api/products/one/reviews", 2], ["/api/products/two/reviews", 1]]);
});
