import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import Notification from "../../models/AdminNotification.js";
import Conversation from "../../models/SupportConversation.js";
import router from "../../routes/notificationRoute.js";
import authUser, { requireOwner } from "../../middleware/authMiddleware.js";
import { attachOrderNotifications, attachReviewNotifications, orderActivity, reviewActivity, recordActivity } from "../../services/adminNotificationEvents.js";
import { readAdminNotifications, markAllAdminNotificationsRead } from "../../services/adminNotifications.js";
import { markNotificationRead, markAllNotificationsRead } from "../../controllers/notificationController.js";
import { newestNotificationSnapshot, notificationBadge } from "../../../client/src/utils/adminNotifications.js";

const id = "507f1f77bcf86cd799439011";
const at = new Date("2026-11-12T10:00:00Z");
const response = () => ({ statusCode: 200, set() { return this; }, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });
const next = error => { if (error) throw error; };

test("every notification endpoint authenticates and requires an administrator", () => {
  assert.deepEqual(router.stack.filter(layer => !layer.route).map(layer => layer.handle), [authUser, requireOwner]);
  assert.deepEqual(router.stack.filter(layer => layer.route).map(layer => layer.route.path), ["/", "/events", "/read", "/read-all"]);
  const res = response();
  requireOwner({ user: { role: "user" } }, res, () => assert.fail("Customer cannot read staff notifications"));
  assert.equal(res.statusCode, 403);
});

test("badge caps at 9+ and stale SSE cannot resurrect acknowledged notifications", () => {
  assert.deepEqual([0, 1, 9, 10, 99].map(notificationBadge), ["0", "1", "9", "9+", "9+"]);
  const read = { asOf: "2026-11-12T10:02:00Z", unreadCount: 0 };
  assert.equal(newestNotificationSnapshot(read, { asOf: "2026-11-12T10:01:00Z", unreadCount: 9 }), read);
  const fresh = { asOf: "2026-11-12T10:03:00Z", unreadCount: 1 };
  assert.equal(newestNotificationSnapshot(read, fresh), fresh);
});

test("order creation, QR states and delivery create distinct idempotent events with working receipt links", async t => {
  const order = { _id: id, status: "Order Placed", items: [{ title: "Chanel N°5" }] };
  const created = orderActivity(order, true);
  assert.equal(created.type, "order_created");
  assert.match(created.title, /thành công/u);
  assert.equal(created.href, `/order-overview/${id}`);
  for (const status of ["Awaiting Payment", "Payment Cancelled", "Payment Expired", "Payment Review", "Packing", "Shipping", "Delivery"]) {
    const event = orderActivity({ ...order, status });
    assert.notEqual(event._id, created._id);
    assert.equal(event.type, "order_status");
  }
  const session = { transaction: true };
  const writes = [];
  t.mock.method(Notification, "updateOne", async (...args) => writes.push(args));
  await recordActivity(created, session); await recordActivity(created, session);
  assert.deepEqual(writes[0], writes[1]);
  assert.deepEqual(writes[0][0], { _id: created._id });
  assert.deepEqual(Object.keys(writes[0][1]), ["$setOnInsert"]);
  assert.equal(writes[0][2].session, session);
});

test("model middleware records successful saves/updates in the source transaction, skips unrelated writes and unmatched updates", async t => {
  const writes = [];
  t.mock.method(Notification, "updateOne", async (...args) => writes.push(args));
  const schema = new mongoose.Schema({});
  attachOrderNotifications(schema);
  const session = { transaction: true };
  const doc = { _id: id, status: "Order Placed", isNew: true, $locals: {}, isModified: () => true, $session: () => session };
  await schema.s.hooks.execPre("save", doc, []);
  await schema.s.hooks.execPost("save", doc, [doc]);
  assert.equal(writes.length, 1); assert.equal(writes[0][2].session, session);
  doc.isNew = false; doc.isModified = () => false;
  await schema.s.hooks.execPre("save", doc, []); await schema.s.hooks.execPost("save", doc, [doc]);
  assert.equal(writes.length, 1);
  const query = { getUpdate: () => ({ $set: { status: "Shipping" } }), getOptions: () => ({ session }) };
  await schema.s.hooks.execPost("findOneAndUpdate", query, [null]);
  assert.equal(writes.length, 1);
  await schema.s.hooks.execPost("findOneAndUpdate", query, [doc]);
  assert.match(writes[1][1].$setOnInsert.body, /Đang giao hàng/u);
  assert.equal(writes[1][2].session, session);
  const reviewSchema = new mongoose.Schema({}); attachReviewNotifications(reviewSchema);
  const review = { _id: id, productId: id, rating: 5, comment: "Tốt", authorName: "Khách", updatedAt: at };
  await reviewSchema.s.hooks.execPost("findOneAndUpdate", { getUpdate: () => ({ $set: { rating: 5 } }), getOptions: () => ({}) }, [review]);
  assert.equal(writes[2][1].$setOnInsert.type, "review");
  assert.notEqual(reviewActivity(review)._id, reviewActivity({ ...review, updatedAt: new Date(at.getTime() + 1) })._id);
});

test("feed counts messages, not conversations, combines activities and only exposes notification fields", async t => {
  t.mock.method(Notification, "aggregate", async pipeline => {
    assert.deepEqual(pipeline[0].$match, { readBy: { $ne: "staff-a" } });
    assert.equal(pipeline[1].$facet.items[1].$limit, 30);
    return [{ total: [{ count: 3 }], items: [{ _id: "event", type: "order_created", title: "Đơn mới", body: "Đơn #1", href: `/order-overview/${id}`, createdAt: at, readBy: ["staff-b"] }] }];
  });
  t.mock.method(Conversation, "aggregate", async pipeline => {
    assert.deepEqual(pipeline[0].$match, { unreadStaff: { $gt: 0 } });
    assert.deepEqual(pipeline[1].$facet.total[0].$group.count, { $sum: "$unreadStaff" });
    return [{ total: [{ count: 12 }], items: [{ _id: id, customerName: "Khách", unreadStaff: 12, lastMessage: "Xin chào", lastMessageAt: new Date(at.getTime() + 10), userId: "private" }] }];
  });
  const result = await readAdminNotifications("staff-a");
  assert.equal(result.unreadMessages, 12); assert.equal(result.unreadCount, 15);
  assert.equal(result.items[0].count, 12);
  assert.equal(result.items[0].href, `/owner/messages?conversation=${id}`);
  assert.ok(result.items.every(item => !Object.hasOwn(item, "readBy") && !Object.hasOwn(item, "userId")));
});

test("mark all uses a snapshot cutoff and sequence condition so concurrently arriving messages stay unread", async t => {
  t.mock.method(Conversation, "find", filter => {
    assert.equal(filter.lastMessageAt.$lte, at);
    return { select: () => ({ lean: async () => [{ _id: id, sequence: 8 }] }) };
  });
  t.mock.method(Conversation, "bulkWrite", async operations => {
    assert.deepEqual(operations[0].updateOne.filter, { _id: id, sequence: 8, lastMessageAt: { $lte: at } });
    assert.deepEqual(operations[0].updateOne.update, { $set: { unreadStaff: 0 } });
  });
  t.mock.method(Notification, "updateMany", async (filter, update) => {
    assert.deepEqual(filter, { createdAt: { $lte: at }, readBy: { $ne: "staff-a" } });
    assert.deepEqual(update, { $addToSet: { readBy: "staff-a" } });
  });
  await markAllAdminNotificationsRead("staff-a", at);
});

test("malformed IDs and future read cutoffs cannot write to notification or support collections", async t => {
  t.mock.method(Notification, "updateOne", () => assert.fail("No malformed notification writes"));
  t.mock.method(Notification, "updateMany", () => assert.fail("No future cutoff writes"));
  t.mock.method(Conversation, "find", () => assert.fail("No malformed conversation reads"));
  for (const value of [{ $ne: null }, "support:fake", "x".repeat(201), undefined]) {
    const res = response(); await markNotificationRead({ body: { id: value }, user: { _id: "staff" } }, res, next); assert.equal(res.statusCode, 400);
  }
  for (const before of [undefined, { $ne: null }, "invalid", new Date(Date.now() + 60000).toISOString()]) {
    const res = response(); await markAllNotificationsRead({ body: { before }, user: { _id: "staff" } }, res, next); assert.equal(res.statusCode, 400);
  }
});
