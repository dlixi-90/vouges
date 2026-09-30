import test from "node:test";
import assert from "node:assert/strict";
import Order from "../../models/Order.js";
import Product from "../../models/Product.js";
import User from "../../models/User.js";
import mongoose from "mongoose";
import authUser, { requireOwner } from "../../middleware/authMiddleware.js";
import {
  sepayWebhook,
  cancelQrOrder,
  updateStatus,
} from "../../controllers/orderController.js";
import { createProduct } from "../../controllers/productController.js";

const ORDER_ID = "507f1f77bcf86cd799439011";

const createResponse = () => {
  const state = { statusCode: 200, payload: null };
  const response = {
    status(statusCode) {
      state.statusCode = statusCode;
      return response;
    },
    json(payload) {
      state.payload = payload;
      return response;
    },
  };

  return { state, response };
};

test("requireOwner blocks a normal authenticated user", () => {
  const { state, response } = createResponse();
  let calledNext = false;

  requireOwner({ user: { role: "user" } }, response, () => {
    calledNext = true;
  });

  assert.equal(state.statusCode, 403);
  assert.equal(state.payload.success, false);
  assert.equal(calledNext, false);
});

test("requireOwner allows an owner", () => {
  const { response } = createResponse();
  let calledNext = false;

  requireOwner({ user: { role: "owner" } }, response, () => {
    calledNext = true;
  });

  assert.equal(calledNext, true);
});

test("authUser promotes every email configured in ADMIN_EMAILS", async () => {
  const previousAdminEmails = process.env.ADMIN_EMAILS;
  const previousAdminEmail = process.env.ADMIN_EMAIL;
  const originalFindById = User.findById;
  const originalFindByIdAndUpdate = User.findByIdAndUpdate;
  const promotedEmails = [];
  let currentEmail;

  process.env.ADMIN_EMAILS =
    " first.admin@example.com, SECOND.ADMIN@example.com, first.admin@example.com ";
  delete process.env.ADMIN_EMAIL;

  User.findById = async () => ({ email: currentEmail, role: "user" });
  User.findByIdAndUpdate = async (_userId, update) => {
    promotedEmails.push(currentEmail);
    return { email: currentEmail, role: update.role };
  };

  try {
    for (const email of [
      "FIRST.ADMIN@example.com",
      "second.admin@example.com",
    ]) {
      currentEmail = email;
      let calledNext = false;

      await authUser(
        { auth: () => ({ userId: "user_test" }) },
        createResponse().response,
        () => {
          calledNext = true;
        },
      );

      assert.equal(calledNext, true);
    }

    assert.deepEqual(promotedEmails, [
      "FIRST.ADMIN@example.com",
      "second.admin@example.com",
    ]);
  } finally {
    User.findById = originalFindById;
    User.findByIdAndUpdate = originalFindByIdAndUpdate;

    if (previousAdminEmails === undefined) {
      delete process.env.ADMIN_EMAILS;
    } else {
      process.env.ADMIN_EMAILS = previousAdminEmails;
    }

    if (previousAdminEmail === undefined) {
      delete process.env.ADMIN_EMAIL;
    } else {
      process.env.ADMIN_EMAIL = previousAdminEmail;
    }
  }
});

test("authUser still accepts the legacy ADMIN_EMAIL variable", async () => {
  const previousAdminEmails = process.env.ADMIN_EMAILS;
  const previousAdminEmail = process.env.ADMIN_EMAIL;
  const originalFindById = User.findById;
  const originalFindByIdAndUpdate = User.findByIdAndUpdate;
  let updatedRole;

  delete process.env.ADMIN_EMAILS;
  process.env.ADMIN_EMAIL = "legacy.admin@example.com";
  User.findById = async () => ({
    email: "legacy.admin@example.com",
    role: "user",
  });
  User.findByIdAndUpdate = async (_userId, update) => {
    updatedRole = update.role;
    return { email: "legacy.admin@example.com", role: update.role };
  };

  try {
    await authUser(
      { auth: () => ({ userId: "user_test" }) },
      createResponse().response,
      () => {},
    );

    assert.equal(updatedRole, "owner");
  } finally {
    User.findById = originalFindById;
    User.findByIdAndUpdate = originalFindByIdAndUpdate;

    if (previousAdminEmails === undefined) {
      delete process.env.ADMIN_EMAILS;
    } else {
      process.env.ADMIN_EMAILS = previousAdminEmails;
    }

    if (previousAdminEmail === undefined) {
      delete process.env.ADMIN_EMAIL;
    } else {
      process.env.ADMIN_EMAIL = previousAdminEmail;
    }
  }
});

test("SePay webhook rejects a non-numeric amount before querying orders", async () => {
  const previousKey = process.env.SEPAY_WEBHOOK_API_KEY;
  const originalFindOne = Order.findOne;
  let queriedOrder = false;
  process.env.SEPAY_WEBHOOK_API_KEY = "webhook-test-key";
  Order.findOne = async () => {
    queriedOrder = true;
    return null;
  };

  try {
    const { state, response } = createResponse();

    await sepayWebhook(
      {
        get: () => "Apikey webhook-test-key",
        body: {
          id: "transaction-1",
          transferType: "in",
          transferAmount: "not-a-number",
        },
      },
      response,
    );

    assert.equal(state.statusCode, 400);
    assert.equal(state.payload.success, false);
    assert.equal(queriedOrder, false);
  } finally {
    Order.findOne = originalFindOne;
    if (previousKey === undefined) {
      delete process.env.SEPAY_WEBHOOK_API_KEY;
    } else {
      process.env.SEPAY_WEBHOOK_API_KEY = previousKey;
    }
  }
});

test("cancelling an awaiting QR order restores stock", async () => {
  const originalStartSession = mongoose.startSession;
  const originalOrderFindOne = Order.findOne;
  const originalProductFind = Product.find;
  const productId = "507f1f77bcf86cd799439012";
  let orderFilter;
  let orderSaved = false;
  let productSaved = false;
  const order = {
    paymentMethod: "QR",
    isPaid: false,
    status: "Awaiting Payment",
    paymentExpiresAt: new Date(Date.now() + 60_000),
    items: [{ product: productId, size: "M", quantity: 2 }],
    async save() {
      orderSaved = true;
    },
  };
  const product = {
    _id: productId,
    sizes: ["M"],
    stockBySize: { M: 3 },
    inStockBySize: { M: true },
    inStock: true,
    isDeleted: false,
    markModified() {},
    async save() {
      productSaved = true;
    },
  };

  mongoose.startSession = async () => ({
    async withTransaction(operation) {
      await operation();
    },
    async endSession() {},
  });
  Order.findOne = (filter) => {
    orderFilter = filter;
    return { session: async () => order };
  };
  Product.find = () => ({ session: async () => [product] });

  try {
    const { state, response } = createResponse();

    await cancelQrOrder(
      {
        auth: () => ({ userId: "user_test" }),
        params: { orderId: ORDER_ID },
      },
      response,
    );

    assert.equal(state.payload.success, true);
    assert.equal(orderFilter.userId, "user_test");
    assert.equal(order.status, "Payment Cancelled");
    assert.equal(product.stockBySize.M, 5);
    assert.equal(orderSaved, true);
    assert.equal(productSaved, true);
    assert.deepEqual(state.payload.stockUpdates, [{
      _id: productId, stockBySize: { M: 5 }, inStockBySize: { M: true }, inStock: true,
    }]);
    // A lost response may cause Back to be retried; never restore stock twice.
    productSaved = false;
    orderSaved = false;
    const retried = createResponse();
    await cancelQrOrder({ auth: () => ({ userId: "user_test" }), params: { orderId: ORDER_ID } }, retried.response);
    assert.equal(retried.state.payload.success, true);
    assert.equal(product.stockBySize.M, 5);
    assert.equal(productSaved, false);
    assert.equal(orderSaved, false);
  } finally {
    mongoose.startSession = originalStartSession;
    Order.findOne = originalOrderFindOne;
    Product.find = originalProductFind;
  }
});

test("QR cancellation cannot undo confirmed payments or another customer's order", async (t) => {
  t.mock.method(mongoose, "startSession", async () => ({
    withTransaction: async (fn) => fn(), endSession: async () => {},
  }));
  t.mock.method(Product, "find", () => { throw new Error("Stock must not change"); });
  let currentOrder;
  t.mock.method(Order, "findOne", (filter) => {
    assert.equal(filter.userId, "current-user");
    return { session: async () => currentOrder };
  });
  for (const [order, expected] of [
    [{ paymentMethod: "QR", isPaid: true, status: "Order Placed" }, 409],
    [{ paymentMethod: "QR", isPaid: false, status: "Payment Review" }, 409],
    [null, 404],
  ]) {
    currentOrder = order;
    const { state, response } = createResponse();
    await cancelQrOrder({ auth: () => ({ userId: "current-user" }), params: { orderId: ORDER_ID } }, response);
    assert.equal(state.statusCode, expected);
    assert.equal(state.payload.success, false);
  }
});

test("delivered COD orders are marked paid", async () => {
  const originalFindById = Order.findById;
  const originalFindOneAndUpdate = Order.findOneAndUpdate;
  let saved = false;
  const order = {
    paymentMethod: "COD",
    isPaid: false,
    status: "Shipping",
    async save() {
      saved = true;
    },
  };
  Order.findById = async () => order;
  Order.findOneAndUpdate = async (filter, update) => {
    assert.deepEqual(filter, { _id: ORDER_ID, status: "Shipping", isPaid: false });
    Object.assign(order, update.$set);
    saved = true;
    return order;
  };

  try {
    const { state, response } = createResponse();

    await updateStatus(
      { body: { orderId: ORDER_ID, status: "Delivery" } },
      response,
    );

    assert.equal(state.payload.success, true);
    assert.equal(saved, true);
    assert.equal(order.status, "Delivery");
    assert.equal(order.isPaid, true);
    assert.equal(order.paidAt instanceof Date, true);
  } finally {
    Order.findById = originalFindById;
    Order.findOneAndUpdate = originalFindOneAndUpdate;
  }
});

test("order statuses only advance, including skipping steps, without changing paid orders", async (t) => {
  const statuses = ["Order Placed", "Packing", "Shipping", "Delivery"];
  const paidAt = new Date("2026-01-01T00:00:00Z");
  let storedOrder;
  let writes;
  t.mock.method(Order, "findById", async () => ({ ...storedOrder }));
  t.mock.method(Order, "findOneAndUpdate", async (filter, update) => {
    assert.equal(filter.status, storedOrder.status);
    assert.equal(filter.isPaid, storedOrder.isPaid);
    writes++;
    Object.assign(storedOrder, update.$set);
    return { ...storedOrder };
  });

  for (const paymentMethod of ["COD", "QR"]) {
    for (const from of statuses) {
      for (const to of statuses) {
        storedOrder = { status: from, paymentMethod, isPaid: true, paidAt, amount: 100 };
        writes = 0;
        const { state, response } = createResponse();
        await updateStatus({ body: { orderId: ORDER_ID, status: to } }, response);
        const backwards = statuses.indexOf(to) < statuses.indexOf(from);
        assert.equal(state.statusCode, backwards ? 409 : 200, `${from} -> ${to}`);
        assert.equal(state.payload.success, !backwards);
        assert.equal(storedOrder.status, backwards ? from : to);
        assert.equal(writes, !backwards && from !== to ? 1 : 0);
        assert.equal(storedOrder.isPaid, true);
        assert.equal(storedOrder.paidAt, paidAt);
        assert.equal(storedOrder.amount, 100);
      }
    }
  }
});

test("unpaid COD orders are paid only on delivery, including a direct jump", async (t) => {
  let order;
  t.mock.method(Order, "findById", async () => ({ ...order }));
  t.mock.method(Order, "findOneAndUpdate", async (_filter, update) => {
    Object.assign(order, update.$set);
    return order;
  });
  for (const status of ["Packing", "Shipping", "Delivery"]) {
    order = { status: "Order Placed", paymentMethod: "COD", isPaid: false, amount: 100 };
    const { state, response } = createResponse();
    await updateStatus({ body: { orderId: ORDER_ID, status } }, response);
    assert.equal(state.payload.success, true);
    assert.equal(order.isPaid, status === "Delivery");
    assert.equal(order.paidAt instanceof Date, status === "Delivery");
    assert.equal(order.amount, 100);
  }
});

test("a stale status request cannot overwrite a concurrently delivered order", async (t) => {
  const paidAt = new Date();
  const storedOrder = { status: "Order Placed", paymentMethod: "COD", isPaid: false };
  t.mock.method(Order, "findById", async () => ({ ...storedOrder }));
  t.mock.method(Order, "findOneAndUpdate", async (filter, update) => {
    Object.assign(storedOrder, { status: "Delivery", isPaid: true, paidAt });
    if (filter.status !== storedOrder.status || filter.isPaid !== storedOrder.isPaid) return null;
    Object.assign(storedOrder, update.$set);
    return storedOrder;
  });
  const { state, response } = createResponse();
  await updateStatus({ body: { orderId: ORDER_ID, status: "Packing" } }, response);
  assert.equal(state.statusCode, 409);
  assert.equal(storedOrder.status, "Delivery");
  assert.equal(storedOrder.paidAt, paidAt);
});

test("payment workflow statuses cannot be changed through fulfillment updates", async (t) => {
  let status;
  t.mock.method(Order, "findById", async () => ({ status, paymentMethod: "QR", isPaid: false }));
  const write = t.mock.method(Order, "findOneAndUpdate", async () => assert.fail("Unexpected write"));
  for (status of ["Awaiting Payment", "Payment Cancelled", "Payment Expired", "Payment Review"]) {
    const { state, response } = createResponse();
    await updateStatus({ body: { orderId: ORDER_ID, status: "Delivery" } }, response);
    assert.equal(state.statusCode, 409);
  }
  assert.equal(write.mock.callCount(), 0);
});

test("product validation rejects duplicate sizes before uploading", async () => {
  const { state, response } = createResponse();

  await createProduct(
    {
      body: {
        productData: JSON.stringify({
          title: "Test product",
          description: "Description",
          category: "Body Care",
          type: "Lotion",
          sizes: ["M", "M"],
          price: { M: 10 },
          stockBySize: { M: 1 },
        }),
      },
      files: [],
    },
    response,
  );

  assert.equal(state.statusCode, 400);
  assert.equal(state.payload.success, false);
});
