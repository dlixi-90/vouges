import test from "node:test";
import assert from "node:assert/strict";
import Product from "../../models/Product.js";
import User from "../../models/User.js";
import { addToCart, changeCartSize, updateCart } from "../../controllers/cartController.js";
import { getUserProfile } from "../../controllers/userController.js";
import { getCartAddedAt } from "../../utils/cartOrder.js";
import { getOrderedCartItems, moveCartSize, setCartLineAddedAt } from "../../../client/src/utils/cartOrder.js";
import cartRouter from "../../routes/cartRoute.js";
import authUser from "../../middleware/authMiddleware.js";
import { changeSizeSelection, getCartItemKey } from "../../../client/src/utils/cartSelection.js";

const id = "507f1f77bcf86cd799439011";
const request = (overrides = {}) => ({
  auth: () => ({ userId: "current_user" }),
  user: { cartData: { [id]: { S: 2, M: 3 } }, cartAddedAt: { [id]: { S: 100, M: 200 } } },
  body: { itemId: id, fromSize: "S", toSize: "M", fromQuantity: 2, toQuantity: 0, ...overrides },
});
const response = () => ({
  statusCode: 200,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});
const product = () => ({
  sizes: ["S", "M"],
  inStock: true,
  stockBySize: { S: 0, M: 5 },
  inStockBySize: { S: false, M: true },
});

test("size changes require authentication", () => {
  const route = cartRouter.stack.find((layer) => layer.route?.path === "/change-size").route;
  assert.equal(route.stack[0].handle, authUser);
  assert.equal(route.stack[1].handle, changeCartSize);
});

test("changing size moves all units, merging at the stock limit in one authenticated write", async (t) => {
  t.mock.method(Product, "findOne", async () => product());
  const write = t.mock.method(User, "findOneAndUpdate", async (filter, update) => {
    assert.equal(filter._id, "current_user");
    assert.equal(filter[`cartData.${id}.S`], 2);
    assert.equal(filter[`cartData.${id}.M`], 3);
    assert.equal(update.$unset[`cartData.${id}.S`], "");
    assert.equal(update.$set[`cartData.${id}.M`], 5);
    assert.equal(update.$set[`cartAddedAt.${id}.M`], 100);
    assert.equal(update.$unset[`cartAddedAt.${id}.S`], "");
    assert.equal(Object.keys(update.$set).length, 2);
    assert.equal(Object.keys(update.$unset).length, 2);
    return { cartData: { [id]: { M: 5 } } };
  });
  const res = response();
  await changeCartSize(request({ toQuantity: 3, userId: "another_user" }), res);
  assert.equal(res.body.success, true);
  assert.equal(res.body.quantity, 5);
  assert.equal(write.mock.callCount(), 1);
});

test("a stale source or destination causes a conflict rather than a partial move", async (t) => {
  t.mock.method(Product, "findOne", async () => product());
  t.mock.method(User, "findOneAndUpdate", async () => null);
  const res = response();
  await changeCartSize(request(), res);
  assert.equal(res.statusCode, 409);
  assert.equal(res.body.success, false);
});

test("a sold-out source can move to a new size, with protection against a concurrent destination add", async (t) => {
  t.mock.method(Product, "findOne", async () => product());
  t.mock.method(User, "findOneAndUpdate", async (filter, update) => {
    assert.deepEqual(filter.$or, [
      { [`cartData.${id}.M`]: { $exists: false } },
      { [`cartData.${id}.M`]: 0 },
    ]);
    assert.equal(update.$set[`cartData.${id}.M`], 2);
    return {};
  });
  const res = response();
  await changeCartSize(request(), res);
  assert.equal(res.body.quantity, 2);
});

test("unavailable, missing and insufficient-stock variants never mutate the cart", async (t) => {
  const write = t.mock.method(User, "findOneAndUpdate", async () => { throw new Error("Unexpected write"); });
  let currentProduct = product();
  t.mock.method(Product, "findOne", async () => currentProduct);
  for (const overrides of [{ toQuantity: 4 }, { toSize: "XL" }]) {
    const res = response();
    await changeCartSize(request(overrides), res);
    assert.equal(res.statusCode, 400);
  }
  for (const nextProduct of [
    { ...product(), inStock: false },
    { ...product(), inStockBySize: { M: false } },
    { ...product(), stockBySize: { M: 0 } },
    null,
  ]) {
    currentProduct = nextProduct;
    const res = response();
    await changeCartSize(request(), res);
    assert.equal(res.body.success, false);
  }
  assert.equal(write.mock.callCount(), 0);
});

test("invalid quantities and unsafe size paths are rejected before database access", async (t) => {
  const read = t.mock.method(Product, "findOne", async () => { throw new Error("Unexpected query"); });
  for (const overrides of [
    { fromQuantity: 0 }, { fromQuantity: 1.5 }, { toQuantity: -1 },
    { fromQuantity: "2" }, { toSize: "S" }, { itemId: "bad" },
    { toSize: "$size" }, { fromSize: "a.b" }, { toSize: "__proto__" },
  ]) {
    const res = response();
    await changeCartSize(request(overrides), res);
    assert.equal(res.statusCode, 400);
  }
  assert.equal(read.mock.callCount(), 0);
});

test("database failure reports failure without a second cart write", async (t) => {
  t.mock.method(Product, "findOne", async () => product());
  const write = t.mock.method(User, "findOneAndUpdate", async () => { throw new Error("offline"); });
  t.mock.method(console, "error", () => {});
  const res = response();
  await changeCartSize(request(), res);
  assert.equal(res.statusCode, 500);
  assert.equal(res.body.success, false);
  assert.equal(write.mock.callCount(), 1);
});

test("size changes preserve selection, without selecting unselected units during merges", () => {
  const source = getCartItemKey(id, "S");
  const target = getCartItemKey(id, "M");
  const other = getCartItemKey("other_product", "L");
  for (const sourceDeselected of [false, true]) {
    for (const targetDeselected of [false, true]) {
      for (const targetExists of [false, true]) {
        const initial = new Set([other]);
        if (sourceDeselected) initial.add(source);
        if (targetDeselected) initial.add(target);
        const next = changeSizeSelection(initial, id, "S", "M", targetExists);
        assert.equal(next.has(target), sourceDeselected || (targetExists && targetDeselected));
        assert.equal(next.has(source), false);
        assert.equal(next.has(other), true);
        assert.equal(initial.has(source), sourceDeselected);
      }
    }
  }
});

const secondId = "507f1f77bcf86cd799439012";
const thirdId = "507f1f77bcf86cd799439013";
const lineKeys = (cart, timestamps) => getOrderedCartItems(cart, timestamps)
  .map((item) => `${item._id}:${item.size}`);

const mockCartStorage = (t, initial = {}) => {
  const user = { cartData: {}, cartAddedAt: {}, ...structuredClone(initial) };
  const applyUpdate = async (_filter, update) => {
    for (const operator of ["$inc", "$set", "$unset"]) {
      for (const [path, value] of Object.entries(update[operator] || {})) {
        const [field, productId, size] = path.split(".");
        user[field] ||= {};
        user[field][productId] ||= {};
        if (operator === "$unset") delete user[field][productId][size];
        else if (operator === "$inc") user[field][productId][size] = (user[field][productId][size] || 0) + value;
        else user[field][productId][size] = value;
      }
    }
    return structuredClone(user);
  };
  t.mock.method(User, "findById", async () => structuredClone(user));
  t.mock.method(User, "findOneAndUpdate", applyUpdate);
  t.mock.method(User, "updateOne", applyUpdate);
  t.mock.method(Product, "findOne", async () => ({
    sizes: ["S", "M", "L"], inStock: true,
    stockBySize: { S: 20, M: 20, L: 20 },
  }));
  const call = async (handler, body) => {
    const res = response();
    await handler({ auth: () => ({ userId: "current_user" }), user: structuredClone(user), body }, res);
    assert.equal(res.body.success, true, res.body.message);
    return res.body;
  };
  return { user, call };
};

test("new cart lines sort newest first across products and sizes, even within one millisecond", async (t) => {
  t.mock.method(Date, "now", () => 1000000);
  const { user, call } = mockCartStorage(t);
  await call(addToCart, { itemId: id, size: "S" });
  await call(addToCart, { itemId: secondId, size: "M" });
  await call(addToCart, { itemId: id, size: "L" });
  assert.deepEqual(lineKeys(user.cartData, user.cartAddedAt), [`${id}:L`, `${secondId}:M`, `${id}:S`]);
  const profile = await call(getUserProfile);
  const restored = JSON.parse(JSON.stringify(profile));
  assert.deepEqual(lineKeys(restored.cartData, restored.cartAddedAt), [`${id}:L`, `${secondId}:M`, `${id}:S`]);
});

test("changing size preserves the middle row locally and after a profile reload", async (t) => {
  const { user, call } = mockCartStorage(t);
  await call(addToCart, { itemId: id, size: "S" });
  await call(addToCart, { itemId: secondId, size: "S" });
  await call(addToCart, { itemId: thirdId, size: "S" });
  const before = structuredClone(user);
  const result = await call(changeCartSize, { itemId: secondId, fromSize: "S", toSize: "M", fromQuantity: 1, toQuantity: 0 });
  const local = moveCartSize(before.cartData, secondId, "S", "M", result.quantity);
  const timestamps = setCartLineAddedAt(before.cartAddedAt, secondId, "M", result.addedAt);
  const expected = [`${thirdId}:S`, `${secondId}:M`, `${id}:S`];
  assert.deepEqual(Object.keys(local), Object.keys(before.cartData));
  assert.deepEqual(lineKeys(local, timestamps), expected);
  const profile = await call(getUserProfile);
  assert.deepEqual(lineKeys(profile.cartData, profile.cartAddedAt), expected);
  assert.equal(result.addedAt, before.cartAddedAt[secondId].S);
});

test("quantity edits and adding more of an existing line keep its original position", async (t) => {
  const { user, call } = mockCartStorage(t);
  await call(addToCart, { itemId: id, size: "S" });
  await call(addToCart, { itemId: secondId, size: "M" });
  const timestamp = user.cartAddedAt[id].S;
  await call(updateCart, { itemId: id, size: "S", quantity: 2 });
  await call(addToCart, { itemId: id, size: "S", quantity: 1 });
  assert.equal(user.cartAddedAt[id].S, timestamp);
  assert.deepEqual(lineKeys(user.cartData, user.cartAddedAt), [`${secondId}:M`, `${id}:S`]);
});

test("removing then re-adding a line gives it a new position at the top", async (t) => {
  const { user, call } = mockCartStorage(t);
  await call(addToCart, { itemId: id, size: "S" });
  await call(addToCart, { itemId: secondId, size: "M" });
  await call(updateCart, { itemId: id, size: "S", quantity: 0 });
  assert.equal(user.cartAddedAt[id]?.S, undefined);
  await call(addToCart, { itemId: id, size: "S" });
  assert.deepEqual(lineKeys(user.cartData, user.cartAddedAt), [`${id}:S`, `${secondId}:M`]);
});

test("merging into another size retains the position of the edited line", async (t) => {
  const { user, call } = mockCartStorage(t);
  await call(addToCart, { itemId: id, size: "S" });
  await call(addToCart, { itemId: secondId, size: "S" });
  await call(addToCart, { itemId: id, size: "M" });
  const sourceTimestamp = user.cartAddedAt[id].S;
  await call(changeCartSize, { itemId: id, fromSize: "S", toSize: "M", fromQuantity: 1, toQuantity: 1 });
  assert.equal(user.cartData[id].M, 2);
  assert.equal(user.cartAddedAt[id].M, sourceTimestamp);
  assert.deepEqual(lineKeys(user.cartData, user.cartAddedAt), [`${secondId}:S`, `${id}:M`]);
});

test("legacy carts preserve their baseline through size edits and later new additions", async (t) => {
  const { user, call } = mockCartStorage(t, { cartData: { [id]: { S: 1, M: 1 }, [secondId]: { S: 1 } } });
  const initialTimestamps = getCartAddedAt(user.cartData);
  await call(changeCartSize, { itemId: id, fromSize: "S", toSize: "L", fromQuantity: 1, toQuantity: 0 });
  assert.equal(user.cartAddedAt[id].L, initialTimestamps[id].S);
  assert.deepEqual(lineKeys(user.cartData, user.cartAddedAt), [`${secondId}:S`, `${id}:M`, `${id}:L`]);
  await call(addToCart, { itemId: thirdId, size: "S" });
  assert.deepEqual(lineKeys(user.cartData, user.cartAddedAt), [`${thirdId}:S`, `${secondId}:S`, `${id}:M`, `${id}:L`]);
});
