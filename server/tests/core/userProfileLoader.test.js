import test from "node:test";
import assert from "node:assert/strict";
import { createUserProfileLoader } from "../../../client/src/utils/userProfileLoader.js";

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

test("concurrent profile consumers share one request and the current token reader", async () => {
  const pending = deferred();
  const token = () => "current-session";
  let calls = 0;
  const results = [];
  const loader = createUserProfileLoader({
    request: (id, signal, readToken) => {
      calls++;
      assert.equal(id, "user-a");
      assert.equal(signal.aborted, false);
      assert.equal(readToken, token);
      return pending.promise;
    },
    onSuccess: (...result) => results.push(result),
    onError: assert.fail,
  });
  const first = loader.load("user-a", token);
  assert.equal(loader.load("user-a", token), first);
  pending.resolve({ role: "owner" });
  await first;
  assert.equal(calls, 1);
  assert.deepEqual(results, [["user-a", { role: "owner" }]]);
});

test("account changes suppress an old owner's profile even if abort is ignored", async () => {
  const old = deferred();
  const results = [];
  let oldSignal;
  const loader = createUserProfileLoader({
    request: (id, signal) => {
      if (id === "old") { oldSignal = signal; return old.promise; }
      return { role: "user" };
    },
    onSuccess: (...result) => results.push(result), onError: assert.fail,
  });
  const first = loader.load("old");
  await Promise.resolve();
  await loader.load("new");
  old.resolve({ role: "owner" });
  await first;
  assert.equal(oldSignal.aborted, true);
  assert.deepEqual(results, [["new", { role: "user" }]]);
});

test("sign-out cancels profile reads without applying stale errors or cart data", async () => {
  for (const fail of [false, true]) {
    const pending = deferred();
    const loader = createUserProfileLoader({
      request: () => pending.promise, onSuccess: assert.fail, onError: assert.fail,
    });
    const request = loader.load("user");
    await Promise.resolve();
    loader.cancel();
    if (fail) pending.reject(new Error("late failure"));
    else pending.resolve({ cartData: { old: true } });
    await request;
  }
});

test("a failed profile read can be retried instead of remaining stuck", async () => {
  let calls = 0;
  let failures = 0;
  let successes = 0;
  const loader = createUserProfileLoader({
    request: async () => { if (++calls === 1) throw new Error("timeout"); return {}; },
    onSuccess: () => successes++, onError: () => failures++,
  });
  await loader.load("user");
  await loader.load("user");
  assert.equal(failures, 1);
  assert.equal(successes, 1);
});
