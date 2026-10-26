import test from "node:test";
import assert from "node:assert/strict";
import { buildOrderConfirmationEmail } from "../../emails/orderConfirmation.js";

const sampleOrder = () => ({
  _id: "6aa03522b1cb60bcd7e92bd7",
  createdAt: "2026-09-08T18:00:00.000Z",
  paymentMethod: "COD", isPaid: false, amount: 330000,
  items: [{
    title: "Purchased lotion", image: "https://example.com/ordered.png",
    size: "200ml", quantity: 2, unitPrice: 150000,
    product: { title: "Renamed lotion", images: ["https://example.com/new.png"], price: { "200ml": 999000 } },
  }],
  address: {
    firstName: "Khách", lastName: "Mẫu", street: "123 Đường Mẫu",
    city: "Phường Mẫu", state: "TP. Hồ Chí Minh", country: "Việt Nam", phone: "0900 000 000",
  },
});

test("receipt uses purchase snapshots, quantities and stored totals in VND", () => {
  const { html, text } = buildOrderConfirmationEmail(sampleOrder());
  assert.match(html, /Purchased lotion/);
  assert.match(html, /https:\/\/example.com\/ordered.png/);
  assert.doesNotMatch(html, /Renamed lotion|new.png|999\.000/);
  for (const amount of ["150.000", "300.000", "30.000", "330.000"]) {
    assert.ok(html.includes(amount));
    assert.ok(text.includes(amount));
  }
  assert.match(text, /200ml.*× 2/);
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
  assert.match(html, /Renamed lotion/);
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
    assert.match(receipt, /Theo giá đơn vị giao hàng bên thứ ba, thanh toán sau/);
    assert.match(receipt, /Tổng thanh toán chưa gồm phí giao Hỏa tốc/);
    assert.doesNotMatch(receipt, /Miễn phí|không cần thanh toán lại khi nhận hàng/i);
  }
});
