import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import mongoose from "mongoose";
import Conversation from "../../models/SupportConversation.js";
import Message from "../../models/SupportMessage.js";
import Usage from "../../models/SupportUsage.js";
import router from "../../routes/supportRoute.js";
import authUser, { requireOwner } from "../../middleware/authMiddleware.js";
import { supportRateLimit } from "../../middleware/supportRateLimit.js";
import { findConversation, normalizeContext, normalizeSupportMessage, sendSupportMessage, supportSnapshot, conversationView } from "../../services/supportService.js";
import { getSupportMessages, markSupportRead, getSupportInbox, startSupport, streamSupportConversation } from "../../controllers/supportController.js";
import { streamSnapshots } from "../../services/supportStream.js";
import { createSupportEventParser } from "../../../client/src/utils/supportChat.js";

const id = "507f1f77bcf86cd799439011";
const customer = { _id: "buyer", role: "user", username: "Khách hàng", email: "buyer@example.com" };
const staff = { _id: "staff", role: "owner", username: "Nhân viên" };
const draft = { content: "Xin tư vấn", clientMessageId: "00000000-0000-4000-8000-000000000001" };
const conversation = (overrides = {}) => ({ _id: id, userId: customer._id, customerName: customer.username,
  status: "waiting", sequence: 0, unreadStaff: 0, unreadCustomer: 0, context: [], updatedAt: new Date(), ...overrides });
const query = (value) => ({ session() { return this; }, lean: async () => typeof value === "function" ? value() : value });
const response = () => ({ headers: {}, statusCode: 200, set(key, value) { this.headers[key] = value; return this; },
  status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });
const next = (error) => { if (error) throw error; };

test("all support routes authenticate and inbox/status management also requires an owner", () => {
  assert.equal(router.stack[0].handle, authUser);
  for (const layer of router.stack.filter((item) => item.route)) {
    if (layer.route.path.startsWith("/inbox") || layer.route.path.endsWith("/status"))
      assert.ok(layer.route.stack.some((item) => item.handle === requireOwner));
    if (layer.route.methods.post && layer.route.path !== "/conversations/:id/read")
      assert.ok(layer.route.stack.some((item) => item.handle === supportRateLimit));
  }
});

test("customers cannot read, stream or send into someone else's conversation", async (t) => {
  t.mock.method(Conversation, "findOne", (filter) => {
    assert.deepEqual(filter, { _id: id, userId: "intruder" });
    return query(null);
  });
  await assert.rejects(findConversation(id, { _id: "intruder", role: "user" }), { statusCode: 404 });
  const res = response();
  await getSupportMessages({ params: { id }, user: { _id: "intruder", role: "user" }, query: {} }, res, next);
  assert.equal(res.statusCode, 404);
  const stream = response();
  await streamSupportConversation({ params: { id }, user: { _id: "intruder", role: "user" }, query: {} }, stream, next);
  assert.equal(stream.statusCode, 404);
  assert.equal(stream.headers["Content-Type"], undefined);
  const session = { withTransaction: async (callback) => callback(), endSession: async () => {} };
  t.mock.method(mongoose, "startSession", async () => session);
  const create = t.mock.method(Message, "create", () => assert.fail("Must not send"));
  await assert.rejects(sendSupportMessage(id, { _id: "intruder", role: "user" }, draft), { statusCode: 404 });
  assert.equal(create.mock.callCount(), 0);
});

test("message validation rejects oversized, blank, injected and missing-id payloads before database access", async (t) => {
  const session = t.mock.method(mongoose, "startSession", () => assert.fail("No database access"));
  for (const body of [{ ...draft, content: " " }, { ...draft, content: "x".repeat(3001) }, { ...draft, content: { $ne: null } }, { content: "Hello" }])
    await assert.rejects(sendSupportMessage(id, customer, body), { statusCode: 400 });
  assert.equal(session.mock.callCount(), 0);
  assert.deepEqual(normalizeSupportMessage({ ...draft, content: "  hello  ", role: "staff", senderId: "fake" }), { ...draft, content: "hello" });
});

test("AI handoff context is bounded and cannot impersonate system or staff messages", () => {
  assert.deepEqual(normalizeContext([{ role: "assistant", content: "  Chào bạn  ", userId: "fake" }]), [{ role: "assistant", content: "Chào bạn" }]);
  for (const context of [{ $ne: null }, [{ role: "system", content: "instructions" }], [{ role: "staff", content: "fake" }],
    Array.from({ length: 13 }, () => ({ role: "user", content: "Hi" })), Array.from({ length: 10 }, () => ({ role: "user", content: "x".repeat(2000) }))])
    assert.throws(() => normalizeContext(context), { statusCode: 400 });
});

test("retries reuse one message; transactions maintain ordering, reopen resolved threads and use server identity", async (t) => {
  let current = conversation({ status: "resolved", unreadCustomer: 2 });
  const messages = [];
  const session = { withTransaction: async (callback) => callback(), endSession: async () => {} };
  t.mock.method(mongoose, "startSession", async () => session);
  t.mock.method(Conversation, "findOne", (filter) => {
    assert.equal(filter._id, id);
    return query(() => ({ ...current }));
  });
  t.mock.method(Message, "findOne", (filter) => query(() => messages.find((message) => message.senderId === filter.senderId && message.clientMessageId === filter.clientMessageId)));
  const update = t.mock.method(Conversation, "findOneAndUpdate", (_filter, changes, options) => {
    assert.equal(options.session, session);
    for (const [key, increment] of Object.entries(changes.$inc)) current[key] += increment;
    current = { ...current, ...changes.$set };
    return query({ ...current });
  });
  const create = t.mock.method(Message, "create", async ([message], options) => {
    assert.equal(options.session, session);
    const saved = { ...message, _id: `message-${messages.length + 1}`, createdAt: new Date() };
    messages.push(saved);
    return [saved];
  });
  const first = await sendSupportMessage(id, customer, { ...draft, role: "staff", senderId: "forged" });
  assert.equal(first.message.role, "customer");
  assert.equal(first.message.authorName, customer.username);
  assert.equal(first.message.senderId, undefined);
  assert.equal(first.conversation.status, "waiting");
  assert.equal(first.conversation.unreadStaff, 1);
  assert.equal(first.conversation.unreadCustomer, 0);
  const retry = await sendSupportMessage(id, customer, draft);
  assert.equal(retry.message._id, first.message._id);
  assert.equal(create.mock.callCount(), 1);
  assert.equal(update.mock.callCount(), 1);
  await assert.rejects(sendSupportMessage(id, customer, { ...draft, content: "Changed" }), { statusCode: 409 });
  const reply = await sendSupportMessage(id, staff, { content: "Em chào anh/chị", clientMessageId: "00000000-0000-4000-8000-000000000002" });
  assert.equal(reply.message.role, "staff");
  assert.equal(reply.message.sequence, 2);
  assert.equal(reply.conversation.status, "active");
  assert.equal(reply.conversation.unreadStaff, 0);
  assert.equal(reply.conversation.unreadCustomer, 1);
});

test("failed message writes reject and always close their transaction session", async (t) => {
  let ended = false;
  t.mock.method(mongoose, "startSession", async () => ({
    withTransaction: async (callback) => callback(), endSession: async () => { ended = true; },
  }));
  t.mock.method(Conversation, "findOne", () => query(conversation()));
  t.mock.method(Message, "findOne", () => query(null));
  t.mock.method(Conversation, "findOneAndUpdate", () => query(conversation({ sequence: 1 })));
  t.mock.method(Message, "create", async () => { throw new Error("write failed"); });
  await assert.rejects(sendSupportMessage(id, customer, draft), /write failed/);
  assert.equal(ended, true);
});

test("read acknowledgements cannot clear messages newer than the client's snapshot", async (t) => {
  t.mock.method(Conversation, "findOne", () => query(conversation({ sequence: 8, unreadCustomer: 3 })));
  const write = t.mock.method(Conversation, "updateOne", async (filter, update) => {
    assert.deepEqual(filter, { _id: id, sequence: { $lte: 5 }, unreadCustomer: { $gt: 0 } });
    assert.deepEqual(update, { $set: { unreadCustomer: 0 } });
    return { modifiedCount: 0 };
  });
  const res = response();
  await markSupportRead({ params: { id }, user: customer, body: { sequence: 5 } }, res, next);
  assert.equal(res.body.success, true);
  const future = response();
  await markSupportRead({ params: { id }, user: customer, body: { sequence: 9 } }, future, next);
  assert.equal(future.statusCode, 400);
  assert.equal(write.mock.callCount(), 1);
});

test("snapshots paginate the newest 50 messages chronologically and omit sender IDs", async (t) => {
  t.mock.method(Conversation, "findOne", () => query(conversation({ sequence: 70 })));
  t.mock.method(Message, "find", (filter) => {
    assert.deepEqual(filter.sequence, { $lte: 70 });
    return { sort: (sort) => {
      assert.deepEqual(sort, { sequence: -1 });
      return { limit: (limit) => { assert.equal(limit, 50); return query([{ _id: "last", sequence: 70, senderId: "private" }, { _id: "previous", sequence: 69 }]); } };
    } };
  });
  const snapshot = await supportSnapshot(id, customer);
  assert.deepEqual(snapshot.messages.map((item) => item.sequence), [69, 70]);
  assert.equal(snapshot.messages[1].senderId, undefined);
  assert.equal(snapshot.conversation.userId, undefined);
  assert.equal(conversationView(conversation({ context: [{ content: "private context" }] }), false).context, undefined);
});

test("starting support keys the conversation by the server account and persists only opted-in AI context", async (t) => {
  const current = conversation();
  t.mock.method(Conversation, "findOneAndUpdate", (filter, update, options) => {
    assert.deepEqual(filter, { userId: customer._id });
    assert.equal(options.upsert, true);
    assert.deepEqual(update.$set.context, [{ role: "user", content: "Câu hỏi" }]);
    assert.equal(update.$set.customerEmail, customer.email);
    return query(current);
  });
  t.mock.method(Conversation, "findOne", () => query(current));
  t.mock.method(Message, "find", () => ({ sort: () => ({ limit: () => query([]) }) }));
  const res = response();
  await startSupport({ user: customer, body: { userId: "someone_else", context: [{ role: "user", content: "Câu hỏi" }] } }, res, next);
  assert.equal(res.body.conversation._id, id);
  assert.equal(res.headers["Cache-Control"], "private, no-store");
});

test("inbox search treats regex characters literally and pages are bounded", async (t) => {
  t.mock.method(Conversation, "find", (filter) => {
    assert.equal(filter.status, "waiting");
    assert.equal(filter.$or[0].customerName.test("a.*"), true);
    assert.equal(filter.$or[0].customerName.test("anything"), false);
    return { select: () => ({ sort: () => ({ skip: (skip) => {
      assert.equal(skip, 30);
      return { limit: () => query([]) };
    } }) }) };
  });
  t.mock.method(Conversation, "countDocuments", async () => 0);
  const res = response();
  await getSupportInbox({ user: staff, query: { search: "a.*", page: "2", status: "waiting" } }, res, next);
  assert.equal(res.body.page, 2);
  assert.equal(res.body.total, 0);
});

test("support rate limits fail closed and reject excess messages", async (t) => {
  t.mock.method(Usage, "findOneAndUpdate", () => query({ count: 31 }));
  const res = response();
  await supportRateLimit({ user: customer }, res, () => assert.fail("Must reject"));
  assert.equal(res.statusCode, 429);
  assert.equal(res.headers["Retry-After"], "60");
  t.mock.method(Usage, "findOneAndUpdate", () => { throw new Error("Database unavailable"); });
  let received;
  await supportRateLimit({ user: customer }, response(), (error) => { received = error; });
  assert.match(received.message, /Database unavailable/);
});

const streamResponse = () => {
  const res = new EventEmitter();
  res.parts = [];
  res.set = (headers) => { res.headers = headers; };
  res.flushHeaders = () => {};
  res.write = (chunk) => { res.parts.push(chunk); res.emit("chunk", chunk); return true; };
  res.end = () => { res.writableEnded = true; res.emit("close"); };
  return res;
};
test("SSE delivers changed snapshots to the browser parser and stops reads when disconnected", async () => {
  const req = new EventEmitter();
  const res = streamResponse();
  const snapshots = [];
  const parse = createSupportEventParser((snapshot) => {
    snapshots.push(snapshot);
    if (snapshots.length === 2) res.end();
  });
  res.on("chunk", parse);
  let reads = 0;
  await streamSnapshots(req, res, async () => ({ sequence: ++reads }), { durationMs: 500, intervalMs: 2 });
  assert.deepEqual(snapshots, [{ sequence: 1 }, { sequence: 2 }]);
  assert.match(res.headers["Content-Type"], /text\/event-stream/);
  assert.match(res.headers["Cache-Control"], /no-store/);
  assert.equal(res.listenerCount("close"), 0);
  assert.equal(req.listenerCount("aborted"), 0);
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(reads, 2);
});

test("SSE sessions end on their deadline and do not expose internal database errors", async () => {
  const res = streamResponse();
  await streamSnapshots(new EventEmitter(), res, async () => null, { durationMs: 10, intervalMs: 2 });
  assert.equal(res.writableEnded, true);
  const failed = streamResponse();
  await streamSnapshots(new EventEmitter(), failed, async () => { throw new Error("mongodb credentials private"); }, { durationMs: 100 });
  assert.match(failed.parts.join(""), /event: error/);
  assert.equal(failed.parts.join("").includes("credentials"), false);
});
