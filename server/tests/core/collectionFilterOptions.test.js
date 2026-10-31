import test from "node:test";
import assert from "node:assert/strict";
import { sortFilterOptions, filterOptionSearchKey } from "../../../client/src/utils/filterOptions.js";
import { collectStorefrontFilters } from "../../services/perfumeFilters.js";
import { createPublicCatalog } from "../../../client/src/utils/publicCatalog.js";

const product = (patch = {}) => ({
  title: "Perfume", brand: "Chanel", category: "Nước hoa nữ", sizes: ["50ml"],
  price: { "50ml": 1500000 }, stockBySize: { "50ml": 5 }, inStockBySize: { "50ml": true },
  inStock: true, inventoryMode: "tracked", isPublished: true, ...patch,
});

test("capacity choices sort by real volume, including decimal commas and litres, while preserving exact keys", () => {
  const choices = ["100ml", "6,5ml Mini", "6ml Mini", "1L", "800ml", "4.5ml Mini", "50ml + Mini 7ml", "Tiêu chuẩn", "5ml Mini", "100ml"];
  const original = [...choices];
  assert.deepEqual(sortFilterOptions("sizes", choices), ["4.5ml Mini", "5ml Mini", "6ml Mini", "6,5ml Mini", "50ml + Mini 7ml", "100ml", "800ml", "1L", "Tiêu chuẩn"]);
  assert.deepEqual(choices, original);
});

test("search supports Vietnamese accents, case and redundant spaces without changing display labels", () => {
  assert.equal(filterOptionSearchKey("  Đậu   Tonka "), "dau tonka");
  assert.equal(filterOptionSearchKey("10ml Dùng Thử").includes(filterOptionSearchKey("dung thu")), true);
  assert.equal(filterOptionSearchKey("État Libre d’Orange").includes("etat libre"), true);
});

test("filter choices exclude unavailable, unpublished, deleted, zero-price and capacity-less products", () => {
  const values = collectStorefrontFilters([
    product(), product({ brand: "Sold out", inStock: false }),
    product({ brand: "Empty stock", stockBySize: { "50ml": 0 } }),
    product({ brand: "Disabled", inStockBySize: { "50ml": false } }),
    product({ brand: "Unpublished", isPublished: false }), product({ brand: "Deleted", isDeleted: true }),
    product({ brand: "Missing price", price: { "50ml": 0 } }), product({ brand: "Missing capacity", sizes: [] }),
  ]);
  assert.deepEqual(values.brands, ["Chanel"]);
  assert.deepEqual(values.sizes, ["50ml"]);
});

test("size metadata uses current variants even when old derived filter values still exist", () => {
  const values = collectStorefrontFilters([product({
    sizes: ["50ml", "100ml"], price: { "50ml": 1500000, "100ml": 0 },
    stockBySize: { "50ml": 5, "100ml": 8 }, inStockBySize: { "50ml": true, "100ml": true },
    _filters: { brands: ["Chanel"], sizes: ["50ml", "100ml", "100ml Test"] },
  })]);
  assert.deepEqual(values.sizes, ["50ml"]);
});

test("source-based availability remains eligible without inventing physical inventory", () => {
  assert.deepEqual(collectStorefrontFilters([product({ inventoryMode: "source", stockBySize: { "50ml": 0 } })]).sizes, ["50ml"]);
});

test("filter metadata refreshes after fifteen seconds and manual refresh bypasses its cache", async t => {
  let clock = 0, reads = 0;
  t.mock.method(Date, "now", () => clock);
  const client = createPublicCatalog({ axios: { get: async url => {
    assert.equal(url, "/api/products/filters"); reads++;
    return { data: { success: true, options: { sizes: reads === 1 ? ["50ml", "100ml Test"] : ["50ml"] } } };
  } } });
  await client.filters(); clock = 14999;
  await client.filters(); assert.equal(reads, 1);
  clock = 15000;
  assert.deepEqual((await client.filters()).options.sizes, ["50ml"]);
  assert.equal(reads, 2);
  await client.filters({ force: true }); assert.equal(reads, 3);
});
