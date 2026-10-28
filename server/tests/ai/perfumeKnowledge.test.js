import test from "node:test";
import assert from "node:assert/strict";
import Product from "../../models/Product.js";
import { chatWithAI } from "../../controllers/aiController.js";
import { PERFUME_KNOWLEDGE_VERSION, PERFUME_KNOWLEDGE } from "../../services/ai/perfumeKnowledge.js";
import { searchProducts } from "../../services/ai/tools/searchProducts.js";
import { getProductDetails } from "../../services/ai/tools/getProductDetails.js";
import { compareProducts } from "../../services/ai/tools/compareProducts.js";
import { getProductOptions } from "../../services/ai/tools/productToolUtils.js";

const id = "507f1f77bcf86cd799439011", secondId = "507f1f77bcf86cd799439012";
const perfume = () => ({ _id: id, title: "Nước hoa kiểm thử", description: "Mô tả kiểm thử", category: "Nước hoa unisex", type: "Eau De Parfum (EDP)", brand: "Hãng kiểm thử", origin: "Pháp", concentration: "Eau De Parfum (EDP)", gender: "Unisex", catalogScope: "perfume", inventoryMode: "tracked", isPublished: true, inStock: true, sizes: ["10ml", "100ml"], price: { "10ml": 200000, "100ml": 2500000 }, stockBySize: { "10ml": 12, "100ml": 0 }, inStockBySize: { "10ml": true, "100ml": false }, fragrance: { group: "Gỗ Phương Đông", style: "Thanh lịch", notes: { top: [{ name: "Cam Bergamot", url: "https://example.com/note" }], middle: [], base: [{ name: "Vani" }] }, accords: [{ label: "Ngọt", displayedPercent: 82 }, { label: "Gỗ", displayedPercent: 70 }], longevity: [{ label: "Lâu 9-12H", displayedCount: 0, displayedPercent: 0 }], sillage: [{ label: "Xa", displayedCount: -5, displayedPercent: 130, sourceRawCount: -5 }], suitability: [{ label: "Đêm", displayedPercent: 88 }] } });
const query = rows => ({ select() { return this; }, lean: async () => rows });

test("each AI request receives the current perfume knowledge ahead of old chat history", async t => {
  const oldKey = process.env.GROQ_API_KEY;process.env.GROQ_API_KEY = "test-key";
  t.after(() => { if (oldKey === undefined) delete process.env.GROQ_API_KEY;else process.env.GROQ_API_KEY = oldKey; });
  let request;
  t.mock.method(globalThis, "fetch", async (_url, options) => { request = JSON.parse(options.body);return { ok: true, json: async () => ({ choices: [{ message: { role: "assistant", content: "Tôi tư vấn nước hoa." } }] }) }; });
  const res = { statusCode: 200, status(code) { this.statusCode = code;return this; }, json(body) { this.body = body;return this; } };
  await chatWithAI({ auth: () => ({ userId: "test-owner" }), body: { message: "Tôi muốn chọn nước hoa", history: [{ role: "assistant", content: "Trước đây cửa hàng có mỹ phẩm" }] } }, res);
  assert.equal(res.body.success, true);
  assert.equal(request.messages[0].role, "system");
  assert.ok(request.messages[0].content.includes(PERFUME_KNOWLEDGE_VERSION));
  assert.ok(request.messages[0].content.includes(PERFUME_KNOWLEDGE));
  assert.match(request.messages[0].content, /stockQuantity/);
  assert.match(request.messages[0].content, /1\.000\.000 ₫/);
  assert.equal(request.messages[1].content, "Trước đây cửa hàng có mỹ phẩm");
});

test("perfume search combines escaped brand, concentration, accord and note filters without losing the free query", async t => {
  let filter;
  t.mock.method(Product, "find", value => { filter = value;return query([perfume()]); });
  const found = await searchProducts({ query: "Bergamot", brand: "Hãng kiểm thử", concentration: "EDP", gender: "Unisex", fragranceGroup: "Gỗ", accord: "Ngọt", note: "Vani", availability: "available" });
  assert.equal(filter.catalogScope.$ne, "other");
  assert.equal(filter.brand.test("Hãng kiểm thử"), true);assert.equal(filter.brand.test("Hãng kiểm thử khác"), false);
  assert.equal(filter.concentration.test("Eau De Parfum (EDP)"), true);
  assert.ok(filter.$or.some(row => row["fragrance.notes.top.name"]?.test("Cam Bergamot")));
  assert.equal(filter.$and[0].$or[2]["fragrance.notes.base.name"].test("Vani"), true);
  assert.equal(found.products[0].availableOptions[0].stockQuantity, 12);
  assert.equal(found.products[0].brand, "Hãng kiểm thử");
  assert.equal(found.products[0].fragrance.suitability[0].displayedPercent, 88);
  await searchProducts({ brand: "A.*", note: "(Vani)" });
  assert.equal(filter.brand.test("Anything"), false);assert.equal(filter.brand.test("A.*"), true);
});

test("unsafe or unsupported perfume search arguments fail before a database query", async t => {
  const find = t.mock.method(Product, "find", () => assert.fail("Invalid input cannot query database"));
  for (const input of [{ brand: { $ne: "" } }, { note: ["Vani"] }, { concentration: "x".repeat(101) }, { userId: "someone" }, { maxPrice: 0.5 }]) await assert.rejects(searchProducts(input));
  assert.equal(find.mock.calls.length, 0);
});

test("details and comparison return actual perfume data and keep zero assessments distinct from unknown", async t => {
  const product = perfume();
  let detailsFilter, comparisonFilter;
  t.mock.method(Product, "findOne", filter => { detailsFilter = filter;return query(product); });
  t.mock.method(Product, "find", filter => { comparisonFilter = filter;return query([product, { ...product, _id: secondId, title: "Nước hoa thứ hai" }]); });
  const details = await getProductDetails({ productId: id });
  assert.equal(detailsFilter.catalogScope.$ne, "other");
  assert.equal(details.product.fragrance.notes.base[0].name, "Vani");
  assert.equal(details.product.fragrance.notes.top[0].url, undefined);
  assert.deepEqual(details.product.fragrance.longevity[0], { label: "Lâu 9-12H", displayedCount: 0, displayedPercent: 0 });
  assert.equal(details.product.fragrance.sillage[0].displayedCount, null);assert.equal(details.product.fragrance.sillage[0].displayedPercent, null);
  assert.equal(details.product.fragrance.sillage[0].sourceRawCount, undefined);
  assert.equal(details.product.productOptions[1].stockQuantity, 0);
  const comparison = await compareProducts({ productIds: [id, secondId] });
  assert.equal(comparisonFilter.catalogScope.$ne, "other");
  assert.equal(comparison.products[0].fragrance.accordPercentages[0].displayedPercent, 82);
});

test("source availability never masquerades as a physical stock count", () => {
  const options = getProductOptions({ ...perfume(), inventoryMode: "source", stockBySize: { "10ml": 0, "100ml": 0 } });
  assert.equal(options[0].stockQuantity, null);assert.equal(options[0].purchaseLimit, 100);
  assert.equal(options[1].purchaseLimit, 0);
});
