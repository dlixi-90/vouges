import test from "node:test";
import assert from "node:assert/strict";
import { File } from "node:buffer";
import { restoreProductDraft, getProductTypeSelection } from "../../../client/src/utils/productDraft.js";
import { saveVariantEdit } from "../../../client/src/utils/productVariantEdit.js";

const categories = [{ _id: "cat", name: "Skin Care", types: [{ _id: "type", name: "Cream" }] }];
const makeDraft = () => ({
  inputs: { title: "Unfinished product", description: "Description", ingredients: "Aloe", category: "Old category", type: "Old type" },
  images: { 1: new File(["image bytes"], "photo.png", { type: "image/png" }), 2: "saved-image.png" },
  sizePrices: [{ id: "row", originalSize: "M", size: "Large", price: 125, quantity: 6 }],
  variantEdits: { row: { size: "XL", price: "150", quantity: "8" } },
  newSize: "XL", newPrice: "150", newQuantity: "3",
  loadedProductId: "product", loadedUpdatedAt: "2026-09-01",
  categoryId: "cat", typeId: "type",
});

test("returning from categories retains text, actual image files, variant edits and unfinished variant inputs", async () => {
  const draft = makeDraft();
  const restored = restoreProductDraft(draft, categories);
  assert.equal(restored.inputs.title, "Unfinished product");
  assert.equal(restored.inputs.description, "Description");
  assert.equal(restored.inputs.ingredients, "Aloe");
  assert.equal(restored.images[1], draft.images[1]);
  assert.equal(await restored.images[1].text(), "image bytes");
  assert.equal(restored.images[2], "saved-image.png");
  assert.deepEqual(restored.sizePrices, draft.sizePrices);
  assert.deepEqual(restored.variantEdits, draft.variantEdits);
  assert.equal(restored.newSize, "XL");
  assert.equal(restored.newPrice, "150");
  assert.equal(restored.newQuantity, "3");
  assert.equal(restored.loadedUpdatedAt, "2026-09-01");
});

test("renamed categories and types restore by ID without changing the original draft", () => {
  const draft = makeDraft();
  const restored = restoreProductDraft(draft, categories);
  assert.equal(restored.inputs.category, "Skin Care");
  assert.equal(restored.inputs.type, "Cream");
  assert.equal(draft.inputs.category, "Old category");
});

test("the newly added type is selected on return while the remaining product inputs are kept", () => {
  const draft = makeDraft();
  const nextCategories = [...categories, { _id: "new", name: "Hair", types: [{ _id: "shampoo", name: "Shampoo" }] }];
  const restored = restoreProductDraft(draft, nextCategories, { categoryId: "new", typeId: "shampoo" });
  assert.equal(restored.inputs.category, "Hair");
  assert.equal(restored.inputs.type, "Shampoo");
  assert.equal(restored.inputs.title, draft.inputs.title);
  assert.equal(restored.images, draft.images);
});

test("removed types are cleared; absent drafts do not produce a phantom product", () => {
  const restored = restoreProductDraft(makeDraft(), [{ ...categories[0], types: [] }]);
  assert.equal(restored.inputs.type, "");
  assert.equal(restoreProductDraft(undefined, categories), undefined);
});

test("type IDs distinguish identical type names in different categories", () => {
  const options = [...categories, { _id: "body", name: "Body Care", types: [{ _id: "body-cream", name: "Cream" }] }];
  assert.equal(getProductTypeSelection(options, { typeId: "type" }).category.name, "Skin Care");
  assert.equal(getProductTypeSelection(options, { typeId: "body-cream" }).category.name, "Body Care");
  assert.equal(getProductTypeSelection(options, { category: "Body Care", type: "Cream" }).type._id, "body-cream");
});

test("cleared or deleted selections do not fall back to an unrelated type", () => {
  assert.equal(getProductTypeSelection(categories, { typeId: "" }), null);
  assert.equal(getProductTypeSelection(categories, { typeId: "deleted", category: "Skin Care", type: "Cream" }), null);
});

test("returning from Add Category restores the type ID and its derived category", () => {
  const draft = restoreProductDraft(makeDraft(), categories, { categoryId: "cat", typeId: "type" });
  assert.equal(draft.inputs.typeId, "type");
  assert.equal(getProductTypeSelection(categories, draft.inputs).category.name, "Skin Care");
});

test("saving a variant commits all three fields without losing its original size or changing other rows", () => {
  const rows = [...makeDraft().sizePrices, { id: "second", size: "Small", price: 70, quantity: 3 }];
  const result = saveVariantEdit(rows, "row", { size: " XL ", price: "150", quantity: "0" });
  assert.deepEqual(result[0], { id: "row", originalSize: "M", size: "XL", price: 150, quantity: 0 });
  assert.equal(result[1], rows[1]);
  assert.equal(rows[0].size, "Large");
  assert.equal(rows[0].price, 125);
});

test("invalid variant edits leave the confirmed values unchanged", () => {
  const rows = makeDraft().sizePrices;
  const original = structuredClone(rows);
  for (const change of [
    { size: " " }, { size: "bad.size" }, { price: "" }, { price: "-2" },
    { quantity: "" }, { quantity: "1.5" }, { quantity: "-1" },
  ]) {
    assert.throws(() => saveVariantEdit(rows, "row", { ...rows[0], ...change }));
    assert.deepEqual(rows, original);
  }
});

test("saving rejects duplicate size names without treating the edited row as a duplicate of itself", () => {
  const rows = [...makeDraft().sizePrices, { id: "second", size: "Small", price: 70, quantity: 3 }];
  assert.throws(() => saveVariantEdit(rows, "row", { ...rows[0], size: " small " }), /đã tồn tại/);
  assert.doesNotThrow(() => saveVariantEdit(rows, "row", { ...rows[0], size: "Large" }));
});
