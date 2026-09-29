import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import Address from "../../models/Address.js";
import User from "../../models/User.js";
import Order from "../../models/Order.js";
import { addAddress, getAddress, setDefaultAddress, deleteAddress, updateAddress } from "../../controllers/addressController.js";
import { placeOrderCOD, placeOrderQr } from "../../controllers/orderController.js";
import addressRouter from "../../routes/addressRoute.js";
import authUser from "../../middleware/authMiddleware.js";
import { validateDeliveryPhone } from "../../utils/deliveryPhone.js";
import { validateDeliveryPhone as validateClientPhone } from "../../../client/src/utils/deliveryPhone.js";
import { initialCheckoutAddress, resolveCheckoutAddress, removeSavedAddress, replaceSavedAddress } from "../../../client/src/utils/checkoutAddress.js";

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
  for (const layer of addressRouter.stack.filter((entry) => entry.route)) {
    assert.equal(layer.route.stack[0].handle, authUser);
  }
  assert.ok(addressRouter.stack.some((layer) => layer.route?.path === "/:addressId" && layer.route.methods.patch));
});

const setupAddressEdit = (t, { found = true, matched = true, isDefault = true } = {}) => {
  const session = {};
  const original = document({
    _id: firstId, userId, ...addressData, phone: "(+84) 949 622 581",
    savedAt: new Date("2026-09-01"), createdAt: new Date("2026-09-01"), updatedAt: new Date("2026-09-01"),
  });
  t.mock.method(mongoose.connection, "transaction", async (callback) => callback(session));
  t.mock.method(Address, "findOne", (filter) => {
    assert.deepEqual(filter, { _id: firstId, userId, savedAt: { $ne: null }, deletedAt: null });
    return { session: async (value) => { assert.equal(value, session); return found ? original : null; } };
  });
  const create = t.mock.method(Address, "create", async ([values], options) => {
    assert.equal(options.session, session);
    assert.equal(values.userId, userId);
    assert.equal(values.savedAt, original.savedAt);
    assert.equal(values.createdAt, original.createdAt);
    assert.equal(values._id, undefined);
    return [document({ _id: secondId, ...values })];
  });
  const retire = t.mock.method(Address, "updateOne", async (filter, update, options) => {
    assert.deepEqual(filter, { _id: firstId, userId, deletedAt: null, updatedAt: original.updatedAt });
    assert.equal(options.session, session);
    assert.deepEqual(Object.keys(update.$set), ["deletedAt"]);
    return { matchedCount: matched ? 1 : 0 };
  });
  const pointer = t.mock.method(User, "findOneAndUpdate", async (filter, update, options) => {
    assert.equal(filter._id, userId);
    assert.equal(options.session, session);
    assert.ok([firstId, secondId].includes(String(update.$set.defaultAddressId)));
    return isDefault ? { defaultAddressId: update.$set.defaultAddressId } : null;
  });
  const orderWrite = t.mock.method(Order, "updateMany", async () => { throw new Error("Order history must not change"); });
  return { original, create, retire, pointer, orderWrite };
};

test("editing replaces one saved entry, normalizes phone and preserves original delivery data for old orders", async (t) => {
  const { original, create, retire, pointer, orderWrite } = setupAddressEdit(t);
  const res = response();
  await updateAddress(request({ address: { ...addressData, street: "New street", phone: "0987 654 321", userId: "another_user", _id: "injected", savedAt: null } }, { params: { addressId: firstId } }), res);
  assert.equal(res.body.success, true);
  assert.equal(res.body.address._id, secondId);
  assert.equal(res.body.replacedAddressId, firstId);
  assert.equal(res.body.address.phone, "(+84) 987 654 321");
  assert.equal(res.body.address.street, "New street");
  assert.equal(res.body.address.isDefault, true);
  assert.equal(original.street, addressData.street);
  assert.equal(original.phone, "(+84) 949 622 581");
  assert.equal(pointer.mock.calls[0].arguments[0].defaultAddressId, firstId);
  assert.equal(create.mock.callCount(), 1);
  assert.equal(retire.mock.callCount(), 1);
  assert.equal(orderWrite.mock.callCount(), 0);
});

test("saving unchanged address keeps the same ID and creates no extra address", async (t) => {
  const { create, retire } = setupAddressEdit(t);
  const res = response();
  await updateAddress(request({ address: addressData }, { params: { addressId: firstId } }), res);
  assert.equal(res.body.address._id, firstId);
  assert.equal(create.mock.callCount(), 0);
  assert.equal(retire.mock.callCount(), 0);
});

test("editing a nondefault address preserves the default unless explicitly requested", async (t) => {
  const { pointer } = setupAddressEdit(t, { isDefault: false });
  for (const makeDefault of [false, true]) {
    const res = response();
    await updateAddress(request({ address: { ...addressData, street: "New street" }, makeDefault }, { params: { addressId: firstId } }), res);
    assert.equal(res.body.success, true);
    assert.equal(pointer.mock.calls.at(-1).arguments[0].defaultAddressId, makeDefault ? undefined : firstId);
  }
});

test("editing rejects invalid phones and missing fields before any database writes", async (t) => {
  const transaction = t.mock.method(mongoose.connection, "transaction", async () => { throw new Error("Unexpected transaction"); });
  for (const changes of [{ phone: "0194622581" }, { phone: "094962258" }, { phone: "(+84)9496225811" }, { street: " " }, { email: "invalid" }]) {
    const res = response();
    await updateAddress(request({ address: { ...addressData, ...changes } }, { params: { addressId: firstId } }), res);
    assert.equal(res.statusCode, 400);
  }
  const res = response();
  await updateAddress(request({ address: addressData }, { params: { addressId: "invalid" } }), res);
  assert.equal(res.statusCode, 400);
  assert.equal(transaction.mock.callCount(), 0);
});

test("editing cannot revive deleted or unsaved entries or edit another user's address", async (t) => {
  const { create, retire, pointer } = setupAddressEdit(t, { found: false });
  const res = response();
  await updateAddress(request({ address: addressData }, { params: { addressId: firstId } }), res);
  assert.equal(res.statusCode, 404);
  assert.equal(create.mock.callCount(), 0);
  assert.equal(retire.mock.callCount(), 0);
  assert.equal(pointer.mock.callCount(), 0);
});

test("a concurrent address change rejects the replacement before switching default", async (t) => {
  const { pointer } = setupAddressEdit(t, { matched: false });
  const res = response();
  await updateAddress(request({ address: { ...addressData, street: "New street" } }, { params: { addressId: firstId } }), res);
  assert.equal(res.statusCode, 409);
  assert.equal(pointer.mock.callCount(), 0);
});

test("edited addresses replace their row in place and leave only one default", () => {
  const saved = [{ _id: firstId, isDefault: true, ...addressData }, { _id: secondId, isDefault: false, ...addressData }];
  const updated = { ...saved[1], _id: "replacement", street: "New street", isDefault: true };
  const next = replaceSavedAddress(saved, secondId, updated);
  assert.equal(next.length, 2);
  assert.equal(next[0]._id, firstId);
  assert.equal(next[0].isDefault, false);
  assert.equal(next[1], updated);
  assert.equal(saved[0].isDefault, true);
  assert.equal(saved[1].street, addressData.street);
});

test("saving the first address normalizes the phone and assigns default only for the authenticated user", async (t) => {
  t.mock.method(Address, "findOne", async (filter) => {
    assert.equal(filter.userId, userId);
    assert.equal(filter.phone, "(+84) 949 622 581");
    assert.deepEqual(filter.savedAt, { $ne: null });
    assert.equal(filter.deletedAt, null);
    return null;
  });
  t.mock.method(Address, "create", async (values) => {
    assert.equal(values.userId, userId);
    assert.equal(values.phone, "(+84) 949 622 581");
    assert.equal(values.email, "linh@example.com");
    assert.ok(values.savedAt instanceof Date);
    return document({ _id: firstId, ...values });
  });
  t.mock.method(User, "findOneAndUpdate", async (filter, update) => {
    assert.equal(filter._id, userId);
    assert.deepEqual(filter.$or, [{ defaultAddressId: null }, { defaultAddressId: firstId }]);
    assert.equal(update.$set.defaultAddressId, firstId);
    return { defaultAddressId: firstId };
  });
  const res = response();
  await addAddress(request({ saveToAddressBook: true, address: { ...addressData, userId: "someone_else", email: "LINH@example.com" } }), res);
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
    await addAddress(request({ saveToAddressBook: true, address: addressData, makeDefault }), res);
    assert.equal(res.body.success, true);
    assert.equal(res.body.address.isDefault, makeDefault);
  }
});

test("retrying the same address reuses its ID without creating duplicate saved addresses", async (t) => {
  t.mock.method(Address, "findOne", async () => document({ _id: firstId, ...addressData, phone: "(+84) 949 622 581" }));
  const create = t.mock.method(Address, "create", async () => { throw new Error("Duplicate address"); });
  t.mock.method(User, "findOneAndUpdate", async () => ({ defaultAddressId: firstId }));
  const res = response();
  await addAddress(request({ saveToAddressBook: true, address: addressData }), res);
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

test("address book only queries explicitly saved, undeleted addresses belonging to the authenticated user", async (t) => {
  t.mock.method(Address, "find", (filter) => {
    assert.deepEqual(filter, { userId, savedAt: { $ne: null }, deletedAt: null });
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
    assert.deepEqual(filter.savedAt, { $ne: null });
    assert.equal(filter.deletedAt, null);
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
    assert.deepEqual(filter, { _id: firstId, userId, deletedAt: null });
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

test("checkout and older clients do not implicitly save delivery records or change the default", async (t) => {
  const read = t.mock.method(Address, "findOne", async () => { throw new Error("Should not reuse saved address"); });
  const write = t.mock.method(User, "findOneAndUpdate", async () => { throw new Error("Should not change default"); });
  t.mock.method(Address, "create", async (values) => {
    assert.equal(values.savedAt, null);
    assert.equal(values.userId, userId);
    return document({ _id: firstId, ...values });
  });
  for (const saveToAddressBook of [undefined, false, "true"]) {
    const res = response();
    await addAddress(request({ address: addressData, makeDefault: true, saveToAddressBook }), res);
    assert.equal(res.body.success, true);
    assert.equal(res.body.address.savedAt, null);
    assert.equal(res.body.address.isDefault, false);
  }
  assert.equal(read.mock.callCount(), 0);
  assert.equal(write.mock.callCount(), 0);
});

test("legacy delivery records have no implicit saved marker and an empty address book stays empty", async (t) => {
  const legacy = new Address({ ...addressData, userId });
  assert.equal(legacy.savedAt, null);
  t.mock.method(Address, "find", (filter) => {
    assert.deepEqual(filter, { userId, savedAt: { $ne: null }, deletedAt: null });
    return { sort: () => ({ lean: async () => [] }) };
  });
  const res = response();
  await getAddress(request({}, { user: { defaultAddressId: firstId } }), res);
  assert.deepEqual(res.body.addresses, []);
});

test("deleting a saved address preserves delivery data for orders and clears only its default pointer", async (t) => {
  t.mock.method(Address, "findOneAndUpdate", async (filter, update) => {
    assert.deepEqual(filter, { _id: firstId, userId, savedAt: { $ne: null }, deletedAt: null });
    assert.deepEqual(Object.keys(update), ["$set"]);
    assert.deepEqual(Object.keys(update.$set), ["deletedAt"]);
    assert.ok(update.$set.deletedAt instanceof Date);
    return { _id: firstId, ...addressData };
  });
  const remove = t.mock.method(Address, "deleteOne", async () => { throw new Error("Must retain order delivery data"); });
  t.mock.method(Address, "findOne", (filter) => {
    assert.deepEqual(filter, { userId, savedAt: { $ne: null }, deletedAt: null });
    return { sort: async () => null };
  });
  const orderWrite = t.mock.method(Order, "updateMany", async () => { throw new Error("Must not change order history"); });
  t.mock.method(User, "updateOne", async (filter, update) => {
    assert.deepEqual(filter, { _id: userId, defaultAddressId: firstId });
    assert.deepEqual(update, { $set: { defaultAddressId: null } });
  });
  const res = response();
  await deleteAddress(request({}, { params: { addressId: firstId } }), res);
  assert.equal(res.body.success, true);
  assert.equal(res.body.addressId, firstId);
  assert.equal(remove.mock.callCount(), 0);
  assert.equal(orderWrite.mock.callCount(), 0);
});

test("deleting a default address persists the next saved address as default", async (t) => {
  t.mock.method(Address, "findOneAndUpdate", async () => ({ _id: firstId }));
  t.mock.method(Address, "findOne", () => ({ sort: async () => ({ _id: secondId }) }));
  t.mock.method(User, "updateOne", async (filter, update) => {
    assert.deepEqual(filter, { _id: userId, defaultAddressId: firstId });
    assert.equal(update.$set.defaultAddressId, secondId);
  });
  const res = response();
  await deleteAddress(request({}, { params: { addressId: firstId } }), res);
  assert.equal(res.body.success, true);
});

test("deletion rejects invalid IDs, other users' addresses and already deleted records", async (t) => {
  const remove = t.mock.method(Address, "findOneAndUpdate", async (filter) => {
    assert.equal(filter.userId, userId);
    assert.equal(filter.deletedAt, null);
    return null;
  });
  const update = t.mock.method(User, "updateOne", async () => { throw new Error("Unexpected default change"); });
  for (const [addressId, status] of [["invalid", 400], [secondId, 404]]) {
    const res = response();
    await deleteAddress(request({}, { params: { addressId } }), res);
    assert.equal(res.statusCode, status);
  }
  assert.equal(remove.mock.callCount(), 1);
  assert.equal(update.mock.callCount(), 0);
});

test("deleting the selected or default address chooses a remaining address and clearing the last one resets checkout", () => {
  const saved = [{ _id: firstId, isDefault: true, ...addressData }, { _id: secondId, isDefault: false, ...addressData }];
  const remaining = removeSavedAddress(saved, firstId);
  assert.equal(remaining.length, 1);
  assert.equal(remaining[0].isDefault, true);
  assert.equal(resolveCheckoutAddress(saved[0], remaining)._id, secondId);
  assert.equal(resolveCheckoutAddress(saved[1], remaining)._id, secondId);
  assert.deepEqual(removeSavedAddress(saved, secondId), [saved[0]]);
  const empty = removeSavedAddress(remaining, secondId);
  assert.deepEqual(empty, []);
  const cleared = resolveCheckoutAddress(remaining[0], empty);
  assert.equal(cleared._id, undefined);
  assert.equal(cleared.street, "");
  assert.equal(cleared.phone, "");
});
