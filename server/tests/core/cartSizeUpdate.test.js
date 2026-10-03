import test from "node:test";
import assert from "node:assert/strict";
import { persistCartSizeChange } from "../../../client/src/utils/cartSizeUpdate.js";
import { getCartRowKey, getOrderedCartItems } from "../../../client/src/utils/cartOrder.js";

const setup = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  const changes = [];
  const controller = new AbortController();
  const input = {
    itemId: "product", fromSize: "S", toSize: "M",
    cartItems: { product: { S: 2, M: 1 } }, cartAddedAt: { product: { S: 100, M: 90 } }, addedAt: 100,
    apply: (state) => changes.push(state), send: () => promise, signal: controller.signal,
  };
  return { input, resolve, reject, changes, controller };
};

test("size and merged quantity change before the server responds, preserving row order", async () => {
  const { input, resolve, changes } = setup();
  const request = persistCartSizeChange(input);
  assert.deepEqual(changes[0], { sizes: { M: 3 }, timestamps: { M: 100 } });
  const rows = getOrderedCartItems({ product: changes[0].sizes, newer: { S: 1 } }, { product: changes[0].timestamps, newer: { S: 200 } });
  assert.deepEqual(rows.map((row) => row._id), ["newer", "product"]);
  resolve({ quantity: 3, addedAt: 100 });
  await request;
  assert.deepEqual(changes.at(-1), changes[0]);
  assert.deepEqual(input.cartItems.product, { S: 2, M: 1 });
});

test("failed size save restores both original size rows, quantities and timestamps", async () => {
  const { input, reject, changes } = setup();
  const request = persistCartSizeChange(input);
  reject(new Error("Stock changed"));
  await assert.rejects(request, /Stock changed/);
  assert.deepEqual(changes.at(-1), { sizes: { S: 2, M: 1 }, timestamps: { S: 100, M: 90 } });
});

test("sign-out never writes a late size result or rollback into the next account", async () => {
  const { input, resolve, controller, changes } = setup();
  const request = persistCartSizeChange(input);
  controller.abort();
  resolve({ quantity: 3 });
  await assert.rejects(request, { name: "AbortError" });
  assert.equal(changes.length, 1);
});

for (const [fromSize, toSize, sourceNewer] of [["200ml", "400ml", false], ["400ml", "200ml", true]]) {
  test(`merging ${fromSize} into ${toSize} keeps the edited row's identity, quantity and position`, async () => {
    const cartItems = { product: { "200ml": 1, "400ml": 2 }, other: { "100ml": 1 } };
    const cartAddedAt = { product: { [fromSize]: sourceNewer ? 300 : 100, [toSize]: sourceNewer ? 100 : 300 }, other: { "100ml": 200 } };
    const before = getOrderedCartItems(cartItems, cartAddedAt);
    const source = before.find((item) => item._id === "product" && item.size === fromSize);
    const target = before.find((item) => item._id === "product" && item.size === toSize);
    let merged;
    await persistCartSizeChange({ itemId: "product", fromSize, toSize, cartItems, cartAddedAt,
      addedAt: source.addedAt, signal: new AbortController().signal,
      apply: (state) => { merged = state; }, send: async () => ({ quantity: 3, addedAt: source.addedAt }) });
    assert.deepEqual(merged.sizes, { [toSize]: 3 });
    const after = getOrderedCartItems({ ...cartItems, product: merged.sizes }, { ...cartAddedAt, product: merged.timestamps });
    const remaining = after.find((item) => item._id === "product");
    assert.equal(getCartRowKey(remaining), getCartRowKey(source));
    assert.ok(after.every((item) => getCartRowKey(item) !== getCartRowKey(target)));
    assert.deepEqual(after.map((item) => item._id), sourceNewer ? ["product", "other"] : ["other", "product"]);
    assert.deepEqual(cartItems.product, { "200ml": 1, "400ml": 2 });
  });
}
