import test from "node:test";
import assert from "node:assert/strict";
import { createCartUpdateQueue } from "../../../client/src/utils/cartUpdateQueue.js";

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const settle = async () => { await Promise.resolve(); await Promise.resolve(); };
const setup = (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const pending = [];
  const changes = [];
  const errors = [];
  const queue = createCartUpdateQueue({ onPendingChange: (keys) => pending.push(keys) });
  t.after(() => queue.cancelAll());
  const enqueue = (quantity, send, key = "product::M") => queue.enqueue({
    key, quantity, initialQuantity: 1, send,
    onChange: (value) => changes.push([key, value]),
    onError: (error) => errors.push(error.message),
  });
  return { queue, enqueue, changes, errors, pending };
};

test("rapid clicks update immediately but send only the final quantity", async (t) => {
  const { queue, enqueue, changes, pending } = setup(t);
  const sent = [];
  const send = async (quantity) => { sent.push(quantity); return { quantity }; };
  const results = [enqueue(2, send), enqueue(3, send), enqueue(4, send)];
  assert.deepEqual(changes.map(([, quantity]) => quantity), [2, 3, 4]);
  assert.equal(queue.hasPending(), true);
  assert.equal(sent.length, 0);
  t.mock.timers.tick(180);
  assert.deepEqual((await Promise.all(results)).map((result) => result.quantity), [4, 4, 4]);
  assert.deepEqual(sent, [4]);
  assert.equal(queue.hasPending(), false);
  assert.deepEqual(pending.at(-1), []);
});

test("old responses cannot overwrite newer clicks; writes for one line are serialized", async (t) => {
  const { enqueue, changes } = setup(t);
  const first = deferred();
  const second = deferred();
  const sent = [];
  const send = (quantity) => { sent.push(quantity); return sent.length === 1 ? first.promise : second.promise; };
  const one = enqueue(2, send);
  t.mock.timers.tick(180);
  const two = enqueue(5, send);
  assert.deepEqual(sent, [2]);
  first.resolve({ quantity: 2 });
  await settle();
  assert.equal(changes.at(-1)[1], 5);
  t.mock.timers.tick(0);
  assert.deepEqual(sent, [2, 5]);
  second.resolve({ quantity: 5 });
  assert.equal((await one).success, true);
  assert.equal((await two).quantity, 5);
});

test("deleting during an in-flight update cannot resurrect the cart line", async (t) => {
  const { enqueue, changes } = setup(t);
  const first = deferred();
  const sent = [];
  const send = (quantity) => { sent.push(quantity); return quantity === 0 ? Promise.resolve({ quantity: 0 }) : first.promise; };
  const updated = enqueue(2, send);
  t.mock.timers.tick(180);
  const removed = enqueue(0, send);
  assert.equal(changes.at(-1)[1], 0);
  first.resolve({ quantity: 2 });
  await settle();
  assert.equal(changes.at(-1)[1], 0);
  t.mock.timers.tick(0);
  assert.equal((await removed).quantity, 0);
  await updated;
  assert.deepEqual(sent, [2, 0]);
});

test("a failed last update rolls back to the last server-confirmed quantity", async (t) => {
  const { enqueue, changes, errors, queue } = setup(t);
  const first = deferred();
  const send = (quantity) => quantity === 2 ? first.promise : Promise.reject(new Error("Out of stock"));
  const one = enqueue(2, send);
  t.mock.timers.tick(180);
  const two = enqueue(3, send);
  first.resolve({ quantity: 2 });
  await settle();
  t.mock.timers.tick(0);
  assert.equal((await two).success, false);
  await one;
  assert.equal(changes.at(-1)[1], 2);
  assert.deepEqual(errors, ["Out of stock"]);
  assert.equal(queue.hasPending(), false);
});

test("a failed superseded request does not discard a newer valid quantity", async (t) => {
  const { enqueue, changes, errors } = setup(t);
  const first = deferred();
  const send = (quantity) => quantity === 5 ? first.promise : Promise.resolve({ quantity });
  const one = enqueue(5, send);
  t.mock.timers.tick(180);
  const two = enqueue(2, send);
  first.reject(new Error("Only two remaining"));
  await settle();
  t.mock.timers.tick(0);
  assert.equal((await two).quantity, 2);
  await one;
  assert.equal(changes.at(-1)[1], 2);
  assert.deepEqual(errors, []);
});

test("different cart lines save independently without a whole-cart lock", async (t) => {
  const { enqueue, pending } = setup(t);
  const slow = deferred();
  const one = enqueue(2, () => slow.promise, "slow::S");
  const two = enqueue(3, async (quantity) => ({ quantity }), "fast::M");
  t.mock.timers.tick(180);
  assert.equal((await two).success, true);
  assert.deepEqual(pending.at(-1), ["slow::S"]);
  slow.resolve({ quantity: 2 });
  await one;
  assert.deepEqual(pending.at(-1), []);
});

test("sign-out cancels queued writes and suppresses late responses", async (t) => {
  const { queue, enqueue, changes } = setup(t);
  const first = deferred();
  let signal;
  const one = enqueue(2, (_quantity, requestSignal) => { signal = requestSignal; return first.promise; });
  t.mock.timers.tick(180);
  const two = enqueue(3, async () => { throw new Error("Must not send"); }, "other::M");
  queue.cancelAll();
  assert.equal((await one).cancelled, true);
  assert.equal((await two).cancelled, true);
  assert.equal(signal.aborted, true);
  first.resolve({ quantity: 99 });
  await settle();
  t.mock.timers.tick(1000);
  assert.equal(changes.length, 2);
  assert.equal(queue.hasPending(), false);
});
