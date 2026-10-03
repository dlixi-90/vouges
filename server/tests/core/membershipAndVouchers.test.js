import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { vietnamDate, validateBirthday, birthdayWindow } from "../../utils/membership.js";
import { mapClerkProfile } from "../../utils/clerkProfile.js";
import User from "../../models/User.js";
import Product from "../../models/Product.js";
import Order from "../../models/Order.js";
import Address from "../../models/Address.js";
import Voucher from "../../models/Voucher.js";
import VoucherUse from "../../models/VoucherUse.js";
import { calculateDiscount, validateVoucher, issueBirthdayVoucher, reserveVoucher, releaseVoucher } from "../../services/voucherService.js";
import { saveBirthday } from "../../controllers/userController.js";
import { awardBirthdays, createVoucher } from "../../controllers/voucherController.js";
import { quoteOrder, placeOrderCOD, placeOrderQr, cancelQrOrder, sepayWebhook } from "../../controllers/orderController.js";
import { buildOrderConfirmationEmail } from "../../emails/orderConfirmation.js";
import transporter from "../../config/nodemailer.js";
import { Webhook } from "svix";
import clerkWebhooks from "../../controllers/ClerkWebhooks.js";

const productId = "507f1f77bcf86cd799439011";
const orderId = "507f1f77bcf86cd799439012";
const addressId = "507f1f77bcf86cd799439013";
const voucherId = "507f1f77bcf86cd799439014";
const userId = "user_customer";
const now = new Date("2026-10-03T00:00:00+07:00");
const coupon = (overrides = {}) => ({ _id: voucherId, code: "SAVE10", type: "percent", value: 10,
  minSubtotal: 300, maxDiscount: 100, startsAt: new Date("2020-01-01"), expiresAt: new Date("2099-01-01"),
  maxUses: 10, usedCount: 0, userId: null, ...overrides });
const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; } });
const query = (value) => ({ session: async () => value });
const setEnv = (t, key, value) => {
  const previous = process.env[key]; process.env[key] = value;
  t.after(() => { if (previous === undefined) delete process.env[key]; else process.env[key] = previous; });
};

test("phone-only Clerk profiles survive missing names/emails and never copy roles or birthday metadata", async () => {
  const data = { phone_numbers: [{ id: "phone", phone_number: "+84912345678", verification: { status: "verified" } }],
    primary_phone_number_id: "phone", unsafe_metadata: { role: "owner", birthday: "2000-10-03" } };
  const mapped = mapClerkProfile(data);
  assert.equal(mapped.phone, "+84912345678"); assert.equal(mapped.email, "");
  assert.ok(mapped.username); assert.equal(mapped.role, undefined); assert.equal(mapped.birthday, undefined);
  await new User({ _id: userId, ...mapped }).validate();
  data.phone_numbers[0].verification.status = "unverified";
  assert.equal(mapClerkProfile(data).phone, "");
});

test("Clerk sync uses only the verified primary email for role matching", () => {
  assert.equal(mapClerkProfile({ primary_email_address_id: "b", email_addresses: [
    { id: "a", email_address: "admin@example.com", verification: { status: "verified" } },
    { id: "b", email_address: "customer@example.com", verification: { status: "verified" } },
  ] }).email, "customer@example.com");
});

test("verified Clerk events upsert phone-only profiles safely on replay; invalid signatures cannot write", async (t) => {
  const secret = `whsec_${Buffer.from("test-webhook-key-for-velours-only").toString("base64")}`;
  setEnv(t, "CLERK_WEBHOOK_SECRET", secret);
  const write = t.mock.method(User, "findByIdAndUpdate", async (id, update, options) => {
    assert.equal(id, userId); assert.equal(update.$set.email, ""); assert.ok(update.$set.username);
    assert.equal(update.$set.birthday, undefined); assert.equal(options.upsert, true);
  });
  const payload = JSON.stringify({ type: "user.created", data: { id: userId, email_addresses: [], phone_numbers: [] } });
  const timestamp = new Date(); const eventId = "msg_test";
  const headers = { "svix-id": eventId, "svix-timestamp": String(Math.floor(timestamp.getTime() / 1000)),
    "svix-signature": new Webhook(secret).sign(eventId, timestamp, payload) };
  for (let count = 0; count < 2; count += 1) {
    const res = response(); await clerkWebhooks({ body: Buffer.from(payload), headers }, res); assert.equal(res.body.success, true);
  }
  const res = response(); await clerkWebhooks({ body: Buffer.from(payload), headers: { ...headers, "svix-signature": "invalid" } }, res);
  assert.equal(res.statusCode, 400); assert.equal(write.mock.callCount(), 2);
});

test("birthday dates reject rollovers and future dates and use Vietnam midnight", () => {
  assert.equal(vietnamDate(new Date("2026-10-02T17:00:00Z")), "2026-10-03");
  for (const value of ["2025-02-29", "2026-04-31", "2026-10-04", "03/10/2000", "", null])
    assert.equal(validateBirthday(value, now), false);
  assert.equal(validateBirthday("2000-02-29", now), true);
});

test("birthday award windows cover exactly seven local days and recover across a year boundary", () => {
  assert.equal(birthdayWindow("2000-10-03", new Date("2026-10-02T16:59:59Z")), null);
  const window = birthdayWindow("2000-10-03", now);
  assert.equal(window.startsAt.toISOString(), "2026-10-02T17:00:00.000Z");
  assert.equal(window.expiresAt.toISOString(), "2026-10-09T17:00:00.000Z");
  assert.equal(birthdayWindow("2000-10-03", window.expiresAt), null);
  assert.equal(birthdayWindow("2000-12-31", new Date("2027-01-02T00:00:00+07:00")).year, 2026);
  assert.equal(birthdayWindow("2000-02-29", new Date("2027-02-28T00:00:00+07:00")).startsAt.toISOString(), "2027-02-27T17:00:00.000Z");
  assert.equal(birthdayWindow("2000-02-29", new Date("2028-02-28T00:00:00+07:00")), null);
});

test("birthday issuance keys the same member/year and cannot refresh an existing voucher's expiry", async (t) => {
  let saved;
  t.mock.method(Voucher, "findOneAndUpdate", async (filter, update, options) => {
    assert.deepEqual(filter, { userId, kind: "birthday", birthdayYear: 2026 });
    assert.equal(options.upsert, true); assert.deepEqual(Object.keys(update), ["$setOnInsert"]);
    saved ||= update.$setOnInsert; return saved;
  });
  const first = await issueBirthdayVoucher({ _id: userId, birthday: "2000-10-03" }, now);
  const second = await issueBirthdayVoucher({ _id: userId, birthday: "2000-10-03" }, new Date(now.getTime() + 86400000));
  assert.equal(first.code, second.code); assert.equal(first.maxUses, 1); assert.equal(first.maxDiscount, 100);
  const index = Voucher.schema.indexes().find(([keys]) => keys.birthdayYear);
  assert.equal(index[1].unique, true);
});

test("birthday change cannot overwrite a saved date or accept a role from the body", async (t) => {
  t.mock.method(User, "findOneAndUpdate", async (filter, update) => {
    assert.equal(filter._id, userId); assert.ok(filter.$or);
    assert.deepEqual(update, { birthday: "2000-01-01", birthdayMonthDay: "01-01" }); return null;
  });
  const res = response();
  await saveBirthday({ user: { _id: userId }, body: { birthday: "2000-01-01", role: "owner" } }, res, (err) => { throw err; });
  assert.equal(res.statusCode, 409);
});

test("discounts cap percentage/fixed awards at subtotal and round to a single VND", () => {
  assert.equal(calculateDiscount(coupon(), 2000), 100);
  assert.equal(calculateDiscount(coupon({ type: "fixed", value: 1000, maxDiscount: null }), 300), 300);
  assert.equal(calculateDiscount(coupon({ value: 7.5 }), 333.333), 25);
});

test("voucher validation rejects another member, expired/start dates, minimums, caps and repeat use", async (t) => {
  let saved = coupon(); let used = null;
  t.mock.method(Voucher, "findOne", async () => saved);
  t.mock.method(VoucherUse, "exists", async () => used);
  for (const overrides of [ { userId: "someone_else" }, { expiresAt: now }, { startsAt: new Date("2090-01-01") },
    { minSubtotal: 501 }, { usedCount: 10 } ]) {
    saved = coupon(overrides); await assert.rejects(validateVoucher("save10", userId, 500, null, now));
  }
  saved = coupon(); used = { _id: "used" };
  await assert.rejects(validateVoucher("save10", userId, 500, null, now), /đã sử dụng/);
  used = null; assert.equal((await validateVoucher("save10", userId, 500, null, now)).code, "SAVE10");
  await assert.rejects(validateVoucher({ $ne: null }, userId, 500, null, now), /không hợp lệ/);
});

test("lost concurrent voucher allocation is rejected before recording a use; session is shared", async (t) => {
  const session = {};
  t.mock.method(Voucher, "updateOne", async (filter, _update, options) => {
    assert.equal(options.session, session); assert.deepEqual(filter.usedCount, { $lt: 10 }); return { modifiedCount: 0 };
  });
  const write = t.mock.method(VoucherUse, "create", async () => assert.fail("Must not allocate"));
  await assert.rejects(reserveVoucher(coupon(), userId, orderId, session), /hết lượt/);
  assert.equal(write.mock.callCount(), 0);
});

test("voucher release is idempotent and only decrements its own order use", async (t) => {
  let released = false;
  t.mock.method(VoucherUse, "findOneAndDelete", async (filter) => {
    assert.deepEqual(filter, { orderId }); if (released) return null; released = true; return { voucherId };
  });
  const change = t.mock.method(Voucher, "updateOne", async () => ({ modifiedCount: 1 }));
  await releaseVoucher({ _id: orderId, voucherId }, {}); await releaseVoucher({ _id: orderId, voucherId }, {});
  assert.equal(change.mock.callCount(), 1);
});

const mockCatalog = (t, price = 500) => {
  const product = { _id: productId, title: "Lotion", sizes: ["M"], inStock: true,
    price: { M: price }, stockBySize: { M: 20 }, markModified() {}, save: async () => {} };
  t.mock.method(Product, "find", () => { const result = Promise.resolve([product]); result.session = async () => [product]; return result; });
  t.mock.method(Voucher, "findOne", () => { const result = Promise.resolve(coupon()); result.session = async () => coupon(); return result; });
  t.mock.method(VoucherUse, "exists", () => { const result = Promise.resolve(null); result.session = async () => null; return result; });
};

test("checkout quote ignores client prices/discounts and computes express shipping from the database", async (t) => {
  mockCatalog(t);
  const res = response();
  await quoteOrder({ user: { _id: userId }, body: { items: [{ product: productId, size: "M", quantity: 1, price: 1 }],
    voucherCode: "SAVE10", shippingMethod: "express", discount: 500, amount: 1, userId: "someone_else" } }, res);
  assert.equal(res.body.pricing.subtotal, 500); assert.equal(res.body.pricing.discount, 50);
  assert.equal(res.body.pricing.shipping, 50); assert.equal(res.body.pricing.amount, 500);
  assert.equal(res.body.pricing.voucher, undefined);
});

for (const handler of [placeOrderCOD, placeOrderQr]) test(`${handler.name} rejects a stale quote before reserving stock or vouchers`, async (t) => {
  mockCatalog(t);
  t.mock.method(Order, "exists", async () => null);
  t.mock.method(Order, "findOne", () => ({ sort: async () => null }));
  t.mock.method(Address, "findOne", () => query({ _id: addressId, phone: "0912345678" }));
  t.mock.method(mongoose, "startSession", async () => ({ withTransaction: async (callback) => callback({}), endSession: async () => {} }));
  const write = t.mock.method(Order, "create", async () => assert.fail("Should not place order"));
  const res = response();
  await handler({ auth: () => ({ userId }), body: { items: [{ product: productId, size: "M", quantity: 1 }],
    address: addressId, expectedAmount: 10 } }, res);
  assert.equal(res.statusCode, 409); assert.equal(write.mock.callCount(), 0);
});

for (const handler of [placeOrderCOD, placeOrderQr]) test(`${handler.name} saves authoritative voucher/shipping totals and reserves the use in the stock transaction`, async (t) => {
  mockCatalog(t);
  const session = { withTransaction: async (callback) => callback(), endSession: async () => {} };
  t.mock.method(mongoose, "startSession", async () => session);
  t.mock.method(Order, "exists", async () => null);
  t.mock.method(Order, "findOne", () => ({ sort: async () => null }));
  t.mock.method(Address, "findOne", () => query({ _id: addressId, phone: "0912345678" }));
  let created;
  t.mock.method(Order, "create", async ([values], options) => {
    assert.equal(options.session, session); created = { _id: orderId, ...values };
    return [{ ...created, toObject: () => created }];
  });
  t.mock.method(Order, "findById", () => ({ populate: async () => created }));
  const user = { email: "", cartData: { [productId]: { M: 1 } }, cartAddedAt: {}, markModified() {}, save: async () => {} };
  t.mock.method(User, "findById", () => { const result = Promise.resolve(user); result.session = async () => user; return result; });
  const increment = t.mock.method(Voucher, "updateOne", async (_filter, _update, options) => {
    assert.equal(options.session, session); return { modifiedCount: 1 };
  });
  const ledger = t.mock.method(VoucherUse, "create", async ([entry], options) => {
    assert.equal(options.session, session); assert.deepEqual(entry, { voucherId, userId, orderId });
  });
  const mail = t.mock.method(transporter, "sendMail", async () => assert.fail("Phone-only account has no email"));
  const res = response();
  await handler({ auth: () => ({ userId }), body: { items: [{ product: productId, size: "M", quantity: 1 }],
    address: addressId, expectedAmount: 500, shippingMethod: "express", voucherCode: "SAVE10", discount: 99999 } }, res);
  assert.equal(res.statusCode, 201); assert.equal(created.amount, 500); assert.equal(created.subtotal, 500);
  assert.equal(created.discount, 50); assert.equal(created.shipping, 50); assert.equal(created.shippingMethod, "express");
  assert.equal(created.voucherCode, "SAVE10"); assert.equal(increment.mock.callCount(), 1); assert.equal(ledger.mock.callCount(), 1);
  assert.equal(mail.mock.callCount(), 0);
  if (handler === placeOrderQr) assert.equal(created.qrAmount, 500000);
});

test("zero-value QR orders do not reserve stock or issue an unpayable QR", async (t) => {
  mockCatalog(t);
  t.mock.method(Voucher, "findOne", () => query(coupon({ value: 100, maxDiscount: null })));
  t.mock.method(Order, "exists", async () => null);
  t.mock.method(Order, "findOne", () => ({ sort: async () => null }));
  t.mock.method(Address, "findOne", () => query({ _id: addressId, phone: "0912345678" }));
  t.mock.method(mongoose, "startSession", async () => ({ withTransaction: async (callback) => callback(), endSession: async () => {} }));
  const write = t.mock.method(Order, "create", async () => assert.fail("No zero QR"));
  const res = response(); await placeOrderQr({ auth: () => ({ userId }), body: { items: [{ product: productId, size: "M", quantity: 1 }],
    address: addressId, voucherCode: "SAVE10", shippingMethod: "standard", expectedAmount: 0 } }, res);
  assert.equal(res.statusCode, 400); assert.match(res.body.message, /COD/); assert.equal(write.mock.callCount(), 0);
});

test("QR cancellation restores the voucher along with stock once", async (t) => {
  const order = { _id: orderId, voucherId, items: [], paymentMethod: "QR", isPaid: false, status: "Awaiting Payment", save: async () => {} };
  t.mock.method(Order, "findOne", () => query(order));
  t.mock.method(Product, "find", () => query([]));
  t.mock.method(mongoose, "startSession", async () => ({ withTransaction: async (callback) => callback({}), endSession: async () => {} }));
  const release = t.mock.method(VoucherUse, "findOneAndDelete", async () => ({ voucherId }));
  const decrement = t.mock.method(Voucher, "updateOne", async () => ({ modifiedCount: 1 }));
  const req = { auth: () => ({ userId }), params: { orderId } };
  await cancelQrOrder(req, response()); await cancelQrOrder(req, response());
  assert.equal(order.status, "Payment Cancelled"); assert.equal(release.mock.callCount(), 1); assert.equal(decrement.mock.callCount(), 1);
});

test("late payment with a released voucher is recorded for owner review without spending it twice", async (t) => {
  setEnv(t, "SEPAY_WEBHOOK_API_KEY", "test-key");
  const order = { voucherId, qrAmount: 450000, status: "Payment Expired", isPaid: false, save: async () => {} };
  t.mock.method(Order, "findOne", (filter) => filter.transactionId ? Promise.resolve(null) : query(order));
  t.mock.method(mongoose, "startSession", async () => ({ withTransaction: async (callback) => callback({}), endSession: async () => {} }));
  const reserve = t.mock.method(Voucher, "updateOne", async () => assert.fail("Do not reserve again"));
  const res = response();
  await sepayWebhook({ get: () => "Apikey test-key", body: { id: "txn", transferType: "in", transferAmount: 450000, content: "DHAABBCCDD" } }, res);
  assert.equal(res.body.success, true); assert.equal(order.status, "Payment Review"); assert.equal(order.isPaid, true);
  assert.equal(reserve.mock.callCount(), 0);
});

test("birthday cron requires its own configured secret before accessing users", async (t) => {
  setEnv(t, "CRON_SECRET", "birthday-secret");
  const find = t.mock.method(User, "find", () => assert.fail("No unauthorized reads"));
  const res = response(); await awardBirthdays({ get: () => "Bearer wrong" }, res);
  assert.equal(res.statusCode, 401); assert.equal(find.mock.callCount(), 0);
});

test("admin voucher API rejects non-finite values and reserved birthday codes", async (t) => {
  const write = t.mock.method(Voucher, "create", async () => assert.fail("No write"));
  for (const patch of [{ value: Infinity }, { code: "BDAY-FAKE" }, { value: 101 }, { maxUses: 1.2 }, { minSubtotal: -1 }]) {
    const res = response(); await createVoucher({ body: { code: "SAVE10", type: "percent", value: 10, maxUses: 1,
      startsAt: "2020-01-01", expiresAt: "2099-01-01", ...patch } }, res, (err) => { throw err; });
    assert.equal(res.statusCode, 400);
  }
  assert.equal(write.mock.callCount(), 0);
});

test("receipt displays voucher separately from saved delivery fees", () => {
  const order = { _id: orderId, createdAt: now, amount: 500, shipping: 50, discount: 50, voucherCode: "SAVE10", shippingMethod: "express",
    items: [{ title: "Lotion", quantity: 1, unitPrice: 500, size: "M" }], address: {}, paymentMethod: "COD" };
  const { html, text } = buildOrderConfirmationEmail(order);
  assert.match(text, /Voucher SAVE10: -50\.000/); assert.match(text, /Phí vận chuyển: 50\.000/);
  assert.match(html, /giao nhanh/);
});
