import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import Address from "../../models/Address.js";
import User from "../../models/User.js";
import Order from "../../models/Order.js";
import { addAddress, getAddress, setDefaultAddress } from "../../controllers/addressController.js";
import { placeOrderCOD, placeOrderQr } from "../../controllers/orderController.js";
import addressRouter from "../../routes/addressRoute.js";
import authUser from "../../middleware/authMiddleware.js";
import { validateDeliveryPhone } from "../../utils/deliveryPhone.js";
import { validateDeliveryPhone as validateClientPhone } from "../../../client/src/utils/deliveryPhone.js";
import { initialCheckoutAddress, resolveCheckoutAddress } from "../../../client/src/utils/checkoutAddress.js";

const firstId = "507f1f77bcf86cd799439011";
const secondId = "507f1f77bcf86cd799439012";
const userId = "current_user";
const addressData = {
  firstName: "Linh", lastName: "Nguyen", email: "linh@example.com",
  phone: "0949 622 581", street: "35 Xuan Dinh", city: "Ha Noi",
  state: "Xuan Dinh", country: "Vietnam", zipcode: "",
};
const response = () => ({
  statusCode: 200,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});
const request = (body = {}, extra = {}) => ({ auth: () => ({ userId }), user: { defaultAddressId: null }, body, ...extra });
const document = (values) => ({ ...values, toObject: () => ({ ...values }) });

test("checkout automatically chooses default and preserves an explicit choice or unfinished address", () => {
  const saved = [{ _id: firstId, isDefault: false }, { _id: secondId, isDefault: true }];
  assert.equal(resolveCheckoutAddress(initialCheckoutAddress, saved)._id, secondId);
  assert.equal(resolveCheckoutAddress({ _id: firstId }, saved)._id, firstId);
  const draft = { ...initialCheckoutAddress, street: "Unfinished address" };
  assert.deepEqual(resolveCheckoutAddress(draft, saved), draft);
  const empty = resolveCheckoutAddress(initialCheckoutAddress, [], { firstName: "Linh", primaryEmailAddress: { emailAddress: "linh@example.com" } });
  assert.equal(empty.firstName, "Linh");
  assert.equal(empty.email, "linh@example.com");
  assert.equal(resolveCheckoutAddress({ _id: "deleted" }, saved)._id, secondId);
  assert.equal(resolveCheckoutAddress({ _id: "deleted" }, [])._id, undefined);
});

test("phone normalization accepts both formats, ignores whitespace and matches in client and server", () => {
  for (const value of ["0949622581", " 0 949 622 581 ", "(+84)949622581", "(+84) 949 622 581", " ( + 84 ) 949 622 581 ", "0\t949\n622\u00a0581"]) {
    const expected = { valid: true, normalized: "(+84) 949 622 581", error: "" };
    assert.deepEqual(validateDeliveryPhone(value), expected);
    assert.deepEqual(validateClientPhone(value), expected);
  }
  for (const leading of [2, 3, 4, 5, 6, 7, 8, 9]) {
    assert.equal(validateDeliveryPhone(`0${leading}12345678`).valid, true);
  }
});

test("phone validation rejects wrong lengths, 00/01, malformed prefixes and non-digit content", () => {
  for (const value of ["", "   ", "094962258", "09496225811", "0094622581", "0194622581", "0 1 94622581", "(+84)094962258", "(+84)194962258", "(+84)94962258", "(+84)9496225811", "949622581", "(+85)949622581", "0949-622-581", "0949.622.581", "094962258a", "(+84)94962258x", "(+84)949622581 ext 1", "(+84))949622581"]) {
    const result = validateDeliveryPhone(value);
    assert.equal(result.valid, false, value);
    assert.ok(result.error);
    assert.deepEqual(validateClientPhone(value), result);
  }
});

test("all address routes require authentication", () => {
  for (const path of ["/", "/add", "/:addressId/default"]) {
    assert.equal(addressRouter.stack.find((layer) => layer.route?.path === path).route.stack[0].handle, authUser);
  }
});

test("saving the first address normalizes the phone and assigns default only for the authenticated user", async (t) => {
  t.mock.method(Address, "findOne", async (filter) => {
    assert.equal(filter.userId, userId);
    assert.equal(filter.phone, "(+84) 949 622 581");
    return null;
  });
  t.mock.method(Address, "create", async (values) => {
    assert.equal(values.userId, userId);
    assert.equal(values.phone, "(+84) 949 622 581");
    assert.equal(values.email, "linh@example.com");
    return document({ _id: firstId, ...values });
  });
  t.mock.method(User, "findOneAndUpdate", async (filter, update) => {
    assert.equal(filter._id, userId);
    assert.deepEqual(filter.$or, [{ defaultAddressId: null }, { defaultAddressId: firstId }]);
    assert.equal(update.$set.defaultAddressId, firstId);
    return { defaultAddressId: firstId };
  });
  const res = response();
  await addAddress(request({ address: { ...addressData, userId: "someone_else", email: "LINH@example.com" } }), res);
  assert.equal(res.statusCode, 201);
  assert.equal(res.body.address.isDefault, true);
});

test("saving another address preserves the current default unless explicitly requested", async (t) => {
  t.mock.method(Address, "findOne", async () => null);
  t.mock.method(Address, "create", async (values) => document({ _id: secondId, ...values }));
  t.mock.method(User, "findOneAndUpdate", async (filter) => {
    assert.equal(filter._id, userId);
    return filter.$or ? null : { defaultAddressId: secondId };
  });
  for (const makeDefault of [false, true]) {
    const res = response();
    await addAddress(request({ address: addressData, makeDefault }), res);
    assert.equal(res.body.success, true);
    assert.equal(res.body.address.isDefault, makeDefault);
  }
});

test("retrying the same address reuses its ID without creating duplicate saved addresses", async (t) => {
  t.mock.method(Address, "findOne", async () => document({ _id: firstId, ...addressData, phone: "(+84) 949 622 581" }));
  const create = t.mock.method(Address, "create", async () => { throw new Error("Duplicate address"); });
  t.mock.method(User, "findOneAndUpdate", async () => ({ defaultAddressId: firstId }));
  const res = response();
  await addAddress(request({ address: addressData }), res);
  assert.equal(res.body.address._id, firstId);
  assert.equal(create.mock.callCount(), 0);
});

test("invalid phones never write an address or change the default", async (t) => {
  const create = t.mock.method(Address, "create", async () => { throw new Error("Unexpected write"); });
  const update = t.mock.method(User, "findOneAndUpdate", async () => { throw new Error("Unexpected write"); });
  for (const phone of ["094962258", "09496225811", "0194622581", "(+84)194962258", "0949abc2581"]) {
    const res = response();
    await addAddress(request({ address: { ...addressData, phone }, makeDefault: true }), res);
    assert.equal(res.statusCode, 400);
  }
  assert.equal(create.mock.callCount(), 0);
  assert.equal(update.mock.callCount(), 0);
});

test("saved addresses expose one default, use legacy fallback, and only query the authenticated user", async (t) => {
  t.mock.method(Address, "find", (filter) => {
    assert.deepEqual(filter, { userId });
    return { sort: () => ({ lean: async () => [{ _id: secondId }, { _id: firstId }] }) };
  });
  for (const pointer of [null, firstId, secondId, "missing"]) {
    const res = response();
    await getAddress(request({}, { user: { defaultAddressId: pointer } }), res);
    const defaults = res.body.addresses.filter((entry) => entry.isDefault);
    assert.equal(defaults.length, 1);
    assert.equal(defaults[0]._id, pointer === firstId ? firstId : secondId);
  }
});

test("setting a default cannot use another customer's address or modify an address document", async (t) => {
  const write = t.mock.method(User, "updateOne", async (filter, update) => {
    assert.deepEqual(filter, { _id: userId });
    assert.equal(update.$set.defaultAddressId, firstId);
  });
  t.mock.method(Address, "findOne", async (filter) => {
    assert.equal(filter.userId, userId);
    return filter._id === firstId ? { _id: firstId } : null;
  });
  for (const [addressId, statusCode] of [[secondId, 404], ["invalid", 400], [firstId, 200]]) {
    const res = response();
    await setDefaultAddress(request({}, { params: { addressId } }), res);
    assert.equal(res.statusCode, statusCode);
  }
  assert.equal(write.mock.callCount(), 1);
});

test("COD and QR checkout reject legacy saved addresses with invalid phone numbers", async (t) => {
  t.mock.method(Order, "exists", async () => null);
  t.mock.method(Order, "findOne", () => ({ sort: async () => null }));
  const write = t.mock.method(Order, "create", async () => { throw new Error("Unexpected order"); });
  const session = { withTransaction: async (callback) => callback(), endSession: async () => {} };
  t.mock.method(mongoose, "startSession", async () => session);
  t.mock.method(Address, "findOne", (filter) => {
    assert.deepEqual(filter, { _id: firstId, userId });
    return { session: async () => ({ _id: firstId, phone: "0194622581" }) };
  });
  for (const handler of [placeOrderCOD, placeOrderQr]) {
    const res = response();
    await handler(request({ address: firstId, items: [] }), res);
    assert.equal(res.statusCode, 400);
    assert.match(res.body.message, /00 or 01/);
  }
  assert.equal(write.mock.callCount(), 0);
});
