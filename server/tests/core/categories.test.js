import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import Category from "../../models/Category.js";
import Product from "../../models/Product.js";
import { createCategory, listCategories, updateCategory, createCategoryType, updateCategoryType, deleteCategory, deleteCategoryType } from "../../controllers/categoryController.js";
import { initializeCategories, validateProductCategory } from "../../services/categoryService.js";
import categoryRouter from "../../routes/categoryRoute.js";
import authUser, { requireOwner } from "../../middleware/authMiddleware.js";
import { searchProducts } from "../../services/ai/tools/searchProducts.js";

const categoryId = "507f1f77bcf86cd799439011";
const response = () => ({
  statusCode: 200,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});

test("category mutations require authenticated owners", () => {
  for (const { route } of categoryRouter.stack.filter((layer) =>
    layer.route?.methods.post || layer.route?.methods.put || layer.route?.methods.delete)) {
    assert.equal(route.stack[0].handle, authUser);
    assert.equal(route.stack[1].handle, requireOwner);
  }
});

test("category creation rejects empty, non-string and oversized names", async () => {
  for (const name of [undefined, "  ", { $gt: "" }, "a".repeat(101)]) {
    const res = response();
    await createCategory({ body: { name } }, res);
    assert.equal(res.statusCode, 400);
  }
});

test("category creation saves its required first type in the same write and normalizes both names", async (t) => {
  t.mock.method(Category, "create", async (document) => {
    assert.deepEqual(document, {
      name: "Hand Care", nameKey: "hand care",
      types: [{ name: "Hand Cream", nameKey: "hand cream" }],
    });
    return new Category({ _id: categoryId, ...document });
  });
  const res = response();
  await createCategory({ body: { name: "  Hand   Care  ", typeName: "  Hand   Cream " } }, res);
  assert.equal(res.statusCode, 201);
  assert.equal(res.body.category.name, "Hand Care");
  assert.equal(res.body.category.types.length, 1);
  assert.equal(res.body.category.types[0].name, "Hand Cream");
  assert.ok(res.body.category.types[0]._id);
});

test("a category cannot be created without a valid product type", async (t) => {
  const create = t.mock.method(Category, "create", async () => { throw new Error("Must not write"); });
  for (const typeName of [undefined, null, "", "  ", 123, { name: "Cream" }, "x".repeat(101)]) {
    const res = response();
    await createCategory({ body: { name: "Hand Care", typeName } }, res);
    assert.equal(res.statusCode, 400);
    assert.match(res.body.message, /Tên loại sản phẩm/);
  }
  assert.equal(create.mock.callCount(), 0);
});

test("duplicate category names return a conflict", async (t) => {
  t.mock.method(Category, "create", async () => { throw { code: 11000 }; });
  const res = response();
  await createCategory({ body: { name: "face care", typeName: "Cream" } }, res);
  assert.equal(res.statusCode, 409);
  assert.equal(res.body.success, false);
});

test("category list returns stored categories", async (t) => {
  const categories = [{ _id: categoryId, name: "Face Care" }];
  t.mock.method(Category, "find", () => ({ select: () => ({ sort: async () => categories }) }));
  const res = response();
  await listCategories({}, res);
  assert.deepEqual(res.body, { success: true, categories });
});

test("rename updates matching products in the same transaction and escapes punctuation", async (t) => {
  const session = {};
  const current = { _id: categoryId, name: "Face (Care)+", async save(options) {
    assert.equal(options.session, session);
    assert.equal(this.nameKey, "skin care");
  } };
  t.mock.method(mongoose.connection, "transaction", async (callback) => callback(session));
  t.mock.method(Category, "findById", () => ({ session: async () => current }));
  const update = t.mock.method(Product, "updateMany", async (filter, values, options) => {
    assert.equal(options.session, session);
    assert.equal(filter.category.test("face (care)+"), true);
    assert.equal(filter.category.test("  Face   (Care)+  "), true);
    assert.equal(filter.category.test("Face Care"), false);
    assert.deepEqual(values, { $set: { category: "Skin Care" } });
  });
  const res = response();
  await updateCategory({ params: { categoryId }, body: { name: "Skin Care" } }, res);
  assert.equal(res.body.success, true);
  assert.equal(update.mock.callCount(), 1);
});

test("rename handles invalid and missing category IDs", async (t) => {
  let res = response();
  await updateCategory({ params: { categoryId: "bad-id" }, body: { name: "Test" } }, res);
  assert.equal(res.statusCode, 400);
  t.mock.method(mongoose.connection, "transaction", async (callback) => callback({}));
  t.mock.method(Category, "findById", () => ({ session: async () => null }));
  res = response();
  await updateCategory({ params: { categoryId }, body: { name: "Test" } }, res);
  assert.equal(res.statusCode, 404);
});

test("duplicate rename never changes product category names", async (t) => {
  t.mock.method(mongoose.connection, "transaction", async (callback) => callback({}));
  t.mock.method(Category, "findById", () => ({ session: async () => ({
    name: "Face Care", async save() { throw { code: 11000 }; },
  }) }));
  const update = t.mock.method(Product, "updateMany", async () => {});
  const res = response();
  await updateCategory({ params: { categoryId }, body: { name: "Body Care" } }, res);
  assert.equal(res.statusCode, 409);
  assert.equal(update.mock.callCount(), 0);
});

test("initialization imports existing categories without recreating renamed defaults", async (t) => {
  t.mock.method(Category, "init", async () => {});
  t.mock.method(Category, "exists", async () => ({ _id: categoryId }));
  t.mock.method(Product, "distinct", async (field) => field === "category" ? ["Skin Care"] : []);
  const upsert = t.mock.method(Category, "updateOne", async (filter) => {
    assert.equal(filter.nameKey, "skin care");
  });
  await initializeCategories();
  assert.equal(upsert.mock.callCount(), 1);
});

test("restart keeps the catalog empty after all unused categories are deleted", async (t) => {
  t.mock.method(Category, "init", async () => {});
  t.mock.method(Category, "exists", async () => null);
  t.mock.method(Product, "distinct", async () => []);
  const names = [];
  t.mock.method(Category, "updateOne", async (filter) => { names.push(filter.nameKey); });
  await initializeCategories();
  assert.deepEqual(names, []);
});

test("AI product search accepts newly created category names", async (t) => {
  t.mock.method(Product, "find", (filter) => {
    assert.equal(filter.category.test("Hand Care"), true);
    return { select: () => ({ lean: async () => [] }) };
  });
  await searchProducts({ category: "Hand Care" });
});

const typeId = "507f1f77bcf86cd799439012";
const mockCategory = (t, types = [{ _id: typeId, name: "Oil", nameKey: "oil" }]) => {
  const category = new Category({ _id: categoryId, name: "Body Care", nameKey: "body care", types });
  const session = {};
  t.mock.method(mongoose.connection, "transaction", async (callback) => callback(session));
  t.mock.method(Category, "findById", () => ({ session: async () => category }));
  t.mock.method(category, "save", async (options) => {
    assert.equal(options.session, session);
    return category;
  });
  return { category, session };
};

test("owner can add a normalized type to a category", async (t) => {
  mockCategory(t);
  const res = response();
  await createCategoryType({ params: { categoryId }, body: { name: "  Body   Lotion  " } }, res);
  assert.equal(res.statusCode, 201);
  assert.deepEqual(res.body.category.types.map((type) => type.name), ["Oil", "Body Lotion"]);
  assert.ok(res.body.category.types[1]._id);
});

test("type duplicates are rejected within a category", async (t) => {
  mockCategory(t);
  const res = response();
  await createCategoryType({ params: { categoryId }, body: { name: " OIL " } }, res);
  assert.equal(res.statusCode, 409);
});

test("the same type name can be added to a different category", async (t) => {
  mockCategory(t, []);
  const res = response();
  await createCategoryType({ params: { categoryId }, body: { name: "Oil" } }, res);
  assert.equal(res.statusCode, 201);
});

test("type rename updates only products in its own category in the same transaction", async (t) => {
  const { session } = mockCategory(t);
  const update = t.mock.method(Product, "updateMany", async (filter, values, options) => {
    assert.equal(options.session, session);
    assert.equal(filter.category.test("Body Care"), true);
    assert.equal(filter.category.test("Face Care"), false);
    assert.equal(filter.type.test("Oil"), true);
    assert.equal(filter.type.test("Lotion"), false);
    assert.deepEqual(values, { $set: { type: "Body Oil" } });
  });
  const res = response();
  await updateCategoryType({ params: { categoryId, typeId }, body: { name: "Body Oil" } }, res);
  assert.equal(res.body.success, true);
  assert.equal(String(res.body.category.types[0]._id), typeId);
  assert.equal(res.body.category.types[0].name, "Body Oil");
  assert.equal(update.mock.callCount(), 1);
});

test("type rename rejects a type belonging to another category", async (t) => {
  mockCategory(t, []);
  const res = response();
  await updateCategoryType({ params: { categoryId, typeId }, body: { name: "Body Oil" } }, res);
  assert.equal(res.statusCode, 404);
});

test("invalid type names and IDs are rejected", async () => {
  for (const name of ["  ", { $ne: "" }, "a".repeat(101)]) {
    const res = response();
    await createCategoryType({ params: { categoryId }, body: { name } }, res);
    assert.equal(res.statusCode, 400);
  }
  const res = response();
  await updateCategoryType({ params: { categoryId, typeId: "bad-id" }, body: { name: "Oil" } }, res);
  assert.equal(res.statusCode, 400);
});

test("initialization imports types from the matching category without duplicating existing types", async (t) => {
  t.mock.method(Category, "init", async () => {});
  t.mock.method(Category, "exists", async () => ({ _id: categoryId }));
  t.mock.method(Product, "distinct", async (field, filter) => {
    assert.deepEqual(filter.isDeleted, { $ne: true });
    if (field === "category") return ["Body Care"];
    assert.equal(filter.category.test("Body Care"), true);
    assert.equal(filter.category.test("Face Care"), false);
    return ["Oil", "  Body   Lotion  "];
  });
  const imported = [];
  t.mock.method(Category, "updateOne", async (filter, update) => {
    if (!update.$push) return;
    const type = update.$push.types;
    assert.equal(filter.nameKey, "body care");
    assert.deepEqual(filter["types.nameKey"], { $ne: type.nameKey });
    imported.push(type.name);
  });
  await initializeCategories();
  assert.deepEqual(imported, ["Oil", "Body Lotion"]);
});

test("product validation rejects types from another category and uses saved names", async (t) => {
  t.mock.method(Category, "findOne", async () => ({
    name: "Body Care", types: [{ name: "Body Oil", nameKey: "body oil" }],
  }));
  await assert.rejects(validateProductCategory({ category: "Body Care", type: "Shampoo" }),
    (error) => error.statusCode === 400);
  const product = { category: "body care", type: " body   OIL " };
  await validateProductCategory(product);
  assert.deepEqual(product, { category: "Body Care", type: "Body Oil" });
});

test("selecting a type ID determines its category even if the request names a different category", async (t) => {
  t.mock.method(Category, "findOne", async (filter) => {
    assert.deepEqual(filter, { "types._id": typeId });
    return {
      name: "Body Care",
      types: [{ _id: typeId, name: "Lotion", nameKey: "lotion" }],
    };
  });
  const product = { typeId, category: "Wrong category", type: "Wrong type" };
  await validateProductCategory(product);
  assert.deepEqual(product, { category: "Body Care", type: "Lotion" });
  const withoutCategory = { typeId };
  await validateProductCategory(withoutCategory);
  assert.deepEqual(withoutCategory, { category: "Body Care", type: "Lotion" });
});

test("invalid and deleted type IDs cannot select an arbitrary category", async (t) => {
  const query = t.mock.method(Category, "findOne", async () => null);
  for (const invalidId of ["", null, "missing", { $ne: null }]) {
    await assert.rejects(validateProductCategory({ typeId: invalidId }), (error) => error.statusCode === 400);
  }
  assert.equal(query.mock.callCount(), 0);
  await assert.rejects(validateProductCategory({ typeId }), (error) => error.statusCode === 400);
});

test("owner can delete an unused category including its types", async (t) => {
  const { category, session } = mockCategory(t);
  t.mock.method(Product, "exists", (filter) => {
    assert.deepEqual(filter.isDeleted, { $ne: true });
    assert.equal(filter.category.test("Body Care"), true);
    assert.equal(filter.category.test("Face Care"), false);
    assert.equal(filter.type, undefined);
    return { session: async (value) => { assert.equal(value, session); return null; } };
  });
  const remove = t.mock.method(category, "deleteOne", async (options) => {
    assert.equal(options.session, session);
  });
  const res = response();
  await deleteCategory({ params: { categoryId } }, res);
  assert.equal(res.body.success, true);
  assert.equal(res.body.categoryId, categoryId);
  assert.equal(remove.mock.callCount(), 1);
});

test("deletion is blocked when a category still has catalog products", async (t) => {
  const { category } = mockCategory(t);
  t.mock.method(Product, "exists", () => ({ session: async () => ({ _id: "product" }) }));
  const remove = t.mock.method(category, "deleteOne", async () => {});
  const res = response();
  await deleteCategory({ params: { categoryId } }, res);
  assert.equal(res.statusCode, 409);
  assert.match(res.body.message, /Hãy chuyển các sản phẩm/);
  assert.equal(remove.mock.callCount(), 0);
});

test("owner can delete an unused type while retaining its category and other types", async (t) => {
  const { category, session } = mockCategory(t, [
    { _id: typeId, name: "Oil", nameKey: "oil" },
    { name: "Lotion", nameKey: "lotion" },
  ]);
  t.mock.method(Product, "exists", (filter) => {
    assert.deepEqual(filter.isDeleted, { $ne: true });
    assert.equal(filter.category.test("Body Care"), true);
    assert.equal(filter.category.test("Face Care"), false);
    assert.equal(filter.type.test("oil"), true);
    assert.equal(filter.type.test("Lotion"), false);
    return { session: async (value) => { assert.equal(value, session); return null; } };
  });
  const res = response();
  await deleteCategoryType({ params: { categoryId, typeId } }, res);
  assert.equal(res.body.success, true);
  assert.equal(res.body.category.name, "Body Care");
  assert.deepEqual(res.body.category.types.map((type) => type.name), ["Lotion"]);
  assert.equal(category.save.mock.callCount(), 1);
});

test("deletion is blocked when a type still has catalog products", async (t) => {
  const { category } = mockCategory(t);
  t.mock.method(Product, "exists", () => ({ session: async () => ({ _id: "product" }) }));
  const res = response();
  await deleteCategoryType({ params: { categoryId, typeId } }, res);
  assert.equal(res.statusCode, 409);
  assert.equal(category.types.length, 1);
  assert.equal(category.save.mock.callCount(), 0);
});

test("delete rejects invalid IDs and a type from another category", async (t) => {
  for (const params of [{ categoryId: "bad-id", typeId }, { categoryId, typeId: "bad-id" }]) {
    const res = response();
    await deleteCategoryType({ params }, res);
    assert.equal(res.statusCode, 400);
  }
  mockCategory(t, []);
  const res = response();
  await deleteCategoryType({ params: { categoryId, typeId } }, res);
  assert.equal(res.statusCode, 404);
});

test("delete returns not found for a missing category", async (t) => {
  t.mock.method(mongoose.connection, "transaction", async (callback) => callback({}));
  t.mock.method(Category, "findById", () => ({ session: async () => null }));
  const res = response();
  await deleteCategory({ params: { categoryId } }, res);
  assert.equal(res.statusCode, 404);
});

test("failed deletion returns an error instead of success", async (t) => {
  const { category } = mockCategory(t);
  t.mock.method(Product, "exists", () => ({ session: async () => null }));
  t.mock.method(category, "deleteOne", async () => { throw new Error("Database unavailable"); });
  t.mock.method(console, "error", () => {});
  const res = response();
  await deleteCategory({ params: { categoryId } }, res);
  assert.equal(res.statusCode, 500);
  assert.equal(res.body.success, false);
});
