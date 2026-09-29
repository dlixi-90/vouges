import { isObjectIdOrHexString } from "mongoose";
import User from "../models/User.js";
import Product from "../models/Product.js";
import { getSizeQuantity, isSizeAvailable } from "../utils/productStock.js";
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
  });
};

const validateProductSize = (product, size) => {
  if (!product.sizes.includes(size)) {
    return "Invalid product size";
  }

  if (!isSizeAvailable(product, size)) {
    return "This product size is out of stock";
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
        message: "Invalid product ID",
      });
    }

    if (!isSafePathSegment(size)) {
      return res.status(400).json({
        success: false,
        message: "Please select a product size",
      });
    }

    if (
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > MAX_ADD_QUANTITY
    ) {
      return res.status(400).json({
        success: false,
        message: `Quantity must be between 1 and ${MAX_ADD_QUANTITY}`,
      });
    }

    const [userData, product] = await Promise.all([
      User.findById(userId),
      findAvailableProduct(itemId),
    ]);

    if (!userData) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    const sizeError = validateProductSize(product, size);

    if (sizeError) {
      return res.status(400).json({
        success: false,
        message: sizeError,
      });
    }

    const stockQuantity = getSizeQuantity(product, size);

    if (quantity > stockQuantity) {
      return res.status(400).json({
        success: false,
        message: `Only ${stockQuantity} items are available for size ${size}`,
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
        message: `Only ${stockQuantity} items are available for size ${size}`,
      });
    }

    const nextQuantity = Number(updatedUser.cartData?.[itemId]?.[size] ?? 0);

    return res.json({
      success: true,
      message: "Added to Cart",
      addedQuantity: quantity,
      quantity: nextQuantity,
      addedAt,
    });
  } catch (error) {
    console.log(error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to add item to cart",
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
      return res.status(400).json({ success: false, message: "Invalid size change" });
    }

    const product = await findAvailableProduct(itemId);
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }
    const sizeError = validateProductSize(product, toSize);
    if (sizeError) {
      return res.status(400).json({ success: false, message: sizeError });
    }
    const quantity = fromQuantity + toQuantity;
    const stock = getSizeQuantity(product, toSize);
    if (!Number.isSafeInteger(quantity) || quantity > stock) {
      return res.status(400).json({
        success: false,
        message: `Only ${stock} items are available for size ${toSize}`,
      });
    }

    const fromPath = `cartData.${itemId}.${fromSize}`;
    const toPath = `cartData.${itemId}.${toSize}`;
    const userData = req.user;
    const timestamps = getCartAddedAt(userData.cartData, userData.cartAddedAt);
    const addedAt = timestamps[itemId]?.[fromSize];
    if (!addedAt) {
      return res.status(409).json({ success: false, message: "Your cart changed. Please reload it." });
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
        message: "Your cart changed. Please try again with the updated cart.",
      });
    }
    return res.json({ success: true, quantity, addedAt, message: "Size updated" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Unable to change size" });
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
        message: "Invalid product ID",
      });
    }

    if (!isSafePathSegment(size)) {
      return res.status(400).json({
        success: false,
        message: "Please select a product size",
      });
    }

    if (!Number.isInteger(quantity) || quantity < 0) {
      return res.status(400).json({
        success: false,
        message: "Quantity must be a non-negative integer",
      });
    }

    const userData = await User.findById(userId);

    if (!userData) {
      return res.status(404).json({
        success: false,
        message: "User not found",
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
        message: "Cart Updated",
        quantity: 0,
      });
    }

    const product = await findAvailableProduct(itemId);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    const sizeError = validateProductSize(product, size);

    if (sizeError) {
      return res.status(400).json({
        success: false,
        message: sizeError,
      });
    }

    const stockQuantity = getSizeQuantity(product, size);

    if (quantity > stockQuantity) {
      return res.status(400).json({
        success: false,
        message: `Only ${stockQuantity} items are available for size ${size}`,
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
      message: "Cart Updated",
      quantity,
      addedAt,
    });
  } catch (error) {
    console.log(error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to update cart",
    });
  }
};
