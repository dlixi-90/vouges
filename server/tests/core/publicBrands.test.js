import test, { beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { buildPublicBrands, getPublicBrands, invalidatePublicBrands } from "../../services/publicBrands.js";
import { invalidateStorefrontCatalog } from "../../services/storefrontCatalog.js";
import { listBrands } from "../../controllers/brandController.js";
import Product from "../../models/Product.js";
import FragranceTerm from "../../models/FragranceTerm.js";
import productRouter from "../../routes/productRoute.js";
import logos from "../../data/brandImages.json" with { type: "json" };
import headerDirectory from "../../../client/src/data/brandDirectory.json" with { type: "json" };

beforeEach(invalidatePublicBrands);
afterEach(invalidatePublicBrands);

const product = (brand, overrides = {}) => ({ brand, sizes: ["50ml"], inStock: true, inventoryMode: "source", inStockBySize: { "50ml": true }, ...overrides });

test("public brand directory groups published products and counts source/tracked availability without exposing inventory", () => {
  const brands = buildPublicBrands([
    product(" Chanel "), product("CHANEL", { inStock: false }),
    product("Dior", { inventoryMode: "tracked", stockBySize: { "50ml": 3 } }),
    product("Dior", { inventoryMode: "tracked", stockBySize: { "50ml": 0 } }),
    product("Private", { isPublished: false }), product("Deleted", { isDeleted: true }),
    product(""), product(null), product("All sold out", { inStock: false }),
  ], [], []);
  assert.deepEqual(brands.map(b => [b.name, b.productCount, b.availableCount]), [
    ["All sold out", 1, 0], ["Chanel", 2, 1], ["Dior", 2, 1],
  ]);
  assert.deepEqual(Object.keys(brands[1]).sort(), ["availableCount", "image", "name", "productCount"]);
});

test("owner brand images take priority and source URLs match brands with different display names", () => {
  const images = [{name: "YSL", sourceUrl: "https://apaniche.vn/ysl", image: "/ysl.webp"}, {name: "Hermès", sourceUrl: "https://apaniche.vn/hermes", image: "/hermes.webp"}];
  const brands = buildPublicBrands([product("Yves Saint Laurent"), product("Hermes"), product("Dior")], [
    {name: "Yves Saint Laurent", sourceUrl: "https://apaniche.vn/ysl/"}, {name: "Dior", image: "/custom-dior.webp"},
  ], images);
  assert.equal(brands.find(b => b.name === "Yves Saint Laurent").image, "/ysl.webp");
  assert.equal(brands.find(b => b.name === "Hermes").image, "/hermes.webp");
  assert.equal(brands.find(b => b.name === "Dior").image, "/custom-dior.webp");
  assert.equal(buildPublicBrands([product("Unknown")], [], images)[0].image, "");
});

test("downloaded brand logos are local, present, nonempty and retain source attribution", () => {
  assert.ok(logos.brands.length > 100);
  for (const brand of logos.brands) {
    assert.ok(["apaniche.vn", "4711.com"].includes(new URL(brand.sourceUrl).hostname));
    assert.match(brand.image, /^\/images\/brands\/[a-z0-9.-]+$/);
    const file = new URL(`../../../client/public${brand.image}`, import.meta.url);
    assert.ok(fs.statSync(file).size > 0);
  }
});

const response = () => ({ statusCode: 200, headers: {}, set(key, value) {this.headers[key] = value;}, status(code) {this.statusCode = code; return this;}, json(body) {this.body = body; return this;} });
test("brand endpoint is public, returns counts and permits short HTTP caching", async t => {
  const route = productRouter.stack.find(layer => layer.route?.path === "/brands").route;
  assert.equal(route.methods.get, true);
  assert.equal(route.stack.length, 1);
  assert.equal(route.stack[0].handle, listBrands);
  let query;
  t.mock.method(Product, "find", filter => { query = filter; return { select: () => ({ lean: async () => [product("Chanel")] }) }; });
  t.mock.method(FragranceTerm, "find", () => ({ select: () => ({ lean: async () => [] }) }));
  const res = response(); await listBrands({}, res);
  assert.equal(query.isPublished.$ne, false);
  assert.equal(query.isDeleted.$ne, true);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.brands[0].availableCount, 1);
  assert.match(res.headers["Cache-Control"], /public, max-age=60/);
});

test("brand endpoint failures do not reveal database details", async t => {
  t.mock.method(Product, "find", () => { throw new Error("private database URI"); });
  t.mock.method(console, "error", () => {});
  const res = response(); await listBrands({}, res);
  assert.equal(res.statusCode, 500);
  assert.deepEqual(res.body, {success: false, message: "Không thể tải danh sách thương hiệu"});
});

test("brand reads share a request and expire after sixty seconds; catalog edits invalidate the directory", async t => {
  let reads = 0, clock = 100;
  t.mock.method(Date, "now", () => clock);
  t.mock.method(Product, "find", () => ({ select: () => ({ lean: async () => { reads++; return [product("Chanel")]; } }) }));
  const terms = t.mock.method(FragranceTerm, "find", () => ({ select: () => ({ lean: async () => [] }) }));
  const [first, second] = await Promise.all([getPublicBrands(), getPublicBrands()]);
  assert.equal(first, second); assert.equal(reads, 1);
  await getPublicBrands(); assert.equal(reads, 1);
  clock += 60001; await getPublicBrands(); assert.equal(reads, 2);
  invalidateStorefrontCatalog(); await getPublicBrands(); assert.equal(reads, 3);
  assert.equal(terms.mock.callCount(), 3);
});

test("a directory read started before an edit cannot replace the newer cached directory", async t => {
  const resolvers = [];
  t.mock.method(Product, "find", () => ({ select: () => ({ lean: () => new Promise(resolve => resolvers.push(resolve)) }) }));
  t.mock.method(FragranceTerm, "find", () => ({ select: () => ({ lean: async () => [] }) }));
  const old = getPublicBrands();
  invalidateStorefrontCatalog();
  const current = getPublicBrands();
  resolvers[1]([product("Dior")]); await current;
  resolvers[0]([product("Chanel")]); await old;
  assert.equal((await getPublicBrands())[0].name, "Dior");
  assert.equal(resolvers.length, 2);
});

test("failed directory refreshes can be retried without caching a failed promise", async t => {
  let reads = 0;
  t.mock.method(Product, "find", () => ({ select: () => ({ lean: async () => { if (++reads === 1) throw new Error("offline"); return [product("Dior")]; } }) }));
  t.mock.method(FragranceTerm, "find", () => ({ select: () => ({ lean: async () => [] }) }));
  await assert.rejects(getPublicBrands(), /offline/);
  assert.equal((await getPublicBrands())[0].name, "Dior"); assert.equal(reads, 2);
});

test("the immediate header directory contains only public names and working local logos", () => {
  assert.ok(headerDirectory.brands.length > 100);
  const names = new Set();
  for (const brand of headerDirectory.brands) {
    assert.deepEqual(Object.keys(brand).sort(), ["image", "name"]);
    assert.ok(brand.name.trim()); assert.equal(names.has(brand.name.toLocaleLowerCase("vi-VN")), false);
    names.add(brand.name.toLocaleLowerCase("vi-VN"));
    if (brand.image) {
      assert.match(brand.image, /^\/images\/brands\/[a-z0-9.-]+$/);
      assert.ok(fs.statSync(new URL(`../../../client/public${brand.image}`, import.meta.url)).size > 0);
    }
  }
});
