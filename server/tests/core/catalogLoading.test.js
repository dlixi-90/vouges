import test from "node:test";
import assert from "node:assert/strict";
import { createPublicCatalog } from "../../../client/src/utils/publicCatalog.js";
import { createPublicCatalogStorage } from "../../../client/src/utils/publicCatalogStorage.js";
import { getProductImageSrcSet, getProductImageUrl } from "../../../client/src/utils/productImage.js";

const card = (price = 1000000) => ({ _id: "507f1f77bcf86cd799439011", title: "Velours Rose", sizes: ["50ml"], price: { "50ml": price }, images: ["/card.webp"] });
const page = price => ({ success: true, products: [card(price)], total: 1, page: 1, totalPages: 1 });
const memoryStorage = () => {
  const values = new Map();
  return { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key), values };
};

test("a new page session renders its saved catalog immediately, but shares a fresh price request", async () => {
  const storage = memoryStorage();
  await createPublicCatalog({ storage, axios: { get: async () => ({ data: page(1000000) }) } }).browse();
  let calls = 0, finish;
  const gate = new Promise(resolve => { finish = resolve; });
  const client = createPublicCatalog({ storage, axios: { get: async () => { calls++; await gate; return { data: page(1200000) }; } } });
  assert.equal(client.peekBrowse({}).products[0].price["50ml"], 1000000);
  const first = client.browse(), second = client.browse();
  await Promise.resolve();
  assert.equal(calls, 1);
  assert.equal(client.peekBrowse({}).products[0].price["50ml"], 1000000);
  finish(); await Promise.all([first, second]);
  assert.equal(client.peekBrowse({}).products[0].price["50ml"], 1200000);
  await client.browse(); assert.equal(calls, 1);
});

test("a failed restored refresh retains visible cards and retries instead of treating old prices as fresh", async () => {
  const storage = memoryStorage();
  await createPublicCatalog({ storage, axios: { get: async () => ({ data: page(1000000) }) } }).browse();
  let calls = 0;
  const client = createPublicCatalog({ storage, axios: { get: async () => {
    if (++calls === 1) throw new Error("offline");
    return { data: page(1300000) };
  } } });
  await assert.rejects(client.browse(), /offline/);
  assert.equal(client.peekBrowse({}).products[0].price["50ml"], 1000000);
  await client.browse(); assert.equal(calls, 2);
  assert.equal(client.peekBrowse({}).products[0].price["50ml"], 1300000);
});

test("card previews are available before a detail request completes, without marking a card as complete detail", async () => {
  const client = createPublicCatalog({ axios: { get: async url => ({ data: url.endsWith("/single")
    ? { success: true, product: { ...card(), description: "Full description", sizeImages: { "50ml": "/detail.webp" } } } : page() }) } });
  await client.browse();
  assert.equal(client.peekProduct(card()._id).title, card().title);
  assert.equal(client.peekDetail(card()._id), undefined);
  await client.detail(card()._id);
  assert.equal(client.peekProduct(card()._id).description, "Full description");
  client.clear();
  assert.equal(client.peekProduct(card()._id), undefined);
});

test("popular products share in-flight requests and an explicit refresh bypasses the browser cache", async () => {
  const requests = [];
  const client = createPublicCatalog({ axios: { get: async (url, config) => { requests.push({url, params:config.params}); return { data: page() }; } } });
  await Promise.all([client.popular(), client.popular()]);
  assert.equal(requests.length, 1);
  assert.equal(client.peekPopular().products.length, 1);
  await client.popular({force:true});
  assert.equal(requests.length, 2);
  assert.equal(typeof requests[1].params.refresh, "number");
});

test("clearing a catalog during a pending read cannot repopulate saved prices", async () => {
  const storage = memoryStorage();
  let finish;
  const gate = new Promise(resolve => { finish = resolve; });
  const client = createPublicCatalog({ storage, axios: { get: async () => { await gate; return { data: page() }; } } });
  const read = client.browse();
  await Promise.resolve(); client.clear(); finish();
  await assert.rejects(read, error => error.name === "AbortError");
  assert.equal(storage.values.size, 0);
  assert.equal(client.peekBrowse({}), undefined);
});

test("public storage excludes private responses, expires snapshots and bounds their total size", () => {
  const storage = memoryStorage();
  let now = 0;
  const snapshots = createPublicCatalogStorage(storage, { now: () => now, maxAge: 1000, maxEntries: 2, maxLength: 2000 });
  snapshots.set("orders:mine", { success: true, orders: ["private"] });
  assert.equal(storage.values.size, 0);
  snapshots.set("browse:one", page()); snapshots.set("browse:two", page()); snapshots.set("browse:three", page());
  assert.equal(snapshots.peek("browse:one"), undefined);
  const restored = createPublicCatalogStorage(storage, { now: () => now, maxAge: 1000 });
  assert.equal(restored.peek("browse:three").success, true);
  now = 1000; assert.equal(restored.peek("browse:three"), undefined);
  snapshots.set("detail:large", { success: true, product: { ...card(), description: "x".repeat(3000) } });
  assert.ok([...storage.values.values()][0].length <= 2000);
});

test("disabled and malformed browser storage never prevents loading products", async () => {
  for (const storage of [
    { getItem() { throw new Error("denied"); }, setItem() { throw new Error("quota"); } },
    { getItem: () => "{broken", setItem() {} },
    { getItem: () => JSON.stringify([{ key: "browse:x", savedAt: Date.now(), data: { success: true, products: null } }]), setItem() {} },
  ]) {
    const client = createPublicCatalog({ storage, axios: { get: async () => ({ data: page() }) } });
    assert.equal((await client.browse()).products[0]._id, card()._id);
    client.clear();
  }
});

test("responsive image variants preserve signed/local/transformed URLs and never exceed the requested size", () => {
  const src = "https://res.cloudinary.com/velours/image/upload/v123/product.webp";
  const variants = getProductImageSrcSet(src, 960).split(", ");
  assert.equal(variants.length, 6);
  assert.ok(variants[0].endsWith("w_160/v123/product.webp 160w"));
  assert.ok(variants.at(-1).endsWith("w_960/v123/product.webp 960w"));
  assert.equal(getProductImageSrcSet(src, 80).split(", ").length, 1);
  for (const value of ["/images/product.webp", "https://example.com/a.webp", src.replace("/v123/", "/s--signed--/v123/"), getProductImageUrl(src)]) {
    assert.equal(getProductImageSrcSet(value), undefined);
  }
});
