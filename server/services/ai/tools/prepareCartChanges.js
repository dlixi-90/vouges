import { getSizeImage } from "../../../utils/productImages.js";
import { randomUUID } from "node:crypto";
import { isObjectIdOrHexString } from "mongoose";
import Product from "../../../models/Product.js";
import User from "../../../models/User.js";
import {
  getPurchaseLimit,
  isSizeAvailable,
} from "../../../utils/productStock.js";

const MAX_UPDATE_QUANTITY = 99;
const BASE_ARGUMENT_KEYS = new Set(["productId", "size"]);
const UPDATE_ARGUMENT_KEYS = new Set(["productId", "size", "quantity"]);

export const prepareUpdateCartToolDefinition = {
  type: "function",
  function: {
    name: "prepareUpdateCart",
    description:
      "Chuẩn bị đề xuất đổi số lượng một sản phẩm đang có trong giỏ. Tool chỉ đọc và không thay đổi giỏ; người dùng phải xác nhận trên giao diện.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        productId: {
          type: "string",
          description: "MongoDB ObjectId của sản phẩm trong giỏ.",
        },
        size: {
          type: "string",
          description: "Size chính xác của dòng sản phẩm trong giỏ.",
          maxLength: 40,
        },
        quantity: {
          type: "integer",
          minimum: 1,
          maximum: MAX_UPDATE_QUANTITY,
          description: "Số lượng mới sau khi cập nhật.",
        },
      },
      required: ["productId", "size", "quantity"],
    },
  },
};

export const prepareRemoveFromCartToolDefinition = {
  type: "function",
  function: {
    name: "prepareRemoveFromCart",
    description:
      "Chuẩn bị đề xuất xóa một dòng sản phẩm khỏi giỏ. Tool chỉ đọc và không thay đổi giỏ; người dùng phải xác nhận trên giao diện.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        productId: {
          type: "string",
          description: "MongoDB ObjectId của sản phẩm trong giỏ.",
        },
        size: {
          type: "string",
          description: "Size chính xác của dòng sản phẩm cần xóa.",
          maxLength: 40,
        },
      },
      required: ["productId", "size"],
    },
  },
};

const requireAuthenticatedUserId = (context) => {
  const userId =
    typeof context?.userId === "string" ? context.userId.trim() : "";

  if (!userId) {
    throw new Error("Không xác định được người dùng đang đăng nhập");
  }

  return userId;
};

const validateBaseArguments = (argumentsValue, allowedKeys) => {
  if (
    !argumentsValue ||
    typeof argumentsValue !== "object" ||
    Array.isArray(argumentsValue)
  ) {
    throw new Error("Tham số thay đổi giỏ hàng không hợp lệ");
  }

  const unexpectedKey = Object.keys(argumentsValue).find(
    (key) => !allowedKeys.has(key),
  );

  if (unexpectedKey) {
    throw new Error(`Tham số ${unexpectedKey} không được hỗ trợ`);
  }

  const productId = String(argumentsValue.productId || "").trim();
  const size = String(argumentsValue.size || "").trim();

  if (!isObjectIdOrHexString(productId)) {
    throw new Error("productId không hợp lệ");
  }

  if (!size || size.length > 40) {
    throw new Error("size không hợp lệ");
  }

  return { productId, size };
};

const getCartItemData = async ({ userId, productId, size }) => {
  const [user, product] = await Promise.all([
    User.findById(userId).select("cartData").lean(),
    Product.findOne({ _id: productId })
      .select(
        "title price sizes stockBySize inventoryMode isPublished inStockBySize images sizeImages inStock isDeleted",
      )
      .lean(),
  ]);

  if (!user) {
    throw new Error("Không tìm thấy tài khoản đang đăng nhập");
  }

  const currentQuantity = Number(user.cartData?.[productId]?.[size] ?? 0);

  if (!Number.isInteger(currentQuantity) || currentQuantity <= 0) {
    throw new Error("Sản phẩm và size này không có trong giỏ hàng");
  }

  return { product, currentQuantity };
};

const createProductSummary = (product, productId, size) => ({
  id: productId,
  title: product?.title || "Sản phẩm không còn tồn tại",
  image: getSizeImage(product, size),
  url: product && !product.isDeleted ? `/collection/${productId}` : null,
});

const createMoney = (product, size, quantity) => {
  const unitAmount = Number(product?.price?.[size]);

  if (!Number.isFinite(unitAmount)) {
    return { unitPrice: null, lineTotal: null };
  }

  const currency = "VND";

  return {
    unitPrice: { amount: unitAmount, currency },
    lineTotal: { amount: unitAmount * quantity, currency },
  };
};

export const prepareUpdateCart = async (
  argumentsValue = {},
  context = {},
) => {
  const { productId, size } = validateBaseArguments(
    argumentsValue,
    UPDATE_ARGUMENT_KEYS,
  );
  const quantity = argumentsValue.quantity;

  if (
    !Number.isInteger(quantity) ||
    quantity < 1 ||
    quantity > MAX_UPDATE_QUANTITY
  ) {
    throw new Error(`quantity phải từ 1 đến ${MAX_UPDATE_QUANTITY}`);
  }

  const userId = requireAuthenticatedUserId(context);
  const { product, currentQuantity } = await getCartItemData({
    userId,
    productId,
    size,
  });

  if (!product || product.isDeleted) {
    throw new Error("Sản phẩm đã ngừng bán; hãy xóa sản phẩm khỏi giỏ");
  }

  if (!product.sizes?.includes(size) || !isSizeAvailable(product, size)) {
    throw new Error("Size sản phẩm này hiện không khả dụng");
  }

  if (quantity > getPurchaseLimit(product, size)) {
    throw new Error(`Không đủ tồn kho cho ${quantity} sản phẩm size ${size}`);
  }

  if (quantity === currentQuantity) {
    throw new Error("Số lượng mới đang bằng số lượng hiện tại");
  }

  return {
    pendingCartAction: {
      id: randomUUID(),
      type: "updateCart",
      productId,
      product: createProductSummary(product, productId, size),
      size,
      quantity,
      currentQuantity,
      ...createMoney(product, size, quantity),
    },
    message:
      "Đề xuất cập nhật hợp lệ nhưng giỏ hàng chưa thay đổi. Người dùng phải bấm xác nhận trên giao diện.",
  };
};

export const prepareRemoveFromCart = async (
  argumentsValue = {},
  context = {},
) => {
  const { productId, size } = validateBaseArguments(
    argumentsValue,
    BASE_ARGUMENT_KEYS,
  );
  const userId = requireAuthenticatedUserId(context);
  const { product, currentQuantity } = await getCartItemData({
    userId,
    productId,
    size,
  });

  return {
    pendingCartAction: {
      id: randomUUID(),
      type: "removeFromCart",
      productId,
      product: createProductSummary(product, productId, size),
      size,
      quantity: 0,
      currentQuantity,
      ...createMoney(product, size, currentQuantity),
    },
    message:
      "Đề xuất xóa hợp lệ nhưng giỏ hàng chưa thay đổi. Người dùng phải bấm xác nhận trên giao diện.",
  };
};
