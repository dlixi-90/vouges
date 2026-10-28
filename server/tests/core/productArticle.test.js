import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { ARTICLE_LIMITS, sanitizeArticle, articleToPlainText, articleFromText, getArticleDocument, isArticleUrl } from "../../../client/src/utils/productArticle.js";
import { saveCatalogProduct } from "../../controllers/catalogController.js";
import Product from "../../models/Product.js";
import CatalogSource from "../../models/CatalogSource.js";
import Category from "../../models/Category.js";
import { v2 as cloudinary } from "cloudinary";
import { createProduct } from "../../controllers/productController.js";

const doc = content => ({ type: "doc", content });
const paragraph = text => ({ type: "paragraph", content: text ? [{ type: "text", text }] : [] });
const sample = () => doc([
  { type: "heading", attrs: { level: 2, textAlign: "center" }, content: [{ type: "text", text: "Câu chuyện hương thơm" }] },
  { type: "paragraph", content: [{ type: "text", text: "Nét thanh lịch", marks: [{ type: "bold" }, { type: "italic" }, { type: "textStyle", attrs: { color: "rgb(128, 0, 0)", fontSize: "18px" } }] }] },
  { type: "image", attrs: { src: "https://example.com/article.webp", alt: "Chai nước hoa", title: "Chi tiết thiết kế", articleWidth: 75, onerror: "alert(1)" } },
  { type: "bulletList", content: [{ type: "listItem", content: [paragraph("Sử dụng hằng ngày")] }] },
]);
const product = () => ({ _id: new mongoose.Types.ObjectId(), title: "Nước hoa", description: "Mô tả cũ", updatedAt: new Date("2026-10-28T00:00:00Z"), sizes: ["50ml"], price: { "50ml": 1000000 }, stockBySize: { "50ml": 10 }, inStockBySize: { "50ml": true }, inventoryMode: "source", fragrance: {}, qualityIssues: [], images: ["https://example.com/product.jpg"] });
const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });

test("article round trips Vietnamese text, formatting and images with only supported attributes", () => {
  const value = sanitizeArticle(sample());
  assert.equal(value.content[1].content[0].marks[2].attrs.color, "#800000");
  assert.equal(value.content[2].attrs.onerror, undefined);
  assert.equal(value.content[2].attrs.articleWidth, 75);
  assert.deepEqual(sanitizeArticle(value), value);
  assert.equal(articleToPlainText(value), "Câu chuyện hương thơm\nNét thanh lịch\nChi tiết thiết kế\nSử dụng hằng ngày");
});

test("old descriptions remain plain text, including literal HTML, and invalid stored articles fall back", () => {
  const text = "Mô tả tiếng Việt\n<script>alert(1)</script>";
  assert.equal(articleToPlainText(articleFromText(text)), text);
  assert.deepEqual(getArticleDocument({ type: "script" }, text), articleFromText(text));
  assert.equal(sanitizeArticle(null), null);
});

test("article links and images reject executable, credentialed, protocol-relative and control-character URLs", () => {
  for (const href of ["javascript:alert(1)", "data:text/html,test", "//evil.example", "/\\evil.example", "https://u:p@example.com/a", "java\nscript:alert(1)", "/images/a\u0000.png"]) {
    assert.equal(isArticleUrl(href), false, href);
    assert.equal(isArticleUrl(href, true), false, href);
    assert.throws(() => sanitizeArticle(doc([{ type: "image", attrs: { src: href } }])), error => error.statusCode === 400);
    assert.throws(() => sanitizeArticle(doc([{ type: "paragraph", content: [{ type: "text", text: "link", marks: [{ type: "link", attrs: { href } }] }] }])), error => error.statusCode === 400);
  }
  assert.equal(isArticleUrl("/images/article.webp", true), true);
  assert.equal(isArticleUrl("/collection"), true);
  assert.equal(isArticleUrl("/collection", true), false);
});

test("malformed structure, unsupported styles and oversized articles are rejected", () => {
  let nested = paragraph("deep");
  for (let i = 0; i < 15; i++) nested = { type: "blockquote", content: [nested] };
  for (const value of [doc([{ type: "script" }]), doc([{ type: "text", text: "root text" }]), doc([{ type: "heading", attrs: { level: 1 } }]), doc([{ type: "bulletList", content: [paragraph("wrong child")] }]), doc([nested]), doc([paragraph("x".repeat(ARTICLE_LIMITS.text + 1))]), doc(Array.from({ length: 31 }, () => ({ type: "image", attrs: { src: "https://example.com/a.jpg" } }))), doc([{ type: "paragraph", content: [{ type: "text", text: "unsafe", marks: [{ type: "textStyle", attrs: { color: "url(javascript:evil)" } }] }] }])]) {
    assert.throws(() => sanitizeArticle(value), error => error.statusCode === 400);
  }
});

test("catalog saves the structured article and derives legacy plain text without modifying gallery or source", async t => {
  const current = product();
  t.mock.method(Product, "findOne", async () => current);
  t.mock.method(CatalogSource, "updateOne", () => assert.fail("Source records must remain unchanged"));
  t.mock.method(Product, "findOneAndUpdate", async (_filter, { $set: update }) => {
    assert.deepEqual(update.descriptionContent, sanitizeArticle(sample()));
    assert.equal(update.description, articleToPlainText(sanitizeArticle(sample())));
    assert.equal(update.images, undefined);assert.equal(update.source, undefined);
    return { ...current, ...update };
  });
  const res = response();
  await saveCatalogProduct({ params: { id: String(current._id) }, body: { expectedUpdatedAt: current.updatedAt, descriptionContent: sample() } }, res);
  assert.equal(res.statusCode, 200);assert.equal(res.body.success, true);
});

test("catalog rejects unsafe articles before writing, and legacy plain-text edits clear stale formatting", async t => {
  const current = { ...product(), descriptionContent: sample() };
  t.mock.method(Product, "findOne", async () => current);
  const writes = [];
  t.mock.method(Product, "findOneAndUpdate", async (_filter, { $set: update }) => { writes.push(update);return { ...current, ...update }; });
  const invalid = response();
  await saveCatalogProduct({ params: { id: String(current._id) }, body: { expectedUpdatedAt: current.updatedAt, descriptionContent: doc([{ type: "script" }]) } }, invalid);
  assert.equal(invalid.statusCode, 400);assert.equal(writes.length, 0);
  const valid = response();
  await saveCatalogProduct({ params: { id: String(current._id) }, body: { expectedUpdatedAt: current.updatedAt, description: "Mô tả mới" } }, valid);
  assert.equal(valid.body.success, true);assert.equal(writes[0].descriptionContent, null);
});

test("long articles retain their full document while legacy consumers receive a bounded text description", async t => {
  const current = product(), article = doc([paragraph("Hương thơm ".repeat(1000))]);
  t.mock.method(Product, "findOne", async () => current);
  t.mock.method(Product, "findOneAndUpdate", async (_filter, { $set: update }) => {
    assert.equal(update.description.length, 5000);
    assert.equal(update.descriptionContent.content[0].content[0].text.length, 11000);
    return { ...current, ...update };
  });
  const res = response();
  await saveCatalogProduct({ params: { id: String(current._id) }, body: { expectedUpdatedAt: current.updatedAt, descriptionContent: article } }, res);
  assert.equal(res.body.success, true);
});

test("new products save article formatting separately from their gallery and ignore a forged plain-text summary", async t => {
  t.mock.method(Category, "findOne", async () => ({ name: "Nước hoa", types: [{ name: "EDP", nameKey: "edp" }] }));
  t.mock.method(cloudinary.uploader, "upload", async () => ({ secure_url: "https://example.com/product.jpg" }));
  const save = t.mock.method(Product, "create", async value => ({ ...value, _id: "507f1f77bcf86cd799439011" }));
  const res = response();
  await createProduct({ body: { productData: JSON.stringify({ title: "Nước hoa", description: "Forged summary", descriptionContent: sample(), category: "Nước hoa", type: "EDP", sizes: ["50ml"], price: { "50ml": 1000000 }, stockBySize: { "50ml": 10 } }) }, files: { images: [{ path: "article-test-gallery" }] } }, res);
  assert.equal(res.statusCode, 201);
  const saved = save.mock.calls[0].arguments[0];
  assert.deepEqual(saved.descriptionContent, sanitizeArticle(sample()));
  assert.equal(saved.description, articleToPlainText(sanitizeArticle(sample())));
  assert.deepEqual(saved.images, ["https://example.com/product.jpg"]);
  await new Product(saved).validate();
});
