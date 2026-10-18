import test from "node:test";
import assert from "node:assert/strict";
import { selectRelatedProducts } from "../../../client/src/utils/relatedProducts.js";

const product = { _id: "new-shampoo", category: "Về tóc", type: "Gội" };

test("a product alone in a new category still gets fallback recommendations", () => {
  const catalog = [
    product,
    { _id: "other", category: "Body Care", type: "Lotion" },
    { _id: "popular", category: "Face Care", type: "Serum", popular: true },
    { _id: "same-type", category: "Tóc tai", type: "Gội" },
  ];
  const before = structuredClone(catalog);
  const selection = selectRelatedProducts(catalog, product);
  assert.equal(selection.isFallback, true);
  assert.deepEqual(selection.products.map((item) => item._id), ["same-type", "popular", "other"]);
  assert.deepEqual(catalog, before);
});

test("matching categories keep Related Products without filling with unrelated items", () => {
  const related = { _id: "related", category: "  VỀ   TÓC  " };
  const selection = selectRelatedProducts([
    product, { _id: "other", category: "Body Care", popular: true }, related,
    { _id: "deleted", category: "Về tóc", isDeleted: true },
  ], product);
  assert.deepEqual(selection, { products: [related], isFallback: false });
});

test("both related and fallback selections are limited to six and exclude the current product", () => {
  for (const category of ["Về tóc", "Hair Care"]) {
    const others = Array.from({ length: 8 }, (_, index) => ({ _id: `item-${index}`, category }));
    const selection = selectRelatedProducts([product, ...others], product);
    assert.equal(selection.products.length, 6);
    assert.equal(selection.isFallback, category !== product.category);
    assert.ok(selection.products.every((item) => item._id !== product._id));
  }
});

test("no other published products leaves the section empty", () => {
  const selection = selectRelatedProducts([
    product, { _id: "deleted", category: "Body Care", isDeleted: true },
  ], product);
  assert.deepEqual(selection.products, []);
});
