import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { v2 as cloudinary } from "cloudinary";
import Product from "../../models/Product.js";
import Category from "../../models/Category.js";
import { createProduct, updateProduct } from "../../controllers/productController.js";
import { planProductImages, resolveSizeImages, getSizeImage } from "../../utils/productImages.js";
import { getSizeImage as clientSizeImage, getDetailGallery } from "../../../client/src/utils/productImage.js";
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
  assert.equal(saved.fragrance.assessmentsVisible, true);
  assert.deepEqual(saved.fragrance.longevity, []);
  assert.ok(saved.qualityIssues.includes("missing_scent_group"));
});

test("new perfumes save their full scent profile and assessments without accepting source metadata", async t => {
  category(t);
  t.mock.method(cloudinary.uploader, "upload", async () => ({ secure_url: "https://example.com/new.png" }));
  const save = t.mock.method(Product, "create", async value => ({ ...value, _id: id }));
  const fragrance = {
    group: "  Woody Spicy  ", style: " Elegant ", assessmentsVisible: false, source: { provider: "forged" },
    notes: { top: [{ name: " Bergamot ", source: "forged" }], middle: [{ name: "Rose" }], base: [{ name: "Cedar" }] },
    accords: [{ label: "Woody", displayedPercent: 100, sourceValue: -999 }, { label: "Citrus", displayedPercent: 75.5 }],
    longevity: [{ label: "Khá 6-8H", displayedCount: 12, displayedPercent: 60, sourceValue: 999 }],
    sillage: [{ label: "Gần", displayedCount: 0, displayedPercent: null }],
    suitability: [{ label: "Xuân", displayedPercent: 80 }],
  };
  const res = response();
  await createProduct({ body: { productData: JSON.stringify({ ...data, brand: "Velours", fragrance }) }, files: [{ path: "new" }] }, res);
  assert.equal(res.statusCode, 201);
  const saved = save.mock.calls[0].arguments[0];
  assert.equal(saved.fragrance.group, "Woody Spicy"); assert.equal(saved.fragrance.style, "Elegant");
  assert.equal(saved.fragrance.assessmentsVisible, true); assert.equal(saved.fragrance.source, undefined);
  assert.deepEqual(saved.fragrance.notes, { top: [{ name: "Bergamot", url: null }], middle: [{ name: "Rose", url: null }], base: [{ name: "Cedar", url: null }] });
  assert.deepEqual(saved.fragrance.accords.map(row => row.displayedPercent), [100, 75.5]);
  assert.equal(saved.fragrance.accords[0].sourceValue, undefined);
  assert.equal(saved.fragrance.longevity[0].displayedCount, 12);
  assert.equal(saved.fragrance.longevity[0].sourceValue, undefined);
  assert.equal(saved.fragrance.sillage[0].displayedCount, 0); assert.equal(saved.fragrance.sillage[0].displayedPercent, null);
  assert.equal(saved.fragrance.suitability[0].displayedPercent, 80);
  assert.deepEqual(saved.qualityIssues, []);
  await new Product(saved).validate();
});

test("invalid new scent profiles fail before any uploads or product writes", async t => {
  category(t);
  const upload = t.mock.method(cloudinary.uploader, "upload", () => assert.fail("Invalid profiles must not upload images"));
  const save = t.mock.method(Product, "create", () => assert.fail("Invalid profiles must not create products"));
  for (const fragrance of [null, [], "bad", { group: 1 }, { style: "x".repeat(501) },
    { notes: [] }, { notes: { top: [{ name: " " }] } }, { notes: { top: [{ name: "Rose", url: "javascript:alert(1)" }] } },
    { notes: { base: Array.from({ length: 61 }, () => ({ name: "Rose" })) } },
    { accords: [{ label: "Woody", displayedPercent: 101 }] },
    { accords: [{ label: "Woody" }, { label: " woody " }] },
    { longevity: [{ label: "Long", displayedCount: -1 }] },
    { sillage: [{ label: "Near", displayedCount: 1.5 }] },
    { suitability: [{ label: "Day", displayedPercent: -10 }] },
  ]) {
    const res = response();
    await createProduct({ body: { productData: JSON.stringify({ ...data, fragrance }) }, files: [{ path: "new" }] }, res);
    assert.equal(res.statusCode, 400, JSON.stringify(fragrance));
  }
  assert.equal(upload.mock.callCount(), 0); assert.equal(save.mock.callCount(), 0);
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

test("detail gallery excludes the avatar and prioritizes the selected size photo", () => {
  const product={images:["avatar.webp","front.jpg","back.jpg","avatar.webp"],sizeImages:{"50ml":"size-50.jpg","100ml":"back.jpg"}};
  assert.deepEqual(getDetailGallery(product,"50ml"),["size-50.jpg","front.jpg","back.jpg"]);
  assert.deepEqual(getDetailGallery(product,"100ml"),["back.jpg","front.jpg"]);
  assert.equal(product.images.length,4);
});

test("detail gallery cannot reintroduce the avatar through size photos or an empty fallback", () => {
  assert.deepEqual(getDetailGallery({images:["avatar.jpg","gallery.jpg"],sizeImages:{M:"avatar.jpg"}},"M"),["gallery.jpg"]);
  assert.deepEqual(getDetailGallery({images:["avatar.jpg"],sizeImages:{M:"avatar.jpg"}},"M"),[]);
  assert.deepEqual(getDetailGallery(null,"M"),[]);
  assert.equal(clientSizeImage({images:["avatar.jpg"]},"M"),"avatar.jpg");
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
