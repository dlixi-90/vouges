import { getSizeImage } from "../../../utils/productImages.js";
import { randomUUID } from "node:crypto";
import { isObjectIdOrHexString } from "mongoose";
import Product from "../../../models/Product.js";
import User from "../../../models/User.js";
import {
  getPurchaseLimit,
  isSizeAvailable,
} from "../../../utils/productStock.js";

import { MAX_CART_ADD_QUANTITY as MAX_ADD_QUANTITY } from "../../../../client/src/utils/purchaseQuantity.js";
const ALLOWED_ARGUMENT_KEYS = new Set(["productId", "size", "quantity"]);

export const prepareAddToCartToolDefinition = {
  type: "function",
  function: {
    name: "prepareAddToCart",
    description:
      "Chuẩn bị đề xuất thêm sản phẩm vào giỏ để người dùng xác nhận trên giao diện. Tool này chỉ đọc và kiểm tra dữ liệu, tuyệt đối không thay đổi giỏ hàng. Chỉ gọi khi đã biết chính xác productId và size.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        productId: {
          type: "string",
          description:
            "MongoDB ObjectId của sản phẩm, lấy từ searchProducts hoặc getProductDetails.",
        },
        size: {
          type: "string",
          description: "Size chính xác mà người dùng muốn thêm.",
          maxLength: 40,
        },
        quantity: {
          type: "integer",
          minimum: 1,
          maximum: MAX_ADD_QUANTITY,
          description: "Số lượng muốn thêm, mặc định là 1.",
        },
      },
      required: ["productId", "size"],
    },
  },
};

const validateArguments = (argumentsValue) => {
  if (
    !argumentsValue ||
    typeof argumentsValue !== "object" ||
    Array.isArray(argumentsValue)
  ) {
    throw new Error("Tham số thêm vào giỏ không hợp lệ");
  }

  const unexpectedKey = Object.keys(argumentsValue).find(
    (key) => !ALLOWED_ARGUMENT_KEYS.has(key),
  );

  if (unexpectedKey) {
    throw new Error(`Tham số ${unexpectedKey} không được hỗ trợ`);
  }

  const productId = String(argumentsValue.productId || "").trim();
  const size = String(argumentsValue.size || "").trim();
  const quantity = argumentsValue.quantity ?? 1;

  if (!isObjectIdOrHexString(productId)) {
    throw new Error("productId không hợp lệ");
  }

  if (!size || size.length > 40) {
    throw new Error("size không hợp lệ");
  }

  if (
    !Number.isInteger(quantity) ||
    quantity < 1 ||
    quantity > MAX_ADD_QUANTITY
  ) {
    throw new Error(`quantity phải từ 1 đến ${MAX_ADD_QUANTITY}`);
  }

  return { productId, size, quantity };
};

const requireAuthenticatedUserId = (context) => {
  const userId =
    typeof context?.userId === "string" ? context.userId.trim() : "";

  if (!userId) {
    throw new Error("Không xác định được người dùng đang đăng nhập");
  }

  return userId;
};

export const prepareAddToCart = async (
  argumentsValue = {},
  context = {},
) => {
  const { productId, size, quantity } = validateArguments(argumentsValue);
  const userId = requireAuthenticatedUserId(context);
  const [user, product] = await Promise.all([
    User.findById(userId).select("cartData").lean(),
    Product.findOne({
      _id: productId,
      isDeleted: { $ne: true },
    })
      .select(
        "title price sizes stockBySize inventoryMode isPublished inStockBySize images sizeImages inStock isDeleted",
      )
      .lean(),
  ]);

  if (!user) {
    throw new Error("Không tìm thấy tài khoản đang đăng nhập");
  }

  if (!product) {
    throw new Error("Không tìm thấy sản phẩm hoặc sản phẩm đã ngừng bán");
  }

  if (!product.sizes?.includes(size)) {
    throw new Error("Sản phẩm không có size này");
  }

  if (!isSizeAvailable(product, size)) {
    throw new Error("Size sản phẩm này hiện đã hết hàng");
  }

  const unitAmount = Number(product.price?.[size]);

  if (!Number.isFinite(unitAmount)) {
    throw new Error("Giá sản phẩm không hợp lệ");
  }

  const currentQuantity = Number(user.cartData?.[productId]?.[size] ?? 0);
  const resultingQuantity = currentQuantity + quantity;
  const stockQuantity = getPurchaseLimit(product, size);

  if (resultingQuantity > stockQuantity) {
    throw new Error(
      `Không đủ tồn kho để thêm ${quantity} sản phẩm size ${size}`,
    );
  }

  const currency = "VND";

  return {
    pendingCartAction: {
      id: randomUUID(),
      type: "addToCart",
      productId,
      product: {
        id: String(product._id),
        title: product.title,
        image: getSizeImage(product, size),
        url: `/collection/${product._id}`,
      },
      size,
      quantity,
      currentQuantity,
      resultingQuantity,
      unitPrice: {
        amount: unitAmount,
        currency,
      },
      lineTotal: {
        amount: unitAmount * quantity,
        currency,
      },
    },
    message:
      "Đề xuất hợp lệ nhưng giỏ hàng chưa thay đổi. Người dùng phải bấm xác nhận trên giao diện.",
  };
};
