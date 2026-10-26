import assert from "node:assert/strict";
import test from "node:test";
import AIToolAudit from "../../models/AIToolAudit.js";
import Order from "../../models/Order.js";
import Product from "../../models/Product.js";
import User from "../../models/User.js";
import { runAgent } from "../../controllers/aiController.js";
import {
  addToCart,
  updateCart,
} from "../../controllers/cartController.js";
import {
  auditAIToolCall,
  sanitizeToolArguments,
} from "../../services/ai/auditAIToolCall.js";
import {
  getMyCart,
  getMyCartToolDefinition,
} from "../../services/ai/tools/getMyCart.js";
import {
  getMyOrders,
  getMyOrdersToolDefinition,
} from "../../services/ai/tools/getMyOrders.js";
import {
  prepareAddToCart,
  prepareAddToCartToolDefinition,
} from "../../services/ai/tools/prepareAddToCart.js";
import {
  prepareRemoveFromCart,
  prepareRemoveFromCartToolDefinition,
  prepareUpdateCart,
  prepareUpdateCartToolDefinition,
} from "../../services/ai/tools/prepareCartChanges.js";

const PRODUCT_ID = "507f1f77bcf86cd799439011";
const CLERK_USER_ID = "user_clerk_current";

const createQuery = (result) => ({
  select() {
    return this;
  },
  populate() {
    return this;
  },
  sort() {
    return this;
  },
  limit() {
    return this;
  },
  lean() {
    return Promise.resolve(result);
  },
});

const createResponse = () => {
  const state = { status: 200, payload: null };

  return {
    state,
    response: {
      status(statusCode) {
        state.status = statusCode;
        return this;
      },
      json(payload) {
        state.payload = payload;
        return payload;
      },
    },
  };
};

test("getMyOrders chỉ truy vấn đơn của Clerk user hiện tại", async () => {
  const originalFind = Order.find;
  let capturedFilter;
  let findCalls = 0;

  Order.find = (filter) => {
    capturedFilter = filter;
    findCalls += 1;
    return createQuery([]);
  };

  try {
    await getMyOrders({ limit: 3 }, { userId: CLERK_USER_ID });

    assert.equal(capturedFilter.userId, CLERK_USER_ID);
    assert.equal(
      Object.hasOwn(
        getMyOrdersToolDefinition.function.parameters.properties,
        "userId",
      ),
      false,
    );
    assert.equal(
      getMyOrdersToolDefinition.function.parameters.additionalProperties,
      false,
    );

    await assert.rejects(
      getMyOrders(
        { userId: "user_clerk_other" },
        { userId: CLERK_USER_ID },
      ),
    );
    await assert.rejects(getMyOrders({}, {}));
    assert.equal(findCalls, 1);
  } finally {
    Order.find = originalFind;
  }
});

test("getMyCart không nhận userId và không ghi dữ liệu", async () => {
  const originalUserFind = User.findById;
  const originalUserUpdate = User.findByIdAndUpdate;
  const originalProductFind = Product.find;
  let capturedUserId;
  let writeCalls = 0;

  User.findById = (userId) => {
    capturedUserId = userId;
    return createQuery({ cartData: { [PRODUCT_ID]: { M: 2 } } });
  };
  User.findByIdAndUpdate = () => {
    writeCalls += 1;
  };
  Product.find = () =>
    createQuery([
      {
        _id: PRODUCT_ID,
        title: "Cart product",
        price: { M: 12000 },
        sizes: ["M"],
        stockBySize: { M: 5 },
        inStockBySize: { M: true },
        images: [],
        inStock: true,
        isDeleted: false,
      },
    ]);

  try {
    const result = await getMyCart({}, { userId: CLERK_USER_ID });

    assert.equal(capturedUserId, CLERK_USER_ID);
    assert.equal(result.cart.itemCount, 2);
    assert.equal(result.cart.subtotal.amount, 24000);
    assert.equal(writeCalls, 0);
    assert.equal(
      Object.hasOwn(
        getMyCartToolDefinition.function.parameters.properties,
        "userId",
      ),
      false,
    );

    await assert.rejects(
      getMyCart(
        { userId: "user_clerk_other" },
        { userId: CLERK_USER_ID },
      ),
    );
    await assert.rejects(getMyCart({}, {}));
    assert.equal(writeCalls, 0);
  } finally {
    User.findById = originalUserFind;
    User.findByIdAndUpdate = originalUserUpdate;
    Product.find = originalProductFind;
  }
});

test("prepareAddToCart chỉ tạo đề xuất và chưa cập nhật giỏ", async () => {
  const originalUserFind = User.findById;
  const originalUserUpdate = User.findByIdAndUpdate;
  const originalProductFind = Product.findOne;
  let capturedUserId;
  let writeCalls = 0;

  User.findById = (userId) => {
    capturedUserId = userId;
    return createQuery({ cartData: { [PRODUCT_ID]: { M: 1 } } });
  };
  User.findByIdAndUpdate = () => {
    writeCalls += 1;
  };
  Product.findOne = () =>
    createQuery({
      _id: PRODUCT_ID,
      title: "Prepared product",
      price: { M: 20000 },
      sizes: ["M"],
      stockBySize: { M: 5 },
      inStockBySize: { M: true },
      images: [],
      inStock: true,
      isDeleted: false,
    });

  try {
    const result = await prepareAddToCart(
      { productId: PRODUCT_ID, size: "M", quantity: 2 },
      { userId: CLERK_USER_ID },
    );

    assert.equal(capturedUserId, CLERK_USER_ID);
    assert.equal(result.pendingCartAction.type, "addToCart");
    assert.equal(result.pendingCartAction.resultingQuantity, 3);
    assert.equal(result.pendingCartAction.lineTotal.amount, 40000);
    assert.equal(Object.hasOwn(result.pendingCartAction, "userId"), false);
    assert.equal(writeCalls, 0);
    assert.equal(
      Object.hasOwn(
        prepareAddToCartToolDefinition.function.parameters.properties,
        "userId",
      ),
      false,
    );

    await assert.rejects(
      prepareAddToCart(
        {
          productId: PRODUCT_ID,
          size: "M",
          userId: "user_clerk_other",
        },
        { userId: CLERK_USER_ID },
      ),
    );
    assert.equal(writeCalls, 0);
  } finally {
    User.findById = originalUserFind;
    User.findByIdAndUpdate = originalUserUpdate;
    Product.findOne = originalProductFind;
  }
});

test("prepare update/remove chỉ tạo đề xuất cho giỏ của Clerk user", async () => {
  const originalUserFind = User.findById;
  const originalUserUpdate = User.findByIdAndUpdate;
  const originalProductFind = Product.findOne;
  let productResult = {
    _id: PRODUCT_ID,
    title: "Cart product",
    price: { M: 20000 },
    sizes: ["M"],
    stockBySize: { M: 5 },
    inStockBySize: { M: true },
    images: [],
    inStock: true,
    isDeleted: false,
  };
  let capturedUserId;
  let writeCalls = 0;

  User.findById = (userId) => {
    capturedUserId = userId;
    return createQuery({ cartData: { [PRODUCT_ID]: { M: 3 } } });
  };
  User.findByIdAndUpdate = () => {
    writeCalls += 1;
  };
  Product.findOne = () => createQuery(productResult);

  try {
    const updateResult = await prepareUpdateCart(
      { productId: PRODUCT_ID, size: "M", quantity: 2 },
      { userId: CLERK_USER_ID },
    );

    productResult = null;

    const removeResult = await prepareRemoveFromCart(
      { productId: PRODUCT_ID, size: "M" },
      { userId: CLERK_USER_ID },
    );

    assert.equal(capturedUserId, CLERK_USER_ID);
    assert.equal(updateResult.pendingCartAction.type, "updateCart");
    assert.equal(updateResult.pendingCartAction.quantity, 2);
    assert.equal(removeResult.pendingCartAction.type, "removeFromCart");
    assert.equal(removeResult.pendingCartAction.currentQuantity, 3);
    assert.equal(
      removeResult.pendingCartAction.product.title,
      "Sản phẩm không còn tồn tại",
    );
    assert.equal(writeCalls, 0);
    assert.equal(
      Object.hasOwn(
        prepareUpdateCartToolDefinition.function.parameters.properties,
        "userId",
      ),
      false,
    );
    assert.equal(
      Object.hasOwn(
        prepareRemoveFromCartToolDefinition.function.parameters.properties,
        "userId",
      ),
      false,
    );

    await assert.rejects(
      prepareUpdateCart(
        {
          productId: PRODUCT_ID,
          size: "M",
          quantity: 1,
          userId: "user_clerk_other",
        },
        { userId: CLERK_USER_ID },
      ),
    );
    await assert.rejects(
      prepareRemoveFromCart(
        {
          productId: PRODUCT_ID,
          size: "M",
          userId: "user_clerk_other",
        },
        { userId: CLERK_USER_ID },
      ),
    );
    assert.equal(writeCalls, 0);
  } finally {
    User.findById = originalUserFind;
    User.findByIdAndUpdate = originalUserUpdate;
    Product.findOne = originalProductFind;
  }
});

test("audit log loại dữ liệu nhạy cảm và tự đặt thời hạn xóa", async () => {
  const originalCreate = AIToolAudit.create;
  let auditDocument;

  AIToolAudit.create = async (document) => {
    auditDocument = document;
    return document;
  };

  try {
    const sanitized = sanitizeToolArguments("searchProducts", {
      query: "email@example.com",
      category: "Face Care",
      userId: "must-not-be-saved",
    });

    assert.equal(Object.hasOwn(sanitized.safeArguments, "query"), false);
    assert.equal(Object.hasOwn(sanitized.safeArguments, "userId"), false);
    assert.equal(sanitized.safeArguments.queryProvided, true);
    assert.equal(sanitized.safeArguments.category, "Face Care");

    await auditAIToolCall({
      context: { userId: CLERK_USER_ID, requestId: "request_test" },
      toolCallId: "call_test",
      toolName: "getMyCart",
      argumentsValue: { userId: "user_clerk_other" },
      outcome: "rejected",
      errorMessage: "mongodb://username:password@database.example/test",
      durationMs: 4,
    });

    assert.equal(auditDocument.userId, CLERK_USER_ID);
    assert.equal(auditDocument.requestId, "request_test");
    assert.deepEqual(auditDocument.arguments, {});
    assert.equal(auditDocument.argumentKeys.includes("userId"), true);
    assert.equal(auditDocument.errorMessage.includes("password"), false);
    assert.equal(auditDocument.expiresAt instanceof Date, true);
    assert.equal(
      AIToolAudit.schema
        .indexes()
        .some(
          ([fields, options]) =>
            fields.expiresAt === 1 && options.expireAfterSeconds === 0,
        ),
      true,
    );
  } finally {
    AIToolAudit.create = originalCreate;
  }
});

test("agent audit mọi tool call thành công và bị từ chối", async () => {
  const originalAuditCreate = AIToolAudit.create;
  const originalUserFind = User.findById;
  const originalFetch = globalThis.fetch;
  const auditDocuments = [];
  let requestCount = 0;

  AIToolAudit.create = async (document) => {
    auditDocuments.push(document);
    return document;
  };
  User.findById = () => createQuery({ cartData: {} });
  globalThis.fetch = async () => {
    requestCount += 1;
    let message;

    if (requestCount === 1) {
      message = {
        role: "assistant",
        content: null,
        tool_calls: [
          {
            id: "call_success",
            type: "function",
            function: { name: "getMyCart", arguments: "{}" },
          },
        ],
      };
    } else if (requestCount === 3) {
      message = {
        role: "assistant",
        content: null,
        tool_calls: [
          {
            id: "call_rejected",
            type: "function",
            function: {
              name: "unknownTool",
              arguments: JSON.stringify({ secret: "must-not-be-saved" }),
            },
          },
        ],
      };
    } else {
      message = { role: "assistant", content: "Hoàn tất kiểm thử." };
    }

    return {
      ok: true,
      json: async () => ({ choices: [{ message }] }),
    };
  };

  try {
    await runAgent([{ role: "user", content: "Đọc giỏ" }], {
      userId: CLERK_USER_ID,
      requestId: "request_success",
    });
    await runAgent([{ role: "user", content: "Gọi tool lạ" }], {
      userId: CLERK_USER_ID,
      requestId: "request_rejected",
    });

    assert.equal(auditDocuments.length, 2);
    assert.equal(auditDocuments[0].toolName, "getMyCart");
    assert.equal(auditDocuments[0].outcome, "success");
    assert.equal(auditDocuments[1].toolName, "unknownTool");
    assert.equal(auditDocuments[1].outcome, "rejected");
    assert.deepEqual(auditDocuments[1].arguments, {});
    assert.equal(auditDocuments[1].argumentKeys.includes("secret"), true);
    assert.equal(
      JSON.stringify(auditDocuments).includes("must-not-be-saved"),
      false,
    );
    assert.equal(
      auditDocuments.every(
        (document) =>
          !Object.hasOwn(document, "prompt") &&
          !Object.hasOwn(document, "token"),
      ),
      true,
    );
  } finally {
    AIToolAudit.create = originalAuditCreate;
    User.findById = originalUserFind;
    globalThis.fetch = originalFetch;
  }
});

test("API xác nhận addToCart bỏ qua userId trong body", async () => {
  const originalUserFind = User.findById;
  const originalUserUpdate = User.findOneAndUpdate;
  const originalProductFind = Product.findOne;
  let updatedUserId;
  let savedIncrement;

  User.findById = async () => ({ cartData: { [PRODUCT_ID]: { M: 1 } } });
  User.findOneAndUpdate = async (filter, update) => {
    updatedUserId = filter._id;
    savedIncrement = update.$inc[`cartData.${PRODUCT_ID}.M`];
    return { cartData: { [PRODUCT_ID]: { M: 4 } } };
  };
  Product.findOne = async () => ({
    _id: PRODUCT_ID,
    sizes: ["M"],
    stockBySize: { M: 8 },
    inStockBySize: { M: true },
    inStock: true,
  });

  try {
    const { state, response } = createResponse();

    await addToCart(
      {
        body: {
          itemId: PRODUCT_ID,
          size: "M",
          quantity: 3,
          userId: "user_clerk_other",
        },
        auth: () => ({ userId: CLERK_USER_ID }),
      },
      response,
    );

    assert.equal(state.payload.success, true);
    assert.equal(state.payload.addedQuantity, 3);
    assert.equal(updatedUserId, CLERK_USER_ID);
    assert.equal(savedIncrement, 3);
    assert.equal(state.payload.quantity, 4);
  } finally {
    User.findById = originalUserFind;
    User.findOneAndUpdate = originalUserUpdate;
    Product.findOne = originalProductFind;
  }
});

test("API xác nhận removeFromCart chỉ cập nhật Clerk user hiện tại", async () => {
  const originalUserFind = User.findById;
  const originalUserUpdate = User.updateOne;
  let updatedUserId;
  let unsetPath;

  User.findById = async () => ({ cartData: { [PRODUCT_ID]: { M: 2 } } });
  User.updateOne = async (filter, update) => {
    updatedUserId = filter._id;
    unsetPath = update.$unset[`cartData.${PRODUCT_ID}.M`];
    return {};
  };

  try {
    const { state, response } = createResponse();

    await updateCart(
      {
        body: {
          itemId: PRODUCT_ID,
          size: "M",
          quantity: 0,
          userId: "user_clerk_other",
        },
        auth: () => ({ userId: CLERK_USER_ID }),
      },
      response,
    );

    assert.equal(state.payload.success, true);
    assert.equal(state.payload.quantity, 0);
    assert.equal(updatedUserId, CLERK_USER_ID);
    assert.equal(unsetPath, "");
  } finally {
    User.findById = originalUserFind;
    User.updateOne = originalUserUpdate;
  }
});
