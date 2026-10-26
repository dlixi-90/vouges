import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { v2 as cloudinary } from "cloudinary";
import Product from "../../models/Product.js";
import Category from "../../models/Category.js";
import { createProduct, updateProduct } from "../../controllers/productController.js";
import { planProductImages, resolveSizeImages, getSizeImage } from "../../utils/productImages.js";
import { getSizeImage as clientSizeImage } from "../../../client/src/utils/productImage.js";
import { saveVariantEdit } from "../../../client/src/utils/productVariantEdit.js";
import { restoreProductDraft } from "../../../client/src/utils/productDraft.js";
import { File } from "node:buffer";

const id = "507f1f77bcf86cd799439011";
const current = { _id: id, sizes: ["50ml", "100ml"], images: ["main.png"], sizeImages: { "50ml": "small.png", "100ml": "large.png" }, updatedAt: new Date(), inStock: true };
const data = { title: "Lotion", description: "Care", category: "Care", type: "Lotion", sizes: current.sizes, price: { "50ml": 20, "100ml": 30 }, stockBySize: { "50ml": 3, "100ml": 4 }, existingImages: current.images };
const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });
const category = (t) => t.mock.method(Category, "findOne", async () => ({ name: "Care", types: [{ name: "Lotion", nameKey: "lotion" }] }));

test("gallery and individual size photos are saved separately on creation", async (t) => {
  category(t);
  t.mock.method(cloudinary.uploader, "upload", async (path) => ({ secure_url: `https://example.com/${path}` }));
  const save = t.mock.method(Product, "create", async (value) => ({...value,_id:id}));
  const res = response();
  await createProduct({ body: { productData: JSON.stringify({ ...data, sizeImages: { "50ml": 0, "100ml": 1 } }) }, files: { images: [{ path: "main" }], sizeImages: [{ path: "small" }, { path: "large" }] } }, res);
  assert.equal(res.statusCode, 201);
  assert.equal(res.body.productId,id);
  const saved = save.mock.calls[0].arguments[0];
  assert.deepEqual(saved.images, ["https://example.com/main"]);
  assert.deepEqual(saved.sizeImages, { "50ml": "https://example.com/small", "100ml": "https://example.com/large" });
  assert.equal(saved.concentration,"Lotion");
  assert.ok(saved.qualityIssues.includes("missing_brand"));
  await new Product(saved).validate();
});

test("updating replaces and removes size photos without replacing gallery photos", async (t) => {
  category(t);
  t.mock.method(Product, "findOne", async () => current);
  t.mock.method(mongoose.connection, "transaction", async (callback) => callback({}));
  t.mock.method(cloudinary.uploader, "upload", async () => ({ secure_url: "new-small.png" }));
  const save = t.mock.method(Product, "findOneAndUpdate", async (_query, value) => value);
  const res = response();
  await updateProduct({ params: { productId: id }, body: { productData: JSON.stringify({ ...data, sizeImages: { "50ml": 0, "100ml": null } }) }, files: { sizeImages: [{ path: "replacement" }] } }, res);
  assert.equal(res.body.success, true);
  assert.deepEqual(save.mock.calls[0].arguments[1].sizeImages, { "50ml": "new-small.png" });
  assert.deepEqual(res.body.product.images, ["main.png"]);
});

test("legacy edits preserve photos, renames move photos, and deleted sizes lose their photo", () => {
  const plan = planProductImages(data, current, ["Small"], [{ from: "50ml", to: "Small" }], []);
  assert.deepEqual(resolveSizeImages(plan.references, []), { Small: "small.png" });
  assert.deepEqual(planProductImages(data, current, current.sizes, [], []).references, current.sizeImages);
});

test("invalid size, foreign URLs, wrong upload indices and unused uploads are rejected before uploads", () => {
  for (const sizeImages of [[], "invalid", { Unknown: 0 }, { "50ml": "https://foreign.example/a.png" }, { "50ml": "large.png" }, { "50ml": -1 }, { "50ml": 0.5 }, { "50ml": 2 }, { "50ml": 0, "100ml": 0 }, {}]) {
    assert.throws(() => planProductImages({ ...data, sizeImages }, current, current.sizes, [], { sizeImages: [{}] }), { statusCode: 400 });
  }
  assert.throws(() => planProductImages({ ...data, existingImages: [] }, current, current.sizes, [], { sizeImages: [{}] }), { statusCode: 400 });
});

test("client and server use the selected size with a gallery fallback for older products", () => {
  for (const select of [getSizeImage, clientSizeImage]) {
    assert.equal(select(current, "50ml"), "small.png");
    assert.equal(select(current, "100ml"), "large.png");
    assert.equal(select(current, "200ml"), "main.png");
    assert.equal(select({ images: ["legacy.png"] }, "50ml"), "legacy.png");
    assert.equal(select(null, "50ml"), null);
  }
});

test("editing, cancelling and restoring drafts retain the actual size image file independently", () => {
  const file = new File(["size bytes"], "small.png", { type: "image/png" });
  const rows = [{ id: "row", originalSize: "50ml", size: "50ml", price: 20, quantity: 3, image: "saved.png" }];
  const draft = { ...rows[0], size: "Small", image: file };
  const updated = saveVariantEdit(rows, "row", draft);
  assert.equal(updated[0].image, file);
  assert.equal(updated[0].originalSize, "50ml");
  assert.equal(rows[0].image, "saved.png");
  assert.equal(saveVariantEdit(rows, "row", { ...draft, image: null })[0].image, null);
  const restored = restoreProductDraft({ inputs: {}, sizePrices: updated, variantEdits: { row: draft }, newSizeImage: file }, []);
  assert.equal(restored.sizePrices[0].image, file);
  assert.equal(restored.variantEdits.row.image, file);
  assert.equal(restored.newSizeImage, file);
});
