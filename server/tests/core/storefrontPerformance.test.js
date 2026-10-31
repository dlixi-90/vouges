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
import { readStorefrontBrowse, canPageBrowseDirectly, readStorefrontRelated } from "../../services/storefrontBrowse.js";
import { prefetchCollection } from "../../../client/src/utils/prefetchCollection.js";

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

test("a single paged response contains fifteen cards and global totals, without article/gallery/source/profile payloads", () => {
  const catalog = Array.from({ length: 37 }, (_, index) => fixture(index + 1));
  catalog[0].descriptionContent = { type: "doc" };
  const result = browseCatalog(catalog, options({ page: "2" }));
  assert.equal(result.total, 37); assert.equal(result.totalPages, 3);
  assert.equal(result.products.length, 15); assert.equal(result.products[0]._id, catalog[15]._id);
  assert.equal(result.pageSize, 15);
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

test("name sorting supports Vietnamese names, letter case, numbers and deterministic ties", () => {
  const catalog = ["Zara", "Chanel", "Ánh", "ánh", "Đào", "Dior", "Bông", "Perfume 10", "Perfume 2"]
    .map((title, index) => fixture(index + 1, { title }));
  const expected = [3, 4, 7, 2, 6, 5, 9, 8, 1].map(index => fixture(index)._id);
  const ascending = browseCatalog(catalog, options({ sort: "name-asc" }));
  const descending = browseCatalog(catalog, options({ sort: "name-desc" }));
  assert.deepEqual(ascending.products.map(product => product._id), expected);
  assert.deepEqual(descending.products.map(product => product._id), expected.toReversed());
  assert.equal(catalog[0].title, "Zara", "Sorting must not mutate the cached catalog");
});

test("name sorting applies to all filtered products before slicing fifteen-card pages", () => {
  const catalog = Array.from({ length: 37 }, (_, index) => fixture(index + 1)).toReversed();
  catalog.push(fixture(98, { title: "A different brand", brand: "Other" }),
    fixture(99, { title: "A sold-out product", inStock: false }));
  for (const sort of ["name-asc", "name-desc"]) {
    const expected = Array.from({ length: 37 }, (_, index) => fixture(index + 1)._id);
    if (sort === "name-desc") expected.reverse();
    const pages = [1, 2, 3].map(page => browseCatalog(catalog, options({ page, limit: "15", sort,
      facets: JSON.stringify({ brands: ["Brand A"] }) })));
    assert.deepEqual(pages.map(result => result.products.length), [15, 15, 7]);
    assert.ok(pages.every(result => result.total === 37 && result.totalPages === 3 && result.pageSize === 15));
    assert.deepEqual(pages.flatMap(result => result.products.map(product => product._id)), expected);
  }
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

test("equivalent facet selections share one cache entry regardless of checkbox selection order", async () => {
  let calls = 0;
  const client = createPublicCatalog({ axios: { get: async () => { calls++; return { data: { success: true, products: [] } }; } } });
  await client.browse({ facets: JSON.stringify({ brands: ["Dior", "Chanel", "Dior"], gender: ["Nam"] }) });
  await client.browse({ facets: JSON.stringify({ gender: ["Nam"], brands: ["Chanel", "Dior"] }) });
  assert.equal(calls, 1);
});

test("client cache normalization does not turn malformed facet values into valid filter arrays", async () => {
  const invalid = JSON.stringify({ brands: "Chanel" });
  const client = createPublicCatalog({ axios: { get: async (_url, config) => {
    assert.equal(config.params.facets, invalid);
    return { data: { success: false, message: "Invalid filters" } };
  } } });
  await assert.rejects(client.browse({ facets: invalid }), /Invalid filters/);
});

test("cached advanced filters stop returning an orderable card after stock invalidation", async t => {
  invalidateStorefrontCatalog();
  let inStock = true;
  t.mock.method(Product, "find", () => ({ select: () => ({ sort: () => ({ lean: async () => [fixture(1, { inStock })] }) }) }));
  const query = options({ sort: "low", minPrice: "1" });
  const first = await readStorefrontBrowse(query);
  assert.equal(first.total, 1);
  assert.equal(await readStorefrontBrowse(query), first);
  inStock = false;
  invalidateStorefrontCatalog();
  assert.equal((await readStorefrontBrowse(query)).total, 0);
  invalidateStorefrontCatalog();
});

test("the final header categories exist before any category API response", () => {
  assert.deepEqual(STORE_SHOP_LINKS.map(item => item.title), ["Bộ sưu tập", "Nước hoa nam", "Nước hoa nữ", "Nước hoa unisex"]);
});

test("brand metadata is reusable on header remount and survives a failed refresh until a successful retry", async () => {
  let calls = 0, fail = false;
  const directory = { success: true, brands: [{ name: "Chanel", image: "/chanel.webp" }] };
  const client = createPublicCatalog({ axios: { get: async url => {
    assert.equal(url, "/api/products/brands"); calls++;
    if (fail) throw new Error("offline");
    return { data: directory };
  } } });
  assert.equal(client.peekBrands(), undefined);
  await Promise.all([client.brands(), client.brands()]); assert.equal(calls, 1);
  assert.equal(client.peekBrands(), directory);
  await client.brands(); assert.equal(calls, 1);
  fail = true; await assert.rejects(client.brands({ force: true }), /offline/);
  assert.equal(client.peekBrands(), directory);
  fail = false; await client.brands({ force: true }); assert.equal(calls, 3);
  client.clear(); assert.equal(client.peekBrands(), undefined);
});

test("fragrance metadata is lazy and cached separately from the live card/stock snapshot", async (t) => {
  invalidateStorefrontCatalog();
  const projections = [];
  t.mock.method(Product, "find", () => ({ select: fields => {
    projections.push(fields);
    const query = { sort: () => query, lean: async () => [fixture()] };
    return query;
  } }));
  t.mock.method(Product, "aggregate", async pipeline => { projections.push(pipeline[1].$project); return [fixture()]; });
  await getStorefrontCatalog();
  assert.equal(projections.length, 1); assert.doesNotMatch(Object.keys(projections[0]).join(" "), /fragrance/);
  assert.deepEqual(projections[0].images, { $slice: 1 });
  const rich = await getStorefrontCatalog(true);
  assert.equal(projections.length, 2); assert.match(Object.keys(projections[1]).join(" "), /fragrance/);
  assert.deepEqual(rich[0]._filters.notes, ["Chanh vàng", "Hoa hồng", "Xạ hương"]);
  await getStorefrontCatalog(true); assert.equal(projections.length, 2);
  invalidateStorefrontCatalog();
});

test("ordinary browsing returns only one bounded database page and shares metadata across pages", async t => {
  invalidateStorefrontCatalog();
  t.mock.method(Product, "find", () => assert.fail("A normal page must not fetch all products"));
  const pipelines = [];
  t.mock.method(Product, "aggregate", async pipeline => {
    pipelines.push(pipeline);
    const facets = pipeline.at(-1).$facet;
    if (facets.types) return [{ types: [{ _id: { brand: "Brand A", category: "Nước hoa nam", type: "EDP" } }], categories: [{ _id: "Nước hoa nam" }], price: [{ maximum: 5000000 }] }];
    assert.deepEqual(facets.products[1], { $limit: 15 });
    assert.deepEqual(facets.products[2].$project.images, { $slice: [{ $ifNull: ["$images", []] }, 1] });
    assert.equal(facets.products[2].$project.fragrance, undefined);
    return [{ total: [{ count: 35 }], products: [fixture()] }];
  });
  const [first, same] = await Promise.all([readStorefrontBrowse(options({})), readStorefrontBrowse(options({}))]);
  assert.equal(first, same); assert.equal(pipelines.length, 2);
  assert.equal(first.total, 35); assert.equal(first.totalPages, 3); assert.equal(first.filters.maxPrice, 5000000);
  await readStorefrontBrowse(options({ page: 2 })); assert.equal(pipelines.length, 3);
  assert.deepEqual(pipelines.at(-1).at(-1).$facet.products[0], { $skip: 15 });
  invalidateStorefrontCatalog();
  await readStorefrontBrowse(options({})); assert.equal(pipelines.length, 5);
  invalidateStorefrontCatalog();
});

test("advanced size/price/profile filters retain the existing matching and sorting path", () => {
  assert.equal(canPageBrowseDirectly(options({})), true);
  assert.equal(canPageBrowseDirectly(options({ facets: JSON.stringify({ gender: ["Nam"], brands: ["Brand A"] }) })), true);
  for (const query of [{ minPrice: 1 }, { sort: "high" }, { sort: "name-asc" }, { sort: "name-desc" }, { facets: JSON.stringify({ sizes: ["100ml"] }) }, { facets: JSON.stringify({ notes: ["Rose"] }) }, { facets: JSON.stringify({ longevity: ["Khá 6-8H"] }) }]) {
    assert.equal(canPageBrowseDirectly(options(query)), false);
  }
});

test("navigation prefetch and collection mount share 15-product default, gender and brand requests", async () => {
  const calls = [];
  const client = createPublicCatalog({ axios: { get: async (url, config) => { calls.push({ url, params: config.params }); return { data: { success: true, products: [] } }; } } });
  prefetchCollection(client);
  await client.browse({ page: 1, limit: 15, availability: "available", q: "", sort: "relevant", minPrice: 0, facets: JSON.stringify({ gender: [], brands: [], notes: [] }) });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].params.limit, 15);
  prefetchCollection(client, `/collection?category=${encodeURIComponent("Nước hoa nam")}`);
  await client.browse({ facets: JSON.stringify({ gender: ["Nam"], brands: [], notes: [] }) });
  assert.equal(calls.length, 2);
  prefetchCollection(client, `/collection?brand=${encodeURIComponent("Abercrombie & Fitch")}`);
  await client.browse({ page: 1, limit: 15, facets: JSON.stringify({ brands: ["Abercrombie & Fitch"] }) });
  assert.equal(calls.length, 3);
  assert.equal(calls[2].params.limit, 15);
  prefetchCollection(client, "/about"); assert.equal(calls.length, 3);
  await client.browse({}, { force: true }); assert.equal(calls.length, 4);
});

test("related products read at most six category cards instead of the complete catalog", async t => {
  invalidateStorefrontCatalog();
  t.mock.method(Product, "findOne", () => ({ select: () => ({ lean: async () => ({ _id: fixture()._id, category: "Nước hoa nam", type: "EDP" }) }) }));
  let limit;
  t.mock.method(Product, "find", filter => {
    assert.deepEqual(filter._id, { $ne: fixture()._id });
    const query = { select(fields) { assert.deepEqual(fields.images, { $slice: 1 }); return this; }, sort() { return this; }, limit(value) { limit = value; return this; }, lean: async () => [fixture(2)] };
    return query;
  });
  const result = await readStorefrontRelated(fixture()._id);
  assert.equal(limit, 6); assert.equal(result.isFallback, false); assert.equal(result.products[0]._id, fixture(2)._id);
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

test("support read requests do not wait for uniqueness index initialization", async (t) => {
  for (const model of [Conversation, Message, Usage]) t.mock.method(model, "init", () => assert.fail("Read requests must not initialize indexes"));
  let proceeded = 0;
  await ensureSupportIndexes({ method: "GET" }, null, () => proceeded++);
  assert.equal(proceeded, 1);
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
