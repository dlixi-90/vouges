import { getSizeImage } from "../../../utils/productImages.js";
import Order from "../../../models/Order.js";

const DEFAULT_RESULT_LIMIT = 5;
const MAX_RESULT_LIMIT = 10;
const ALLOWED_ARGUMENT_KEYS = new Set(["status", "limit"]);
const ALLOWED_STATUSES = [
  "Awaiting Payment",
  "Payment Review",
  "Order Placed",
  "Packing",
  "Shipping",
  "Delivery",
];

export const getMyOrdersToolDefinition = {
  type: "function",
  function: {
    name: "getMyOrders",
    description:
      "Đọc các đơn hàng của chính người dùng Clerk đang đăng nhập. Dùng khi người dùng hỏi về lịch sử mua hàng, đơn gần nhất, trạng thái giao hàng hoặc các sản phẩm đã đặt. User ID được hệ thống tự lấy từ phiên đăng nhập và không phải là tham số của tool.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        status: {
          type: "string",
          enum: ALLOWED_STATUSES,
          description: "Chỉ lọc theo trạng thái khi người dùng yêu cầu cụ thể.",
        },
        limit: {
          type: "integer",
          minimum: 1,
          maximum: MAX_RESULT_LIMIT,
          description: "Số đơn gần nhất cần lấy, mặc định là 5.",
        },
      },
    },
  },
};

const validateArguments = (argumentsValue) => {
  if (
    !argumentsValue ||
    typeof argumentsValue !== "object" ||
    Array.isArray(argumentsValue)
  ) {
    throw new Error("Tham số tra cứu đơn hàng không hợp lệ");
  }

  const unexpectedKey = Object.keys(argumentsValue).find(
    (key) => !ALLOWED_ARGUMENT_KEYS.has(key),
  );

  if (unexpectedKey) {
    throw new Error(`Tham số ${unexpectedKey} không được hỗ trợ`);
  }

  const status = argumentsValue.status || null;
  const limit = argumentsValue.limit ?? DEFAULT_RESULT_LIMIT;

  if (status !== null && !ALLOWED_STATUSES.includes(status)) {
    throw new Error("status không hợp lệ");
  }

  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_RESULT_LIMIT) {
    throw new Error(`limit phải từ 1 đến ${MAX_RESULT_LIMIT}`);
  }

  return { status, limit };
};

const requireAuthenticatedUserId = (context) => {
  const userId =
    typeof context?.userId === "string" ? context.userId.trim() : "";

  if (!userId) {
    throw new Error("Không xác định được người dùng đang đăng nhập");
  }

  return userId;
};

const normalizeOrderItem = (item) => {
  const product = item.product;
  const hasProduct = product && typeof product === "object";
  const productId = hasProduct ? String(product._id) : null;
  const title =
    item.title ||
    (hasProduct ? product.title : "Sản phẩm không còn tồn tại");

  return {
    productId,
    title,
    size: item.size,
    quantity: item.quantity,
    unitPrice: Number(item.unitPrice ?? 0),
    image: item.image || (hasProduct ? getSizeImage(product, item.size) : null),
    url: hasProduct && !product.isDeleted ? `/collection/${productId}` : null,
  };
};

export const getMyOrders = async (argumentsValue = {}, context = {}) => {
  const userId = requireAuthenticatedUserId(context);
  const { status, limit } = validateArguments(argumentsValue);
  const currency = "VND";
  const databaseFilter = {
    userId,
    $or: [{ paymentMethod: "COD" }, { isPaid: true }],
  };

  if (status) {
    databaseFilter.status = status;
  }

  const databaseOrders = await Order.find(databaseFilter)
    .select("items amount status paymentMethod isPaid createdAt paidAt")
    .populate({
      path: "items.product",
      select: "title images sizeImages isDeleted",
    })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  const orders = databaseOrders.map((order) => ({
    id: String(order._id),
    status: order.status,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.isPaid
      ? "paid"
      : order.paymentMethod === "COD"
        ? "pay_on_delivery"
        : "unpaid",
    total: {
      amount: Number(order.amount),
      currency,
    },
    createdAt: order.createdAt,
    paidAt: order.paidAt || null,
    items: (order.items || []).map(normalizeOrderItem),
  }));

  return {
    count: orders.length,
    orders,
    filter: {
      status,
      limit,
    },
    message:
      orders.length > 0
        ? "Các đơn hàng này thuộc người dùng Clerk đang đăng nhập."
        : "Không tìm thấy đơn hàng phù hợp của người dùng đang đăng nhập.",
  };
};
