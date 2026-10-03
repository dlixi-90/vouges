import Order from "../models/Order.js";
import Product from "../models/Product.js";
import User from "../models/User.js";
import transporter from "../config/nodemailer.js";
import crypto from "crypto";
import Address from "../models/Address.js";
import mongoose, { isObjectIdOrHexString } from "mongoose";
import { getSizeQuantity, isSizeAvailable } from "../utils/productStock.js";
import { getShippingCharge, SHIPPING_METHODS } from "../utils/orderPricing.js";
import { validateVoucher, calculateDiscount, reserveVoucher, releaseVoucher } from "../services/voucherService.js";
import { getCartAddedAt } from "../utils/cartOrder.js";
import { validateDeliveryPhone } from "../utils/deliveryPhone.js";
import { buildOrderConfirmationEmail } from "../emails/orderConfirmation.js";
import { normalizeOrderNote } from "../utils/orderNote.js";

// Global variables for payment
const orderStatuses = ["Order Placed", "Packing", "Shipping", "Delivery"];
const QR_RESERVATION_MINUTES = 5;
const QR_RESERVATION_MS = QR_RESERVATION_MINUTES * 60 * 1000;

const getQrExpirationDate = (order) => {
  const savedExpiration = new Date(order.paymentExpiresAt).getTime();
  const maximumExpiration =
    new Date(order.createdAt).getTime() + QR_RESERVATION_MS;

  return new Date(Math.min(savedExpiration, maximumExpiration));
};

const getQrExpirationFilter = () => ({
  $or: [
    { paymentExpiresAt: { $lte: new Date() } },
    { createdAt: { $lte: new Date(Date.now() - QR_RESERVATION_MS) } },
  ],
});

class OrderRequestError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

const sendOrderError = (res, error) => {
  const statusCode = error.statusCode || 500;

  if (statusCode === 500) {
    console.log(error);
  }

  return res.status(statusCode).json({
    success: false,
    message: statusCode === 500 ? "Unable to process order" : error.message,
  });
};

const runInTransaction = async (operation) => {
  const session = await mongoose.startSession();
  let result;

  try {
    await session.withTransaction(async () => {
      result = await operation(session);
    });

    return result;
  } finally {
    await session.endSession();
  }
};

const validateUserAddress = async (addressId, userId, session) => {
  if (!addressId) {
    throw new OrderRequestError("Please provide a delivery address");
  }

  if (!isObjectIdOrHexString(addressId)) {
    throw new OrderRequestError("Invalid delivery address");
  }

  const addressQuery = Address.findOne({
    _id: addressId,
    userId,
    deletedAt: null,
  });
  const address = session
    ? await addressQuery.session(session)
    : await addressQuery;

  if (!address) {
    throw new OrderRequestError("Delivery address not found", 404);
  }

  const phone = validateDeliveryPhone(address.phone);
  if (!phone.valid) throw new OrderRequestError(phone.error);

  return address;
};

const normalizeOrderItems = (items) => {
  if (!Array.isArray(items) || items.length === 0) {
    throw new OrderRequestError("Please add product first");
  }

  const groupedItems = new Map();

  for (const item of items) {
    const productId = String(item?.product || "");
    const size = typeof item?.size === "string" ? item.size.trim() : "";
    const quantity = Number(item?.quantity);

    if (!isObjectIdOrHexString(productId)) {
      throw new OrderRequestError("Invalid product ID");
    }

    if (!size) {
      throw new OrderRequestError("Invalid product size");
    }

    if (!Number.isSafeInteger(quantity) || quantity < 1) {
      throw new OrderRequestError("Quantity must be a positive integer");
    }

    const key = `${productId}:${size}`;
    const existingItem = groupedItems.get(key);

    if (existingItem) {
      existingItem.quantity += quantity;

      if (!Number.isSafeInteger(existingItem.quantity)) {
        throw new OrderRequestError("Invalid product quantity");
      }
    } else {
      groupedItems.set(key, {
        product: productId,
        size,
        quantity,
      });
    }
  }

  return [...groupedItems.values()];
};

const validateOrderItems = async (items, session) => {
  const normalizedItems = normalizeOrderItems(items);
  const productIds = [
    ...new Set(normalizedItems.map((item) => item.product)),
  ];

  const productsQuery = Product.find({
    _id: { $in: productIds },
    isDeleted: { $ne: true },
  });
  const products = session
    ? await productsQuery.session(session)
    : await productsQuery;

  const productsById = new Map(
    products.map((product) => [String(product._id), product]),
  );

  let subtotal = 0;

  for (const item of normalizedItems) {
    const product = productsById.get(item.product);

    if (!product) {
      throw new OrderRequestError("Product not found", 404);
    }

    if (!product.sizes.includes(item.size)) {
      throw new OrderRequestError(
        `Invalid size ${item.size} for ${product.title}`,
      );
    }

    if (!isSizeAvailable(product, item.size)) {
      throw new OrderRequestError(
        `${product.title} - ${item.size} is out of stock`,
      );
    }

    const stockQuantity = getSizeQuantity(product, item.size);

    if (item.quantity > stockQuantity) {
      throw new OrderRequestError(
        `Only ${stockQuantity} items are available for ${product.title} - ${item.size}`,
      );
    }

    const unitPrice = Number(product.price?.[item.size]);

    if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
      throw new OrderRequestError(
        `Invalid price for ${product.title} - ${item.size}`,
      );
    }

    subtotal += unitPrice * item.quantity;

    if (!Number.isFinite(subtotal) || subtotal > Number.MAX_SAFE_INTEGER / 1000) {
      throw new OrderRequestError("Order total is too large");
    }
  }

  return {
    items: normalizedItems,
    subtotal,
    productsById,
  };
};

const createOrderItemSnapshots = (validatedOrder) =>
  validatedOrder.items.map((item) => {
    const product = validatedOrder.productsById.get(item.product);

    return {
      ...item,
      title: product.title,
      image: product.images?.[0] || undefined,
      unitPrice: Number(product.price?.[item.size]),
    };
  });

const priceOrder = async (subtotal, body, userId, session) => {
  const shippingMethod = body.shippingMethod ?? "standard";
  const shipping = getShippingCharge(subtotal, shippingMethod);
  const voucher = await validateVoucher(body.voucherCode, userId, subtotal, session);
  const discount = voucher ? calculateDiscount(voucher, subtotal) : 0;
  const amount = Math.round((subtotal - discount + shipping) * 1000) / 1000;
  return { subtotal, shippingMethod, shipping, discount, amount,
    voucherId: voucher?._id || null, voucherCode: voucher?.code || "", voucher };
};

const checkQuotedAmount = (body, pricing) => {
  if (body.expectedAmount !== undefined &&
      (typeof body.expectedAmount !== "number" || !Number.isFinite(body.expectedAmount) ||
       Math.round(body.expectedAmount * 1000) !== Math.round(pricing.amount * 1000)))
    throw new OrderRequestError("Giá trị đơn hàng đã thay đổi. Vui lòng kiểm tra lại tổng tiền.", 409);
};

export const quoteOrder = async (req, res) => {
  try {
    const validated = await validateOrderItems(req.body.items);
    const { voucher: _voucher, ...pricing } = await priceOrder(validated.subtotal, req.body, req.user._id);
    return res.json({ success: true, pricing, shippingMethods: SHIPPING_METHODS });
  } catch (error) { return sendOrderError(res, error); }
};

const syncProductStockStatus = (product, restoredSizes = new Set()) => {
  const inStockBySize = {};

  for (const size of product.sizes || []) {
    const quantity = getSizeQuantity(product, size);
    const savedStatus = product.inStockBySize?.[size];

    inStockBySize[size] =
      !product.isDeleted &&
      quantity > 0 &&
      (restoredSizes.has(size) ||
        (typeof savedStatus === "boolean" ? savedStatus : true));
  }

  product.inStockBySize = inStockBySize;
  const hasEnabledSize = Object.values(inStockBySize).some(Boolean);
  product.inStock =
    !product.isDeleted &&
    hasEnabledSize &&
    (restoredSizes.size > 0 || Boolean(product.inStock));
  product.markModified("stockBySize");
  product.markModified("inStockBySize");
};

const reserveOrderStock = async (validatedOrder, session) => {
  const changedProducts = new Map();

  for (const item of validatedOrder.items) {
    const product = validatedOrder.productsById.get(item.product);
    const currentQuantity = getSizeQuantity(product, item.size);

    product.stockBySize = {
      ...(product.stockBySize || {}),
      [item.size]: currentQuantity - item.quantity,
    };
    changedProducts.set(item.product, product);
  }

  for (const product of changedProducts.values()) {
    syncProductStockStatus(product);
    await product.save({ session });
  }
};

const restoreOrderStock = async (order, session) => {
  const productIds = [...new Set(order.items.map((item) => item.product))];
  const products = await Product.find({
    _id: { $in: productIds },
  }).session(session);
  const productsById = new Map(
    products.map((product) => [String(product._id), product]),
  );
  const restoredSizesByProduct = new Map();

  for (const item of order.items) {
    const productId = String(item.product);
    const product = productsById.get(productId);

    if (!product || !product.sizes.includes(item.size)) continue;

    product.stockBySize = {
      ...(product.stockBySize || {}),
      [item.size]: getSizeQuantity(product, item.size) + item.quantity,
    };

    const restoredSizes = restoredSizesByProduct.get(productId) || new Set();
    restoredSizes.add(item.size);
    restoredSizesByProduct.set(productId, restoredSizes);
  }

  for (const [productId, product] of productsById) {
    const restoredSizes = restoredSizesByProduct.get(productId);

    if (!restoredSizes) continue;

    syncProductStockStatus(product, restoredSizes);
    await product.save({ session });
  }
  return products.map((product) => ({
    _id: String(product._id),
    stockBySize: product.stockBySize,
    inStockBySize: product.inStockBySize,
    inStock: product.inStock,
  }));
};

const removeOrderItemsFromCart = async (userId, items, session) => {
  const user = await User.findById(userId).session(session);

  if (!user) {
    throw new OrderRequestError("User not found", 404);
  }

  const cartData = { ...(user.cartData || {}) };
  const cartAddedAt = getCartAddedAt(cartData, user.cartAddedAt);

  for (const item of items) {
    const productId = String(item.product);
    const productCart = { ...(cartData[productId] || {}) };
    const currentQuantity = Number(productCart[item.size] ?? 0);
    const remainingQuantity = currentQuantity - item.quantity;

    if (remainingQuantity > 0) {
      productCart[item.size] = remainingQuantity;
    } else {
      delete productCart[item.size];
    }

    if (Object.keys(productCart).length > 0) {
      cartData[productId] = productCart;
    } else {
      delete cartData[productId];
    }
  }

  user.cartData = cartData;
  user.cartAddedAt = getCartAddedAt(cartData, cartAddedAt);
  user.markModified("cartData");
  user.markModified("cartAddedAt");
  await user.save({ session });
};

const expireQrOrder = async (orderId) => {
  const expirationFilter = {
    _id: orderId,
    paymentMethod: "QR",
    isPaid: false,
    status: "Awaiting Payment",
    ...getQrExpirationFilter(),
  };
  const isExpired = await Order.exists(expirationFilter);

  if (!isExpired) return false;

  return runInTransaction(async (session) => {
    const order = await Order.findOne(expirationFilter).session(session);

    if (!order) return false;

    await restoreOrderStock(order, session);
    await releaseVoucher(order, session);
    order.status = "Payment Expired";
    await order.save({ session });

    return true;
  });
};

const releaseExpiredQrReservations = async () => {
  const expirationFilter = {
    paymentMethod: "QR",
    isPaid: false,
    status: "Awaiting Payment",
    ...getQrExpirationFilter(),
  };
  const hasExpiredOrder = await Order.exists(expirationFilter);

  if (!hasExpiredOrder) return 0;

  return runInTransaction(async (session) => {
    const expiredOrders = await Order.find(expirationFilter)
      .limit(50)
      .session(session);

    for (const order of expiredOrders) {
      await restoreOrderStock(order, session);
      await releaseVoucher(order, session);
      order.status = "Payment Expired";
      await order.save({ session });
    }

    return expiredOrders.length;
  });
};

// Place Order using COD [POST '/cod']
export const placeOrderCOD = async (req, res) => {
  try {
    const { items, address } = req.body;
    const note = normalizeOrderNote(req.body.note);
    const { userId } = req.auth();
    await releaseExpiredQrReservations();

    const { orderId } = await runInTransaction(async (session) => {
      const selectedAddress = await validateUserAddress(
        address,
        userId,
        session,
      );
      const validatedOrder = await validateOrderItems(items, session);
      const { voucher, ...pricing } = await priceOrder(validatedOrder.subtotal, req.body, userId, session);
      checkQuotedAmount(req.body, pricing);
      const orderItems = createOrderItemSnapshots(validatedOrder);

      await reserveOrderStock(validatedOrder, session);

      const [order] = await Order.create(
        [
          {
            userId,
            items: orderItems,
            ...pricing,
            address: selectedAddress._id,
            paymentMethod: "COD",
            note,
          },
        ],
        { session },
      );

      await reserveVoucher(voucher, userId, order._id, session);

      await removeOrderItemsFromCart(
        userId,
        validatedOrder.items,
        session,
      );

      return { orderId: order._id };
    });

    const populatedOrder = await Order.findById(orderId).populate(
      "items.product address",
    );
    const user = await User.findById(userId);

    try {
      if (user.email) await transporter.sendMail({
        from: { name: "Velours", address: process.env.SMTP_SENDER_EMAIL },
        to: user.email,
        ...buildOrderConfirmationEmail(populatedOrder),
      });
    } catch (emailError) {
      console.log("Could not send COD confirmation email:", emailError.message);
    }

    return res.status(201).json({
      success: true,
      message: "Order Placed",
      order: populatedOrder,
    });
  } catch (error) {
    return sendOrderError(res, error);
  }
};

const createPaymentCode = () => {
  return `DH${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
};

const createQrUrl = ({ paymentCode, qrAmount }) => {
  const params = new URLSearchParams({
    bank: process.env.SEPAY_BANK_CODE,

    acc: process.env.SEPAY_ACCOUNT_NUMBER,

    amount: String(qrAmount),

    des: paymentCode,

    template: "compact",
    showinfo: "true",
    fullacc: "true",
  });

  if (process.env.SEPAY_ACCOUNT_NAME) {
    params.set("holder", process.env.SEPAY_ACCOUNT_NAME);
  }

  return `https://vietqr.app/img?${params.toString()}`;
};

const serializeQrOrder = (order) => ({
  ...order.toObject(),
  paymentExpiresAt: getQrExpirationDate(order),
  qrUrl: createQrUrl(order),
});

// Place order using Qr [POST '/qr']
export const placeOrderQr = async (req, res) => {
  try {
    const { items, address } = req.body;
    const note = normalizeOrderNote(req.body.note);
    const { userId } = req.auth();
    await releaseExpiredQrReservations();

    const pendingOrder = await Order.findOne({
      userId,
      paymentMethod: "QR",
      isPaid: false,
      status: "Awaiting Payment",
      paymentExpiresAt: { $gt: new Date() },
      createdAt: { $gt: new Date(Date.now() - QR_RESERVATION_MS) },
    }).sort({ createdAt: -1 });

    if (pendingOrder) {
      return res.json({
        success: true,
        message: "Pending QR payment restored",
        order: serializeQrOrder(pendingOrder),
      });
    }

    const paymentCode = createPaymentCode();
    const paymentExpiresAt = new Date(
      Date.now() + QR_RESERVATION_MS,
    );

    const order = await runInTransaction(async (session) => {
      const selectedAddress = await validateUserAddress(
        address,
        userId,
        session,
      );
      const validatedOrder = await validateOrderItems(items, session);
      const { voucher, ...pricing } = await priceOrder(validatedOrder.subtotal, req.body, userId, session);
      checkQuotedAmount(req.body, pricing);
      if (pricing.amount <= 0) throw new OrderRequestError("Đơn hàng 0đ không cần chuyển khoản. Vui lòng chọn COD để đặt đơn.");
      const orderItems = createOrderItemSnapshots(validatedOrder);

      // Giá trong project đang biểu diễn 30 = 30.000 VNĐ.
      const qrAmount = Math.round(pricing.amount * 1000);

      await reserveOrderStock(validatedOrder, session);

      const [createdOrder] = await Order.create(
        [
          {
            userId,
            items: orderItems,
            ...pricing,
            address: selectedAddress._id,
            paymentMethod: "QR",
            note,
            paymentCode,
            qrAmount,
            paymentExpiresAt,
            status: "Awaiting Payment",
            isPaid: false,
          },
        ],
        { session },
      );

      await reserveVoucher(voucher, userId, createdOrder._id, session);
      return createdOrder.toObject();
    });

    const qrUrl = createQrUrl({
      paymentCode,
      qrAmount: order.qrAmount,
    });

    return res.status(201).json({
      success: true,
      message: "QR order created",
      order: {
        ...order,
        qrUrl,
      },
    });
  } catch (error) {
    return sendOrderError(res, error);
  }
};

export const getOrderStatus = async (req, res) => {
  try {
    const { userId } = req.auth();

    if (!isObjectIdOrHexString(req.params.orderId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID",
      });
    }

    await expireQrOrder(req.params.orderId);
    const order = await Order.findById(req.params.orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (order.userId !== userId && req.user?.role !== "owner") {
      return res.status(403).json({
        success: false,
        message: "Not Authorized",
      });
    }

    const serializedOrder =
      order.paymentMethod === "QR" && order.status === "Awaiting Payment"
        ? {
            ...order.toObject(),
            paymentExpiresAt: getQrExpirationDate(order),
          }
        : order;

    return res.json({
      success: true,
      order: serializedOrder,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Unable to load order status",
    });
  }
};

export const getPendingQrOrder = async (req, res) => {
  try {
    const { userId } = req.auth();
    await releaseExpiredQrReservations();

    const order = await Order.findOne({
      userId,
      paymentMethod: "QR",
      isPaid: false,
      status: "Awaiting Payment",
      paymentExpiresAt: { $gt: new Date() },
      createdAt: { $gt: new Date(Date.now() - QR_RESERVATION_MS) },
    }).sort({ createdAt: -1 });

    return res.json({
      success: true,
      order: order
        ? serializeQrOrder(order)
        : null,
    });
  } catch (error) {
    return sendOrderError(res, error);
  }
};

export const cancelQrOrder = async (req, res) => {
  try {
    const { userId } = req.auth();
    const { orderId } = req.params;

    if (!isObjectIdOrHexString(orderId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID",
      });
    }

    const result = await runInTransaction(async (session) => {
      const order = await Order.findOne({
        _id: orderId,
        userId,
      }).session(session);

      if (!order) {
        throw new OrderRequestError("Order not found", 404);
      }

      if (order.paymentMethod === "QR" && !order.isPaid &&
          ["Payment Cancelled", "Payment Expired"].includes(order.status)) {
        return { cancelled: true, status: order.status, stockUpdates: [] };
      }

      if (
        order.paymentMethod !== "QR" ||
        order.isPaid ||
        order.status !== "Awaiting Payment"
      ) {
        return { cancelled: false, status: order.status };
      }

      const stockUpdates = await restoreOrderStock(order, session);
      await releaseVoucher(order, session);
      order.status = "Payment Cancelled";
      order.paymentExpiresAt = new Date();
      await order.save({ session });

      return { cancelled: true, status: order.status, stockUpdates };
    });

    if (!result.cancelled) {
      return res.status(409).json({
        success: false,
        message:
          result.status === "Order Placed"
            ? "Payment has already been confirmed"
            : "QR payment can no longer be cancelled",
      });
    }

    return res.json({
      success: true,
      message: "QR payment cancelled",
      stockUpdates: result.stockUpdates,
    });
  } catch (error) {
    return sendOrderError(res, error);
  }
};

export const sepayWebhook = async (req, res) => {
  try {
    const authorization = req.get("authorization") || "";
    const apiKey = authorization.replace(/^Apikey\s+/i, "").trim();
    const configuredApiKey = process.env.SEPAY_WEBHOOK_API_KEY || "";
    const receivedKey = Buffer.from(apiKey);
    const expectedKey = Buffer.from(configuredApiKey);

    if (
      !configuredApiKey ||
      receivedKey.length !== expectedKey.length ||
      !crypto.timingSafeEqual(receivedKey, expectedKey)
    ) {
      return res.status(401).json({
        success: false,
        message: "Invalid webhook API key",
      });
    }

    const { id, transferType, transferAmount, content, code } = req.body;

    // Chỉ xử lý tiền chuyển vào
    if (String(transferType).toLowerCase() !== "in") {
      return res.json({ success: true });
    }

    const transactionId = String(id ?? "").trim();
    const receivedAmount = Number(transferAmount);

    if (
      !transactionId ||
      !Number.isFinite(receivedAmount) ||
      receivedAmount <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment transaction",
      });
    }

    // SePay có thể gửi lại cùng một giao dịch
    const processedOrder = await Order.findOne({
      transactionId,
    });

    if (processedOrder) {
      return res.json({ success: true });
    }

    const paymentText = `${code || ""} ${content || ""}`.toUpperCase();
    const paymentCode = paymentText.match(/DH[A-F0-9]{8}/)?.[0];

    if (!paymentCode) {
      return res.json({ success: true });
    }

    const paymentResult = await runInTransaction(async (session) => {
      const order = await Order.findOne({ paymentCode }).session(session);

      if (!order || order.isPaid) {
        return "ignored";
      }

      const expectedAmount = Number(order.qrAmount);

      if (
        !Number.isFinite(expectedAmount) ||
        expectedAmount <= 0 ||
        receivedAmount < expectedAmount
      ) {
        return "insufficient";
      }

      if (!["Awaiting Payment", "Payment Expired"].includes(order.status)) {
        return "ignored";
      }

      order.isPaid = true;
      order.transactionId = transactionId;
      order.paidAt = new Date();

      if (order.status === "Payment Expired") {
        // Its voucher reservation has been released and may have been reused.
        // Record the transfer for owner review without spending that voucher twice.
        if (order.voucherId) {
          order.status = "Payment Review";
          await order.save({ session });
          return "review";
        }
        try {
          const validatedOrder = await validateOrderItems(order.items, session);

          await reserveOrderStock(validatedOrder, session);
          order.status = "Order Placed";
          await order.save({ session });
          await removeOrderItemsFromCart(order.userId, order.items, session);

          return "paid";
        } catch (error) {
          if (!(error instanceof OrderRequestError)) throw error;

          // Stock was sold after this reservation expired. Record the received
          // payment so the owner can fulfil it manually or issue a refund.
          order.status = "Payment Review";
          await order.save({ session });

          return "review";
        }
      }

      order.status = "Order Placed";

      await order.save({ session });
      await removeOrderItemsFromCart(order.userId, order.items, session);

      return "paid";
    });

    if (paymentResult === "review") {
      console.log(`Late QR payment requires review: ${paymentCode}`);
    }

    return res.json({ success: true });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      success: false,
      message: "Unable to process payment webhook",
    });
  }
};

// All Orders data for the user [POST '/userorders']
export const userOrders = async (req, res) => {
  try {
    const { userId } = req.auth();
    const orders = await Order.find({
      userId,
      $or: [{ paymentMethod: "COD" }, { isPaid: true }],
    })
      .populate("items.product address")
      .sort({ createdAt: -1 });

    return res.json({ success: true, orders });
  } catch (error) {
    console.log(error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to load orders",
    });
  }
};

// All Orders data for Admin [POST '/']
export const allOrders = async (req, res) => {
  try {
    const orders = await Order.find({
      $or: [{ paymentMethod: "COD" }, { isPaid: true }],
    })
      .populate("items.product address")
      .sort({ createdAt: -1 });

    const totalOrders = orders.length;
    const totalRevenue = orders.reduce(
      (acc, o) => acc + (o.isPaid ? o.amount : 0),
      0,
    );
    return res.json({
      success: true,
      dashboardData: { totalOrders, totalRevenue, orders },
    });
  } catch (error) {
    console.log(error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to load orders",
    });
  }
};

// Update Order status for Admin [POST '/status']
export const updateStatus = async (req, res) => {
  try {
    const { orderId, status } = req.body;

    if (!isObjectIdOrHexString(orderId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID",
      });
    }

    if (!orderStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order status",
      });
    }

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    const currentStep = orderStatuses.indexOf(order.status);
    const nextStep = orderStatuses.indexOf(status);

    if (currentStep < 0 || nextStep < currentStep) {
      return res.status(409).json({
        success: false,
        message: "Order status can only move forward",
      });
    }

    if (nextStep === currentStep) {
      return res.json({ success: true, message: "Order status unchanged", order });
    }

    const update = { status };

    if (
      order.paymentMethod === "COD" &&
      status === "Delivery" &&
      !order.isPaid
    ) {
      update.isPaid = true;
      update.paidAt = new Date();
    }

    // Match the snapshot so a concurrent request cannot move the order backward
    // or overwrite a payment recorded since the read above.
    const updatedOrder = await Order.findOneAndUpdate(
      { _id: orderId, status: order.status, isPaid: order.isPaid },
      { $set: update },
      { new: true, runValidators: true },
    );

    if (!updatedOrder) {
      return res.status(409).json({
        success: false,
        message: "Order changed. Refresh and try again",
      });
    }

    return res.json({
      success: true,
      message: "Order status updated",
      order: updatedOrder,
    });
  } catch (error) {
    console.log(error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to update order status",
    });
  }
};
