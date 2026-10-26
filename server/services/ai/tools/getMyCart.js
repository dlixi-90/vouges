import { getSizeImage } from "../../../utils/productImages.js";
import { isObjectIdOrHexString } from "mongoose";
import Product from "../../../models/Product.js";
import User from "../../../models/User.js";
import {
  getPurchaseLimit,
  isSizeAvailable,
} from "../../../utils/productStock.js";

export const getMyCartToolDefinition = {
  type: "function",
  function: {
    name: "getMyCart",
    description:
      "Chỉ đọc giỏ hàng của người dùng Clerk đang đăng nhập. Dùng khi người dùng hỏi trong giỏ có gì, số lượng sản phẩm, size, giá tạm tính hoặc sản phẩm trong giỏ còn hàng hay không. User ID được hệ thống tự lấy từ phiên đăng nhập và không phải là tham số của tool.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {},
    },
  },
};

const validateArguments = (argumentsValue) => {
  if (
    !argumentsValue ||
    typeof argumentsValue !== "object" ||
    Array.isArray(argumentsValue)
  ) {
    throw new Error("Tham số đọc giỏ hàng không hợp lệ");
  }

  const unexpectedKey = Object.keys(argumentsValue)[0];

  if (unexpectedKey) {
    throw new Error(`Tham số ${unexpectedKey} không được hỗ trợ`);
  }
};

const requireAuthenticatedUserId = (context) => {
  const userId =
    typeof context?.userId === "string" ? context.userId.trim() : "";

  if (!userId) {
    throw new Error("Không xác định được người dùng đang đăng nhập");
  }

  return userId;
};

const getCartEntries = (cartData) => {
  const entries = [];

  for (const [productId, sizes] of Object.entries(cartData || {})) {
    if (!isObjectIdOrHexString(productId) || !sizes || typeof sizes !== "object") {
      continue;
    }

    for (const [size, savedQuantity] of Object.entries(sizes)) {
      const quantity = Number(savedQuantity);

      if (!size || !Number.isInteger(quantity) || quantity <= 0) continue;

      entries.push({ productId, size, quantity });
    }
  }

  return entries;
};

const createCartItem = (entry, product, currency) => {
  if (!product) {
    return {
      ...entry,
      title: "Sản phẩm không còn tồn tại",
      unitPrice: null,
      lineTotal: null,
      isAvailable: false,
      hasEnoughStock: false,
      image: null,
      url: null,
    };
  }

  const savedPrice = Number(product.price?.[entry.size]);
  const unitAmount = savedPrice;
  const hasValidPrice = Number.isFinite(unitAmount);
  const availableStock = getPurchaseLimit(product, entry.size);
  const isAvailable =
    !product.isDeleted &&
    product.sizes?.includes(entry.size) &&
    isSizeAvailable(product, entry.size);

  return {
    ...entry,
    title: product.title,
    unitPrice: hasValidPrice
      ? {
          amount: unitAmount,
          currency,
        }
      : null,
    lineTotal: hasValidPrice
      ? {
          amount: unitAmount * entry.quantity,
          currency,
        }
      : null,
    isAvailable,
    hasEnoughStock: isAvailable && entry.quantity <= availableStock,
    image: getSizeImage(product, entry.size),
    url: !product.isDeleted ? `/collection/${product._id}` : null,
  };
};

export const getMyCart = async (argumentsValue = {}, context = {}) => {
  validateArguments(argumentsValue);
  const userId = requireAuthenticatedUserId(context);
  const currency = "VND";
  const user = await User.findById(userId).select("cartData").lean();

  if (!user) {
    throw new Error("Không tìm thấy tài khoản đang đăng nhập");
  }

  const cartEntries = getCartEntries(user.cartData);
  const productIds = [...new Set(cartEntries.map((entry) => entry.productId))];
  const products =
    productIds.length > 0
      ? await Product.find({ _id: { $in: productIds } })
          .select(
            "title price sizes stockBySize inventoryMode isPublished inStockBySize images sizeImages inStock isDeleted",
          )
          .lean()
      : [];
  const productsById = new Map(
    products.map((product) => [String(product._id), product]),
  );
  const items = cartEntries.map((entry) =>
    createCartItem(entry, productsById.get(entry.productId), currency),
  );
  const subtotalAmount = items.reduce(
    (total, item) => total + (item.lineTotal?.amount || 0),
    0,
  );

  return {
    cart: {
      lineCount: items.length,
      itemCount: items.reduce((total, item) => total + item.quantity, 0),
      items,
      subtotal: {
        amount: subtotalAmount,
        currency,
      },
      hasUnavailableItems: items.some(
        (item) => !item.isAvailable || !item.hasEnoughStock,
      ),
    },
    message:
      items.length > 0
        ? "Giỏ hàng này thuộc người dùng Clerk đang đăng nhập. Giá trên là tạm tính, chưa gồm phí giao hàng."
        : "Giỏ hàng của người dùng đang đăng nhập hiện đang trống.",
  };
};
