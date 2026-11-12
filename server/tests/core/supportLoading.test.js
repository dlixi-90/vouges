import test from "node:test";
import assert from "node:assert/strict";
import { startSupportFeed } from "../../../client/src/utils/supportFeed.js";
import { supportSnapshotVersion } from "../../../client/src/utils/supportChat.js";
import { createStoreResources } from "../../../client/src/utils/storeResources.js";

const id = "507f1f77bcf86cd799439011";
const path = `/api/support/conversations/${id}/events?limit=25`;
const snapshot = (sequence = 1) => ({ conversation: { _id: id, sequence, status: "active", unreadStaff: 0, unreadCustomer: 0, updatedAt: `2026-11-12T10:00:${String(sequence).padStart(2, "0")}Z` }, messages: [{ _id: String(sequence), sequence, content: `Message ${sequence}` }] });
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const settle = async () => { for (let index = 0; index < 20; index++) await Promise.resolve(); };
const timers = () => {
  let now = 0, serial = 0; const tasks = new Map();
  return {
    setTimeout(callback, delay) { const id = ++serial; tasks.set(id, { callback, at: now + delay }); return id; },
    clearTimeout(id) { tasks.delete(id); },
    async advance(ms) {
      const end = now + ms;
      for (;;) {
        const next = [...tasks.entries()].sort((a, b) => a[1].at - b[1].at)[0];
        if (!next || next[1].at > end) break;
        now = next[1].at; tasks.delete(next[0]); next[1].callback(); await settle();
      }
      now = end; await settle();
    },
    size: () => tasks.size,
  };
};
const harness = (overrides = {}) => {
  const documentTarget = new EventTarget(); documentTarget.hidden = false;
  const clock = timers(), streams = [], states = [], reads = [];
  let current;
  const base = {
    path, conversationFeed: true, api: { token: async () => "token", url: path => `https://example.test${path}` },
    documentTarget, timers: clock, getSnapshot: () => current,
    onSnapshot: value => { current = value; }, onConnection: (status, error) => states.push({ status, error }),
    readSnapshot: async (_signal, force) => { reads.push(force); return snapshot(); },
    fetchStream: async (url, { signal }) => {
      let controller, closed = false;
      const body = new ReadableStream({ start(value) { controller = value; }, cancel() { closed = true; } });
      signal.addEventListener("abort", () => { if (!closed) { closed = true; controller.error(new DOMException("Aborted", "AbortError")); } }, { once: true });
      streams.push({ url, signal, send(value) { controller.enqueue(new TextEncoder().encode(`event: snapshot\ndata: ${JSON.stringify(value)}\n\n`)); }, close() { closed = true; controller.close(); } });
      return { ok: true, body, headers: new Headers({ "content-type": "text/event-stream" }) };
    },
    ...overrides,
  };
  const stop = startSupportFeed(base);
  return { stop, clock, streams, states, reads, current: () => current, documentTarget };
};

test("a stalled initial JSON read never delays the live stream, and its late result cannot replace newer messages", async () => {
  const json = deferred();
  const feed = harness({ readSnapshot: () => json.promise });
  try {
    await settle(); assert.equal(feed.streams.length, 1);
    feed.streams[0].send(snapshot(5)); await settle();
    assert.equal(feed.current().conversation.sequence, 5);
    assert.equal(feed.states.at(-1).status, "live");
    json.resolve(snapshot(1)); await settle();
    assert.equal(feed.current().conversation.sequence, 5);
  } finally { feed.stop(); }
});

test("a buffered SSE connection does not block JSON history and falls back to fresh JSON without hiding existing messages", async () => {
  let calls = 0;
  const feed = harness({ deadlineMs: 60000, fetchStream: (_url, { signal }) => new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(signal.reason), { once: true })),
    readSnapshot: async (_signal, force) => { calls++; if (calls > 1) assert.equal(force, true); return snapshot(calls); } });
  try {
    await settle(); assert.equal(feed.current().conversation.sequence, 1);
    assert.equal(feed.states.some(state => state.status === "live"), false);
    await feed.clock.advance(10000);
    assert.equal(feed.current().conversation.sequence, 2); assert.equal(calls, 2);
    feed.documentTarget.hidden = true; feed.documentTarget.dispatchEvent(new Event("visibilitychange")); await settle();
    await feed.clock.advance(30000); assert.equal(calls, 2); assert.equal(feed.states.at(-1).status, "paused");
    feed.documentTarget.hidden = false; feed.documentTarget.dispatchEvent(new Event("visibilitychange")); await settle();
    assert.equal(calls, 3); assert.equal(feed.current().conversation.sequence, 3);
  } finally { feed.stop(); }
  assert.equal(feed.clock.size(), 0);
});

test("reconnecting sends the latest received revision instead of downloading unchanged history again", async () => {
  const feed = harness();
  try {
    await settle(); feed.streams[0].send(snapshot(6)); await settle(); feed.streams[0].close(); await settle();
    await feed.clock.advance(250);
    assert.equal(feed.streams.length, 2);
    assert.equal(new URL(feed.streams[1].url).searchParams.get("since"), supportSnapshotVersion(snapshot(6)));
  } finally { feed.stop(); }
});

test("authorization failures stop polling and cleanup prevents late private responses from being displayed", async () => {
  const initial = deferred();
  const feed = harness({ readSnapshot: () => initial.promise, fetchStream: async () => ({ ok: false, status: 403 }) });
  await settle(); assert.equal(feed.states.at(-1).status, "error");
  initial.resolve(snapshot()); await settle(); assert.equal(feed.current(), undefined);
  await feed.clock.advance(60000); assert.equal(feed.clock.size(), 0);
  feed.stop();
  const late = deferred(), leaving = harness({ readSnapshot: () => late.promise });
  await settle(); leaving.stop(); late.resolve(snapshot()); await settle();
  assert.equal(leaving.current(), undefined); assert.equal(leaving.streams[0].signal.aborted, true);
});

test("three stream failures become disconnected and a successful retry recovers automatically", async () => {
  let attempts = 0;
  const feed = harness({ fetchStream: async (_url, { signal }) => {
    attempts++; if (attempts < 4) throw new TypeError("Network error");
    let closed = false;
    const body = new ReadableStream({ start(controller) {
      controller.enqueue(new TextEncoder().encode(`event: snapshot\ndata: ${JSON.stringify(snapshot(7))}\n\n`));
      signal.addEventListener("abort", () => { if (!closed) controller.error(signal.reason); }, { once: true });
    }, cancel() { closed = true; } });
    return { ok: true, body, headers: new Headers({ "content-type": "text/event-stream" }) };
  } });
  try {
    await settle(); assert.equal(feed.states.at(-1).status, "reconnecting");
    await feed.clock.advance(1000); await feed.clock.advance(2000);
    assert.equal(attempts, 3); assert.equal(feed.states.at(-1).status, "error");
    await feed.clock.advance(4000);
    assert.equal(attempts, 4); assert.equal(feed.states.at(-1).status, "live");
    assert.equal(feed.current().conversation.sequence, 7);
  } finally { feed.stop(); }
});

test("conversation prefetch and open share one 25-message request; revisiting uses recent cached history", async () => {
  let calls = 0;
  const request = deferred();
  const resources = createStoreResources({ userId: "owner", getToken: async () => "token", axios: { get: async url => {
    calls++; assert.equal(url, `/api/support/conversations/${id}/messages?limit=25`); return request.promise;
  } } });
  const prefetch = resources.loadSupportConversation(id), mounted = resources.loadSupportConversation(id);
  await settle(); assert.equal(calls, 1); request.resolve({ data: { success: true, ...snapshot() } });
  await Promise.all([prefetch, mounted]);
  assert.equal((await resources.loadSupportConversation(id)).messages[0].content, "Message 1"); assert.equal(calls, 1);
  resources.invalidateSupportInbox(); assert.ok(resources.peekSupportConversation(id));
  resources.invalidateSupport(); assert.equal(resources.peekSupportConversation(id), undefined);
});

test("thread caches retain at most 50 recent messages, ignore stale metadata and never cross account/role changes", () => {
  const owner = createStoreResources({ userId: "owner" });
  owner.setSupportConversation(id, { ...snapshot(55), messages: Array.from({ length: 70 }, (_, index) => ({ _id: String(index), sequence: index })) });
  assert.equal(owner.peekSupportConversation(id).messages.length, 50);
  owner.setSupportConversation(id, snapshot(1));
  assert.equal(owner.peekSupportConversation(id).conversation.sequence, 55);
  assert.equal(createStoreResources({ userId: "customer" }).peekSupportConversation(id), undefined);
  owner.clear(); assert.equal(owner.peekSupportConversation(id), undefined);
});
