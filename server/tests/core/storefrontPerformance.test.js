import test from "node:test";
import assert from "node:assert/strict";
import Product from "../../models/Product.js";
import { browseCatalog, getStorefrontCatalog, invalidateStorefrontCatalog, parseBrowseQuery } from "../../services/storefrontCatalog.js";
import { collectPerfumeFilters, productFilterValues, parsePerfumeFilters, matchesPerfumeFilters } from "../../services/perfumeFilters.js";
import { batchProducts } from "../../controllers/storefrontController.js";
import { createPublicCatalog } from "../../../client/src/utils/publicCatalog.js";
import { createResourceCache } from "../../../client/src/utils/resourceCache.js";
import { STORE_SHOP_LINKS } from "../../../client/src/data/storeNavigation.js";
import Conversation from "../../models/SupportConversation.js";
import Message from "../../models/SupportMessage.js";
import Usage from "../../models/SupportUsage.js";
import { ensureSupportIndexes } from "../../middleware/supportIndexes.js";
import { createStoreResources } from "../../../client/src/utils/storeResources.js";

const fixture = (index = 1, patch = {}) => ({ _id: String(index).padStart(24, "0"), title: `Perfume ${index}`, category: "Nước hoa nam", gender: "Nam", type: "EDP", concentration: "EDP", brand: "Brand A", origin: "Pháp",
  inventoryMode: "tracked", inStock: true, isPublished: true, sizes: ["10ml", "100ml"], price: { "10ml": index * 100000, "100ml": index * 1000000 },
  stockBySize: { "10ml": 5, "100ml": 2 }, inStockBySize: { "10ml": true, "100ml": true }, images: ["https://example.com/avatar.png"],
  fragrance: { style: "Thanh lịch, Năng động", notes: { top: [{ name: "Chanh vàng" }], middle: [{ name: "Hoa hồng" }], base: [{ name: "Xạ hương" }] },
    accords: [{ label: "Cam chanh", displayedPercent: 100 }], longevity: [{ label: "Yếu 1-3H", displayedCount: 2 }, { label: "Khá 6-8H", displayedCount: 10 }],
    sillage: [{ label: "Gần", displayedCount: 3 }, { label: "Vừa phải", displayedCount: 6 }], suitability: [{ label: "Hạ", displayedPercent: 80 }, { label: "Đêm", displayedPercent: 50 }, { label: "Đông", displayedPercent: 49 }] }, ...patch });
const options = query => parseBrowseQuery(query);
const response = () => ({ statusCode: 200, status(value) { this.statusCode = value; return this; }, set() {}, json(body) { this.body = body; return this; } });

test("all eleven fragrance facets are derived from actual catalog fields with OR inside a criterion and AND between criteria", () => {
  const product = fixture();
  const values = productFilterValues(product);
  assert.deepEqual(Object.keys(values), ["gender", "brands", "sizes", "longevity", "sillage", "suitability", "notes", "accords", "styles", "concentrations", "origins"]);
  assert.deepEqual(values.longevity, ["Khá 6-8H"]);
  assert.deepEqual(values.suitability, ["Hạ", "Đêm"]);
  assert.ok(values.notes.includes("Xạ hương"));
  assert.deepEqual(values.styles, ["Thanh lịch", "Năng động"]);
  assert.equal(matchesPerfumeFilters(values, { brands: ["Other", "brand a"], notes: ["hoa hồng"], origins: ["Pháp"] }), true);
  assert.equal(matchesPerfumeFilters(values, { brands: ["Brand A"], gender: ["Nữ"] }), false);
  const facets = collectPerfumeFilters([product]);
  assert.equal(Object.keys(facets).length, 11);
  assert.deepEqual(facets.sizes, ["10ml", "100ml"]);
  assert.deepEqual(productFilterValues(fixture(2, { gender: "Chọn giới tính" })).gender, ["Nam"]);
});

test("missing/zero assessment values do not invent recommendations; tied positive counts preserve both labels", () => {
  const product = fixture();
  product.fragrance.longevity = [{ label: "Unknown", displayedCount: null }, { label: "Zero", displayedCount: 0 }, { label: "Negative", displayedCount: -1 }];
  product.fragrance.sillage = [{ label: "Gần", displayedCount: 4 }, { label: "Xa", displayedCount: 4 }];
  product.fragrance.suitability = [{ label: "Missing", displayedPercent: null }, { label: "Bad", displayedPercent: 120 }];
  const values = productFilterValues(product);
  assert.deepEqual(values.longevity, []);
  assert.deepEqual(values.sillage, ["Gần", "Xa"]);
  assert.deepEqual(values.suitability, []);
});

test("a single paged response contains sixteen cards and global totals, without article/gallery/source/profile payloads", () => {
  const catalog = Array.from({ length: 37 }, (_, index) => fixture(index + 1));
  catalog[0].descriptionContent = { type: "doc" };
  const result = browseCatalog(catalog, options({ page: "2" }));
  assert.equal(result.total, 37); assert.equal(result.totalPages, 3);
  assert.equal(result.products.length, 16); assert.equal(result.products[0]._id, catalog[16]._id);
  for (const product of result.products) {
    assert.equal(product.fragrance, undefined); assert.equal(product.descriptionContent, undefined); assert.equal(product._filters, undefined);
  }
  assert.equal(browseCatalog(catalog, options({ page: "100" })).page, 3);
});

test("size/price filters and sorting refer to the available size actually displayed on each card", () => {
  const catalog = [fixture(1), fixture(2), fixture(3)];
  catalog[2].inStockBySize["100ml"] = false;
  const result = browseCatalog(catalog, options({ facets: JSON.stringify({ sizes: ["100ml"] }), minPrice: "1500000", sort: "low" }));
  assert.equal(result.total, 1);
  assert.equal(result.products[0]._id, catalog[1]._id);
  assert.equal(result.products[0].displaySize, "100ml");
  assert.equal(result.filters.maxPrice, 2000000);
  const range = browseCatalog(catalog, options({ minPrice: "900000", maxPrice: "1100000" }));
  assert.equal(range.total, 1); assert.equal(range.products[0].displaySize, "100ml");
});

test("matching remains case-insensitive and query/price/filter input cannot inject expressions", () => {
  for (const query of [{ page: "0" }, { page: "1.5" }, { limit: "100000" }, { q: {} }, { sort: "evil" }, { minPrice: "NaN" }, { maxPrice: "Infinity" }, { facets: "{" }, { facets: JSON.stringify({ $where: ["x"] }) }, { facets: JSON.stringify({ notes: [{ $ne: null }] }) }]) {
    assert.throws(() => options(query), error => error.statusCode === 400);
  }
  assert.throws(() => parsePerfumeFilters(JSON.stringify({ notes: Array(31).fill("rose") })));
  const result = browseCatalog([fixture()], options({ q: "PERFUME", facets: JSON.stringify({ origins: ["pháp"], brands: ["brand a"] }) }));
  assert.equal(result.total, 1);
});

test("concurrent browse requests share one bounded snapshot; stock invalidation and expiry cause a fresh read", async (t) => {
  invalidateStorefrontCatalog();
  let reads = 0, clock = 100;
  t.mock.method(Date, "now", () => clock);
  t.mock.method(Product, "find", () => ({ select: () => ({ sort: () => ({ lean: async () => { reads++; return [fixture(reads)]; } }) }) }));
  const [first, concurrent] = await Promise.all([getStorefrontCatalog(), getStorefrontCatalog()]);
  assert.equal(reads, 1); assert.equal(first, concurrent);
  await getStorefrontCatalog(); assert.equal(reads, 1);
  invalidateStorefrontCatalog();
  await getStorefrontCatalog(); assert.equal(reads, 2);
  clock += 10001;
  await getStorefrontCatalog(); assert.equal(reads, 3);
  invalidateStorefrontCatalog();
});

test("cart batch reads are bounded and reject bad IDs before querying MongoDB", async (t) => {
  const read = t.mock.method(Product, "find", filter => ({ select: () => ({ lean: async () => {
    assert.equal(filter.isDeleted.$ne, true); assert.deepEqual(filter._id.$in, [fixture()._id]);
    return [fixture()];
  } }) }));
  const bad = response(); await batchProducts({ query: { ids: "x" } }, bad);
  assert.equal(bad.statusCode, 400); assert.equal(read.mock.callCount(), 0);
  const good = response(); await batchProducts({ query: { ids: fixture()._id } }, good);
  assert.equal(good.body.products.length, 1); assert.equal(read.mock.callCount(), 1);
});

test("public client reads reuse pages/details, keep separate filters, retry errors, and batch only requested cart IDs", async () => {
  let calls = 0, fail = false, now = 0;
  const requested = [];
  const client = createPublicCatalog({ cache: createResourceCache({ now: () => now, maxAge: 15000 }), axios: { get: async (url, { params }) => {
    calls++; requested.push({ url, params }); if (fail) throw new Error("offline");
    return { data: { success: true, products: [fixture()], product: fixture() } };
  } } });
  await Promise.all([client.browse({ page: 1 }), client.browse({ page: 1 })]); assert.equal(calls, 1);
  await client.browse({ page: 1 }); assert.equal(calls, 1);
  await client.browse({ page: 2 }); assert.equal(calls, 2);
  await Promise.all([client.detail(fixture()._id), client.detail(fixture()._id)]); assert.equal(calls, 3);
  now = 16000; fail = true;
  await assert.rejects(client.browse({ page: 1 }));
  fail = false; await client.browse({ page: 1 }); assert.equal(calls, 5);
  await client.batch([fixture()._id, fixture()._id]);
  assert.equal(requested.at(-1).url, "/api/products/batch"); assert.equal(requested.at(-1).params.ids, fixture()._id);
  assert.ok(requested.every(item => item.url !== "/api/products"));
});

test("the final header categories exist before any category API response", () => {
  assert.deepEqual(STORE_SHOP_LINKS.map(item => item.title), ["Bộ sưu tập", "Nước hoa nam", "Nước hoa nữ", "Nước hoa unisex"]);
});

test("fragrance metadata is lazy and cached separately from the live card/stock snapshot", async (t) => {
  invalidateStorefrontCatalog();
  const projections = [];
  t.mock.method(Product, "find", () => ({ select: fields => {
    projections.push(fields);
    const query = { sort: () => query, lean: async () => [fixture()] };
    return query;
  } }));
  await getStorefrontCatalog();
  assert.equal(projections.length, 1); assert.doesNotMatch(projections[0], /fragrance/);
  const rich = await getStorefrontCatalog(true);
  assert.equal(projections.length, 2); assert.match(projections[1], /fragrance/);
  assert.deepEqual(rich[0]._filters.notes, ["Chanh vàng", "Hoa hồng", "Xạ hương"]);
  await getStorefrontCatalog(true); assert.equal(projections.length, 2);
  invalidateStorefrontCatalog();
});

test("dashboard catalog reads share cached requests and clear private snapshots on sign-out", async () => {
  let calls = 0;
  const resources = createStoreResources({ userId: "owner-a", getToken: async () => "owner-token", axios: { get: async (_url, config) => {
    assert.equal(config.headers.Authorization, "Bearer owner-token"); calls++;
    return { data: { success: true, total: calls } };
  } } });
  await Promise.all([resources.loadCatalog("/summary"), resources.loadCatalog("/summary")]);
  assert.equal(calls, 1);
  await resources.loadCatalog("/summary"); assert.equal(calls, 1);
  await resources.loadCatalog("/summary", "/api/catalog", { force: true }); assert.equal(calls, 2);
  assert.equal(resources.peekCatalog("/summary").total, 2);
  resources.clear(); assert.equal(resources.peekCatalog("/summary"), undefined);
});

test("support initialization stays deduplicated and still completes before its requests proceed", async (t) => {
  let resolve;
  const gate = new Promise(done => { resolve = done; });
  const methods = [Conversation, Message, Usage].map(model => t.mock.method(model, "init", () => gate));
  let proceeded = 0;
  const a = ensureSupportIndexes(null, null, () => proceeded++), b = ensureSupportIndexes(null, null, () => proceeded++);
  assert.equal(proceeded, 0);
  for (const method of methods) assert.equal(method.mock.callCount(), 1);
  resolve(); await Promise.all([a, b]); assert.equal(proceeded, 2);
});
