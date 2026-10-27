import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { buildPublicBrands } from "../../services/publicBrands.js";
import { listBrands } from "../../controllers/brandController.js";
import Product from "../../models/Product.js";
import FragranceTerm from "../../models/FragranceTerm.js";
import productRouter from "../../routes/productRoute.js";
import logos from "../../data/brandImages.json" with { type: "json" };

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
