import test from "node:test";
import assert from "node:assert/strict";
import { persistCartSizeChange } from "../../../client/src/utils/cartSizeUpdate.js";
import { getOrderedCartItems } from "../../../client/src/utils/cartOrder.js";

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
