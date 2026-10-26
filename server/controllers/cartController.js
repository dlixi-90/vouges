import { isObjectIdOrHexString } from "mongoose";
import User from "../models/User.js";
import Product from "../models/Product.js";
import { getPurchaseLimit, isSizeAvailable } from "../utils/productStock.js";
import { getCartAddedAt, getMissingCartAddedAtUpdates, getNextCartAddedAt } from "../utils/cartOrder.js";

const MAX_ADD_QUANTITY = 10;
const isSafePathSegment = (value) =>
  typeof value === "string" &&
  Boolean(value.trim()) &&
  !["__proto__", "constructor", "prototype"].includes(value) &&
  !value.includes(".") &&
  !value.startsWith("$");

const findAvailableProduct = async (itemId) => {
  return Product.findOne({
    _id: itemId,
    isDeleted: { $ne: true },
  }, "sizes stockBySize inventoryMode isPublished inStockBySize inStock");
};

const validateProductSize = (product, size) => {
  if (!product.sizes.includes(size)) {
    return "Dung tích sản phẩm không hợp lệ";
  }

  if (!isSizeAvailable(product, size)) {
    return "Sản phẩm có dung tích này đã hết hàng";
  }

  return null;
};

// Adding to Cart [POST '/add']
export const addToCart = async (req, res) => {
  try {
    const { itemId, size } = req.body;
    const quantity =
      req.body.quantity === undefined ? 1 : Number(req.body.quantity);
    const { userId } = req.auth();

    if (!isObjectIdOrHexString(itemId)) {
      return res.status(400).json({
        success: false,
        message: "Mã sản phẩm không hợp lệ",
      });
    }

    if (!isSafePathSegment(size)) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng chọn dung tích sản phẩm",
      });
    }

    if (
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > MAX_ADD_QUANTITY
    ) {
      return res.status(400).json({
        success: false,
        message: `Số lượng phải từ 1 đến ${MAX_ADD_QUANTITY}`,
      });
    }

    const [userData, product] = await Promise.all([
      req.user ?? User.findById(userId),
      findAvailableProduct(itemId),
    ]);

    if (!userData) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy người dùng",
      });
    }

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy sản phẩm",
      });
    }

    const sizeError = validateProductSize(product, size);

    if (sizeError) {
      return res.status(400).json({
        success: false,
        message: sizeError,
      });
    }

    const stockQuantity = getPurchaseLimit(product, size);

    if (quantity > stockQuantity) {
      return res.status(400).json({
        success: false,
        message: `Chỉ còn ${stockQuantity} sản phẩm có dung tích ${size}`,
      });
    }

    const cartItemPath = `cartData.${itemId}.${size}`;
    const timestamps = getCartAddedAt(userData.cartData, userData.cartAddedAt);
    const addedAt = Number(userData.cartData?.[itemId]?.[size] ?? 0) > 0
      ? timestamps[itemId][size]
      : getNextCartAddedAt(timestamps);
    const updatedUser = await User.findOneAndUpdate(
      {
        _id: userId,
        $or: [
          { [cartItemPath]: { $exists: false } },
          { [cartItemPath]: { $lte: stockQuantity - quantity } },
        ],
      },
      {
        $inc: { [cartItemPath]: quantity },
        $set: {
          ...getMissingCartAddedAtUpdates(userData.cartData, userData.cartAddedAt),
          [`cartAddedAt.${itemId}.${size}`]: addedAt,
        },
      },
      { new: true },
    );

    if (!updatedUser) {
      return res.status(400).json({
        success: false,
        message: `Chỉ còn ${stockQuantity} sản phẩm có dung tích ${size}`,
      });
    }

    const nextQuantity = Number(updatedUser.cartData?.[itemId]?.[size] ?? 0);

    return res.json({
      success: true,
      message: "Đã thêm vào giỏ hàng",
      addedQuantity: quantity,
      quantity: nextQuantity,
      addedAt,
    });
  } catch (error) {
    console.log(error.message);

    return res.status(500).json({
      success: false,
      message: "Không thể thêm sản phẩm vào giỏ hàng",
    });
  }
};

// Move a whole cart line in one write, merging an existing destination size.
export const changeCartSize = async (req, res) => {
  try {
    const { itemId, fromSize, toSize, fromQuantity, toQuantity } = req.body;
    const { userId } = req.auth();
    if (!isObjectIdOrHexString(itemId) ||
        !isSafePathSegment(fromSize) || !isSafePathSegment(toSize) ||
        fromSize === toSize ||
        !Number.isSafeInteger(fromQuantity) || fromQuantity < 1 ||
        !Number.isSafeInteger(toQuantity) || toQuantity < 0) {
      return res.status(400).json({ success: false, message: "Thay đổi dung tích không hợp lệ" });
    }

    const product = await findAvailableProduct(itemId);
    if (!product) {
      return res.status(404).json({ success: false, message: "Không tìm thấy sản phẩm" });
    }
    const sizeError = validateProductSize(product, toSize);
    if (sizeError) {
      return res.status(400).json({ success: false, message: sizeError });
    }
    const quantity = fromQuantity + toQuantity;
    const stock = getPurchaseLimit(product, toSize);
    if (!Number.isSafeInteger(quantity) || quantity > stock) {
      return res.status(400).json({
        success: false,
        message: `Chỉ còn ${stock} sản phẩm có dung tích ${toSize}`,
      });
    }

    const fromPath = `cartData.${itemId}.${fromSize}`;
    const toPath = `cartData.${itemId}.${toSize}`;
    const userData = req.user;
    const timestamps = getCartAddedAt(userData.cartData, userData.cartAddedAt);
    const addedAt = timestamps[itemId]?.[fromSize];
    if (!addedAt) {
      return res.status(409).json({ success: false, message: "Giỏ hàng của bạn đã thay đổi. Vui lòng tải lại." });
    }
    const timestampUpdates = getMissingCartAddedAtUpdates(userData.cartData, userData.cartAddedAt);
    delete timestampUpdates[`cartAddedAt.${itemId}.${fromSize}`];
    const updatedUser = await User.findOneAndUpdate(
      {
        _id: userId,
        [fromPath]: fromQuantity,
        ...(toQuantity === 0
          ? { $or: [{ [toPath]: { $exists: false } }, { [toPath]: 0 }] }
          : { [toPath]: toQuantity }),
      },
      {
        $unset: { [fromPath]: "", [`cartAddedAt.${itemId}.${fromSize}`]: "" },
        $set: { ...timestampUpdates, [toPath]: quantity, [`cartAddedAt.${itemId}.${toSize}`]: addedAt },
      },
      { new: true },
    );
    if (!updatedUser) {
      return res.status(409).json({
        success: false,
        message: "Giỏ hàng của bạn đã thay đổi. Vui lòng thử lại với giỏ hàng đã cập nhật.",
      });
    }
    return res.json({ success: true, quantity, addedAt, message: "Đã cập nhật dung tích" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Không thể thay đổi dung tích" });
  }
};

// Update the Cart [POST '/update']
export const updateCart = async (req, res) => {
  try {
    const { itemId, size } = req.body;
    const quantity = Number(req.body.quantity);
    const { userId } = req.auth();

    if (!isObjectIdOrHexString(itemId)) {
      return res.status(400).json({
        success: false,
        message: "Mã sản phẩm không hợp lệ",
      });
    }

    if (!isSafePathSegment(size)) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng chọn dung tích sản phẩm",
      });
    }

    if (!Number.isInteger(quantity) || quantity < 0) {
      return res.status(400).json({
        success: false,
        message: "Số lượng phải là số nguyên không âm",
      });
    }

    const userData = req.user ?? await User.findById(userId);

    if (!userData) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy người dùng",
      });
    }

    const cartItemPath = `cartData.${itemId}.${size}`;

    // Removing an item must remain possible even if the product is no longer sold.
    if (quantity === 0) {
      const timestampUpdates = getMissingCartAddedAtUpdates(userData.cartData, userData.cartAddedAt);
      delete timestampUpdates[`cartAddedAt.${itemId}.${size}`];
      await User.updateOne(
        { _id: userId },
        {
          $unset: { [cartItemPath]: "", [`cartAddedAt.${itemId}.${size}`]: "" },
          ...(Object.keys(timestampUpdates).length ? { $set: timestampUpdates } : {}),
        },
      );

      return res.json({
        success: true,
        message: "Đã cập nhật giỏ hàng",
        quantity: 0,
      });
    }

    const product = await findAvailableProduct(itemId);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy sản phẩm",
      });
    }

    const sizeError = validateProductSize(product, size);

    if (sizeError) {
      return res.status(400).json({
        success: false,
        message: sizeError,
      });
    }

    const stockQuantity = getPurchaseLimit(product, size);

    if (quantity > stockQuantity) {
      return res.status(400).json({
        success: false,
        message: `Chỉ còn ${stockQuantity} sản phẩm có dung tích ${size}`,
      });
    }

    const timestamps = getCartAddedAt(userData.cartData, userData.cartAddedAt);
    const addedAt = timestamps[itemId]?.[size] ?? getNextCartAddedAt(timestamps);
    await User.updateOne(
      { _id: userId },
      { $set: {
        ...getMissingCartAddedAtUpdates(userData.cartData, userData.cartAddedAt),
        [cartItemPath]: quantity,
        [`cartAddedAt.${itemId}.${size}`]: addedAt,
      } },
    );

    return res.json({
      success: true,
      message: "Đã cập nhật giỏ hàng",
      quantity,
      addedAt,
    });
  } catch (error) {
    console.log(error.message);

    return res.status(500).json({
      success: false,
      message: "Không thể cập nhật giỏ hàng",
    });
  }
};
