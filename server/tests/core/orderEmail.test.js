import test from "node:test";
import assert from "node:assert/strict";
import { buildOrderConfirmationEmail } from "../../emails/orderConfirmation.js";
import { sendOrderConfirmation } from "../../services/orderEmail.js";
import { placeOrderCOD, placeOrderQr, sepayWebhook } from "../../controllers/orderController.js";
import Order from "../../models/Order.js";
import Product from "../../models/Product.js";
import Address from "../../models/Address.js";
import User from "../../models/User.js";
import transporter from "../../config/nodemailer.js";
import mongoose from "mongoose";
import nodemailer from "nodemailer";

const sampleOrder = () => ({
  _id: "6aa03522b1cb60bcd7e92bd7",
  createdAt: "2026-09-08T18:00:00.000Z",
  paymentMethod: "COD", isPaid: false, amount: 330000,
  items: [{
    title: "Purchased perfume", image: "https://example.com/ordered.png",
    size: "10ml", quantity: 2, unitPrice: 150000,
    product: { title: "Renamed perfume", images: ["https://example.com/new.png"], price: { "10ml": 999000 } },
  }],
  address: {
    firstName: "Khách", lastName: "Mẫu", street: "123 Đường Mẫu",
    city: "Phường Mẫu", state: "TP. Hồ Chí Minh", country: "Việt Nam", phone: "0900 000 000",
  },
});

test("the actual logo is packaged as an inline PNG in the email without contacting SMTP", async () => {
  const email = buildOrderConfirmationEmail(sampleOrder());
  const previewTransport = nodemailer.createTransport({ streamTransport: true, buffer: true, newline: "unix" });
  const result = await previewTransport.sendMail({ from: "store@example.com", to: "customer@example.com", ...email });
  const message = result.message.toString("utf8");
  assert.match(message, /Content-Type: image\/png/);
  assert.match(message, /Content-ID: <velours-mark@velours>/);
  assert.match(message, /Content-Disposition: inline/);
  assert.match(message, /iVBORw0KGgo/);
});

test("receipt uses purchase snapshots, quantities and stored totals in VND", () => {
  const { html, text } = buildOrderConfirmationEmail(sampleOrder());
  assert.match(html, /Purchased perfume/);
  assert.match(html, /https:\/\/example.com\/ordered.png/);
  assert.doesNotMatch(html, /Renamed perfume|new.png|999\.000/);
  for (const amount of ["150.000", "300.000", "30.000", "330.000"]) {
    assert.ok(html.includes(amount));
    assert.ok(text.includes(amount));
  }
  assert.match(text, /10ml.*× 2/);
  assert.match(text, /0900 000 000/);
  assert.match(text, /9 tháng 9, 2026/);
});

test("COD email clearly requests payment on delivery instead of claiming payment", () => {
  const { html, text } = buildOrderConfirmationEmail(sampleOrder());
  assert.match(html, /Chưa thanh toán/);
  assert.match(text, /Vui lòng thanh toán 330\.000.*khi nhận hàng/);
  assert.doesNotMatch(html, /Đã thanh toán/);
});

test("free shipping uses the saved total even if shipping rules later change", () => {
  const order = sampleOrder();
  order.amount = 300000;
  const { html, text } = buildOrderConfirmationEmail(order);
  assert.match(html, /Miễn phí/);
  assert.match(text, /Phí vận chuyển: Miễn phí/);
});

test("customer and product content is escaped before it enters HTML", () => {
  const order = sampleOrder();
  order.items[0].title = '<img src=x onerror="bad()"> & Lotion';
  order.address.street = '<script>alert("x")</script>';
  order.address.firstName = '<a href="bad">Name</a>';
  const { html } = buildOrderConfirmationEmail(order);
  assert.doesNotMatch(html, /<script>|<img src=x|<a href="bad">/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /&amp; Lotion/);
});

test("unsafe image and storefront URLs do not become clickable email content", () => {
  const order = sampleOrder();
  order.items[0].image = 'javascript:alert("bad")';
  const { html, text } = buildOrderConfirmationEmail(order, { storefrontUrl: "javascript:alert(1)" });
  assert.doesNotMatch(html, /javascript:/);
  assert.match(text, /https:\/\/velours-jet.vercel.app\/my-orders/);
});

test("older orders can use populated products when snapshots are missing", () => {
  const order = sampleOrder();
  delete order.items[0].title;
  delete order.items[0].image;
  delete order.items[0].unitPrice;
  order.amount = 1998000;
  const { html, text } = buildOrderConfirmationEmail(order, { storefrontUrl: "https://shop.example.com" });
  assert.match(html, /Renamed perfume/);
  assert.match(text, /1\.998\.000/);
  assert.match(text, /https:\/\/shop.example.com\/my-orders/);
});

test("paid receipt does not ask the customer to pay again", () => {
  const order = { ...sampleOrder(), paymentMethod: "QR", isPaid: true };
  const { text } = buildOrderConfirmationEmail(order);
  assert.match(text, /Đã thanh toán/);
  assert.match(text, /không cần thanh toán lại/);
  assert.doesNotMatch(text, /Vui lòng thanh toán/);
});

for (const isPaid of [false, true]) test(`urgent receipt explains the separately payable carrier fee when paid=${isPaid}`, () => {
  const order = { ...sampleOrder(), shippingMethod: "urgent", shipping: 0, amount: 300000,
    paymentMethod: isPaid ? "QR" : "COD", isPaid };
  const { html, text } = buildOrderConfirmationEmail(order);
  for (const receipt of [html, text]) {
    assert.match(receipt, /Hỏa tốc/);
    assert.match(receipt, /Theo giá đơn vị vận chuyển bên thứ ba, thanh toán sau/);
    assert.match(receipt, /Tổng thanh toán chưa gồm phí giao Hỏa tốc/);
    assert.doesNotMatch(receipt, /Miễn phí|không cần thanh toán lại khi nhận hàng/i);
  }
});

test("pending QR email gives the saved amount, code, expiration and a working order link without claiming payment", () => {
  const order = { ...sampleOrder(), paymentMethod: "QR", status: "Awaiting Payment",
    paymentCode: "DH1234ABCD", paymentExpiresAt: "2026-10-28T06:50:00.000Z" };
  const { subject, html, text } = buildOrderConfirmationEmail(order);
  assert.match(subject, /chờ thanh toán QR/);
  for (const content of [html, text]) {
    assert.match(content, /330\.000/);
    assert.match(content, /DH1234ABCD/);
    assert.match(content, /13:50/);
    assert.match(content, /28\/10\/2026/);
    assert.match(content, /Tiếp tục thanh toán/);
    assert.match(content, /không chuyển tiền theo mã cũ/);
    assert.match(content, /order-overview\/6aa03522b1cb60bcd7e92bd7/);
    assert.doesNotMatch(content, /ĐẶT HÀNG THÀNH CÔNG|Đã thanh toán|không cần thanh toán lại/);
  }
  assert.doesNotMatch(html, /#41334e|#557b5e|BEAUTY|SELF-CARE/);
});

test("late QR payment review email acknowledges money without promising fulfillment", () => {
  const order = { ...sampleOrder(), paymentMethod: "QR", isPaid: true, status: "Payment Review" };
  const { subject, html, text } = buildOrderConfirmationEmail(order);
  assert.match(subject, /Cần xác minh/);
  for (const content of [html, text]) {
    assert.match(content, /đang kiểm tra lại đơn hàng/i);
    assert.match(content, /Không chuyển khoản lại/);
    assert.doesNotMatch(content, /ĐẶT HÀNG THÀNH CÔNG|Thanh toán đã được xác nhận/);
  }
});

test("delivery uses the checkout contact email, including phone-only accounts, with account fallback", async (t) => {
  const mail = t.mock.method(transporter, "sendMail", async () => ({}));
  const account = t.mock.method(User, "findById", async () => ({ email: "account@example.com" }));
  const order = { ...sampleOrder(), userId: "customer" };
  order.address.email = " checkout@example.com ";
  assert.equal(await sendOrderConfirmation(order), true);
  assert.equal(mail.mock.calls[0].arguments[0].to, "checkout@example.com");
  assert.equal(account.mock.callCount(), 0);
  delete order.address.email;
  assert.equal(await sendOrderConfirmation(order), true);
  assert.equal(mail.mock.calls[1].arguments[0].to, "account@example.com");
  account.mock.mockImplementation(async () => null);
  assert.equal(await sendOrderConfirmation(order), false);
  assert.equal(mail.mock.callCount(), 2);
});

test("QR sends email only after confirmed payment, never for pending, expired, cancelled or review orders", async (t) => {
  const mail = t.mock.method(transporter, "sendMail", async () => ({}));
  const order = { ...sampleOrder(), paymentMethod: "QR", address: { email: "customer@example.com" } };
  for (const [status, isPaid] of [["Awaiting Payment", false], ["Payment Expired", false], ["Payment Cancelled", false], ["Payment Review", true]]) {
    assert.equal(await sendOrderConfirmation({ ...order, status, isPaid }), false);
  }
  assert.equal(mail.mock.callCount(), 0);
  assert.equal(await sendOrderConfirmation({ ...order, status: "Order Placed", isPaid: true }), true);
  assert.equal(mail.mock.callCount(), 1);
});

const query = value => ({ session: async () => value, sort: async () => value,
  then: (resolve, reject) => Promise.resolve(value).then(resolve, reject) });
const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; } });

for (const handler of [placeOrderCOD, placeOrderQr]) {
  for (const smtpFails of [false, true]) test(`${handler.name} emails after commit and succeeds even if SMTP fails=${smtpFails}`, async (t) => {
    const productId = "507f1f77bcf86cd799439012";
    const addressId = "507f1f77bcf86cd799439013";
    const orderId = sampleOrder()._id;
    let committed = false;
    const session = { withTransaction: async callback => { await callback(session); committed = true; }, endSession: async () => {} };
    t.mock.method(mongoose, "startSession", async () => session);
    t.mock.method(Order, "exists", async () => null);
    t.mock.method(Order, "findOne", () => query(null));
    const address = { ...sampleOrder().address, _id: addressId, email: "checkout@example.com", phone: "0912345678" };
    t.mock.method(Address, "findOne", () => query(address));
    const product = { _id: productId, title: "Perfume", sizes: ["10ml"], price: { "10ml": 150000 },
      inStock: true, inventoryMode: "tracked", stockBySize: { "10ml": 12 },
      inStockBySize: { "10ml": true }, images: [], markModified() {}, save: async () => {} };
    t.mock.method(Product, "find", () => query([product]));
    const user = { email: "", cartData: {}, markModified() {}, save: async () => {} };
    t.mock.method(User, "findById", () => query(user));
    let created;
    t.mock.method(Order, "create", async ([values]) => {
      created = { ...values, _id: orderId, createdAt: new Date() };
      return [{ ...created, toObject: () => created }];
    });
    t.mock.method(Order, "findById", () => ({ populate: async () => ({ ...created, address }) }));
    t.mock.method(console, "error", () => {});
    const mail = t.mock.method(transporter, "sendMail", async message => {
      assert.equal(committed, true);
      assert.equal(message.to, address.email);
      assert.match(message.subject, handler === placeOrderQr ? /chờ thanh toán QR/ : /Xác nhận đơn hàng/);
      if (smtpFails) throw new Error("Test SMTP unavailable");
    });
    const res = response();
    await handler({ auth: () => ({ userId: "customer" }), body: {
      address: addressId, items: [{ product: productId, size: "10ml", quantity: 1 }],
    } }, res);
    assert.equal(res.statusCode, 201);
    assert.equal(res.body.success, true);
    assert.equal(mail.mock.callCount(), handler === placeOrderQr ? 0 : 1);
    assert.equal(product.stockBySize["10ml"], 11);
  });
}

test("resuming an existing QR session sends no additional email", async (t) => {
  const order = { ...sampleOrder(), paymentMethod: "QR", status: "Awaiting Payment", createdAt: new Date(),
    paymentExpiresAt: new Date(Date.now() + 300000), paymentCode: "DH1234ABCD", qrAmount: 330000 };
  t.mock.method(Order, "exists", async () => null);
  t.mock.method(Order, "findOne", () => query({ ...order, toObject: () => order }));
  const mail = t.mock.method(transporter, "sendMail", async () => assert.fail("No repeated email"));
  const res = response();
  await placeOrderQr({ auth: () => ({ userId: "customer" }), body: {} }, res);
  assert.equal(res.body.success, true);
  assert.equal(mail.mock.callCount(), 0);
});

for (const status of ["Awaiting Payment", "Payment Expired"]) {
  test(`QR webhook emails after ${status} payment commits and skips repeated or insufficient transfers`, async (t) => {
    const previous = process.env.SEPAY_WEBHOOK_API_KEY;
    process.env.SEPAY_WEBHOOK_API_KEY = "email-test-key";
    t.after(() => { if (previous === undefined) delete process.env.SEPAY_WEBHOOK_API_KEY; else process.env.SEPAY_WEBHOOK_API_KEY = previous; });
    const order = { ...sampleOrder(), userId: "customer", paymentMethod: "QR", status,
      paymentCode: "DH1234ABCD", qrAmount: 330000, save: async () => {} };
    if (status === "Payment Expired") order.voucherId = "released-voucher";
    let committed = false;
    const session = { withTransaction: async callback => { await callback(session); committed = true; }, endSession: async () => {} };
    t.mock.method(mongoose, "startSession", async () => session);
    t.mock.method(Order, "findOne", filter => filter.transactionId
      ? Promise.resolve(order.transactionId === filter.transactionId ? order : null) : query(order));
    t.mock.method(Order, "findById", () => ({ populate: async () => ({ ...order,
      address: { ...order.address, email: "customer@example.com" } }) }));
    t.mock.method(User, "findById", () => query({ cartData: {}, markModified() {}, save: async () => {} }));
    const mail = t.mock.method(transporter, "sendMail", async message => {
      assert.equal(committed, true);
      assert.equal(order.isPaid, true);
      assert.match(message.subject, status === "Payment Expired" ? /Cần xác minh/ : /Xác nhận thanh toán/);
    });
    const req = { get: () => "Apikey email-test-key", body: { id: "txn-email", transferType: "in",
      transferAmount: 1, content: order.paymentCode } };
    await sepayWebhook(req, response());
    assert.equal(mail.mock.callCount(), 0);
    committed = false;
    req.body.transferAmount = order.qrAmount;
    const res = response();
    await sepayWebhook(req, res);
    assert.equal(res.body.success, true);
    assert.equal(mail.mock.callCount(), status === "Payment Expired" ? 0 : 1);
    await sepayWebhook(req, response());
    req.body.id = "txn-other";
    await sepayWebhook(req, response());
    assert.equal(mail.mock.callCount(), status === "Payment Expired" ? 0 : 1);
  });
}
