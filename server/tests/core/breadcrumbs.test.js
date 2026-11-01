import test from "node:test";
import assert from "node:assert/strict";
import { productBreadcrumbs, productBreadcrumbCategory, collectionBreadcrumbs } from "../../../client/src/utils/breadcrumbs.js";

test("products use their gender category before the brand and full product title", () => {
  for (const [gender, category] of [["Nam", "Nước hoa nam"], ["Nữ", "Nước hoa nữ"], ["Unisex", "Nước hoa unisex"]]) {
    const trail = productBreadcrumbs({ title: "Tên sản phẩm đầy đủ", gender, brand: "Dior" });
    assert.deepEqual(trail.map(item => item.label), [category, "Dior", "Tên sản phẩm đầy đủ"]);
    const parent = new URL(trail[0].to, "https://velours.test");
    const brand = new URL(trail[1].to, "https://velours.test");
    assert.equal(parent.pathname, "/collection");assert.equal(parent.searchParams.get("category"), category);
    assert.equal(parent.searchParams.has("brand"), false);
    assert.equal(brand.searchParams.get("category"), category);assert.equal(brand.searchParams.get("brand"), "Dior");
    assert.equal(trail[2].to, undefined);
  }
});

test("category resolution tolerates case and Unicode normalization without guessing unknown genders", () => {
  assert.equal(productBreadcrumbCategory({ gender: " NỮ ".normalize("NFD"), category: "Nước hoa nam" }), "Nước hoa nữ");
  assert.equal(productBreadcrumbCategory({ category: "Nước hoa unisex", gender: "" }), "Nước hoa unisex");
  const trail = productBreadcrumbs({ gender: "Chọn giới tính", category: "Nước hoa chưa phân loại", title: "Sản phẩm", brand: "Hãng" });
  assert.equal(trail[0].label, "Bộ sưu tập");assert.equal(trail[0].to, "/collection");
  assert.equal(new URL(trail[1].to, "https://velours.test").searchParams.has("category"), false);
});

test("brand links encode punctuation as brand data and cannot introduce extra filters", () => {
  const brand = "Dolce & Gabbana / Édition #1?gender=Nam";
  const trail = productBreadcrumbs({ gender: "Nữ", title: "L’Impératrice", brand });
  const url = new URL(trail[1].to, "https://velours.test");
  assert.equal(url.pathname, "/collection");assert.equal(url.hash, "");
  assert.deepEqual([...url.searchParams], [["category", "Nước hoa nữ"], ["brand", brand]]);
});

test("missing brands do not create empty breadcrumb levels", () => {
  assert.deepEqual(productBreadcrumbs({ title: "Sản phẩm", gender: "Nam", brand: "  " }).map(item => item.label), ["Nước hoa nam", "Sản phẩm"]);
});

test("collection trails remain consistent when navigating up from gender and brand filters", () => {
  assert.deepEqual(collectionBreadcrumbs(), [{ label: "Bộ sưu tập" }]);
  assert.deepEqual(collectionBreadcrumbs({ category: "Nước hoa nữ" }), [{ label: "Nước hoa nữ" }]);
  const filtered = collectionBreadcrumbs({ category: "Nước hoa nữ", brand: "Chanel" });
  assert.deepEqual(filtered.map(item => item.label), ["Nước hoa nữ", "Chanel"]);
  assert.equal(new URL(filtered[0].to, "https://velours.test").searchParams.get("category"), "Nước hoa nữ");
  assert.deepEqual(collectionBreadcrumbs({ brand: "Chanel" }), [{ label: "Bộ sưu tập", to: "/collection" }, { label: "Chanel" }]);
});
