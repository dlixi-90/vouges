import { v2 as cloudinary } from "cloudinary";
import Product from "../models/Product.js";
import { validateProductCategory } from "../services/categoryService.js";
import mongoose, { isValidObjectId } from "mongoose";
import Order from "../models/Order.js";
import { isValidSizeName, getSizeRenames, buildCartSizeRename } from "../utils/productVariants.js";
import User from "../models/User.js";
import { unlink } from "node:fs/promises";
import { getPopularProducts } from "../services/popularProducts.js";
import {
  getSizeQuantity,
  hasAnyEnabledSize,
  hasAnyQuantity,
} from "../utils/productStock.js";

class ProductRequestError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

const cleanupUploadedFiles = async (files = []) => {
  await Promise.allSettled(
    files.filter((file) => file?.path).map((file) => unlink(file.path)),
  );
};

const parseProductData = (rawProductData) => {
  if (typeof rawProductData !== "string") {
    throw new ProductRequestError("Product data is required");
  }

  try {
    return JSON.parse(rawProductData);
  } catch {
    throw new ProductRequestError("Invalid product data");
  }
};

const normalizeProductData = (productData, currentProduct = null) => {
  const title = typeof productData.title === "string" ? productData.title.trim() : "";
  const description =
    typeof productData.description === "string"
      ? productData.description.trim()
      : "";
  const ingredients =
    typeof productData.ingredients === "string"
      ? productData.ingredients.trim()
      : "";
  const category =
    typeof productData.category === "string" ? productData.category.trim() : "";
  const type = typeof productData.type === "string" ? productData.type.trim() : "";
  const typeId = productData.typeId;
  const rawSizes = Array.isArray(productData.sizes) ? productData.sizes : [];
  const sizes = rawSizes.map((size) =>
    typeof size === "string" ? size.trim() : "",
  );

  if (!title || !description || (!typeId && (!category || !type)) || sizes.length === 0) {
    throw new ProductRequestError("Invalid product data");
  }

  if (
    title.length > 200 ||
    description.length > 5000 ||
    ingredients.length > 5000 ||
    category.length > 100 ||
    type.length > 100 ||
    sizes.length > 50
  ) {
    throw new ProductRequestError("Product data is too long");
  }

  if (
    sizes.some((size) => !isValidSizeName(size)) ||
    new Set(sizes.map((size) => size.toLowerCase())).size !== sizes.length
  ) {
    throw new ProductRequestError("Product sizes must be unique and valid");
  }

  const price = {};
  const stockBySize = {};
  const inStockBySize = {};
  const renames = getSizeRenames(productData, currentProduct, sizes);

  for (const size of sizes) {
    const productPrice = Number(productData.price?.[size]);
    const quantity = Number(productData.stockBySize?.[size]);

    if (
      !Number.isFinite(productPrice) ||
      productPrice <= 0 ||
      productPrice > Number.MAX_SAFE_INTEGER / 1000
    ) {
      throw new ProductRequestError(`Invalid price for size ${size}`);
    }

    if (!Number.isSafeInteger(quantity) || quantity < 0) {
      throw new ProductRequestError(`Invalid quantity for size ${size}`);
    }

    const originalSize = renames.find((rename) => rename.to === size)?.from || size;
    const savedStatus = currentProduct?.inStockBySize?.[originalSize];

    price[size] = productPrice;
    stockBySize[size] = quantity;
    inStockBySize[size] =
      quantity > 0 &&
      (typeof savedStatus === "boolean" ? savedStatus : true);
  }

  return {
    title,
    description,
    ingredients,
    category,
    type,
    ...(typeId !== undefined && { typeId }),
    popular: Boolean(productData.popular ?? currentProduct?.popular),
    sizes,
    price,
    stockBySize,
    inStockBySize,
  };
};

// Controller Function for Adding Product [POST '/']
export const createProduct = async (req, res) => {
  try {
    const productData = normalizeProductData(
      parseProductData(req.body.productData),
    );
    const images = req.files || [];

    if (images.length === 0) {
      throw new ProductRequestError("At least one image is required");
    }

    await validateProductCategory(productData);

    // Upload images tp cloudinary
    const imagesUrl = await Promise.all(
      images.map(async (item) => {
        const result = await cloudinary.uploader.upload(item.path, {
          resource_type: "image",
        });
        return result.secure_url;
      }),
    );

    const hasStock = productData.sizes.some(
      (size) => productData.inStockBySize[size],
    );

    await Product.create({
      ...productData,
      images: imagesUrl,
      inStock: hasStock,
    });

    return res.status(201).json({ success: true, message: "Product Added" });
  } catch (error) {
    if (!error.statusCode) console.log(error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message:
        error.statusCode === 400 ? error.message : "Unable to create product",
    });
  } finally {
    await cleanupUploadedFiles(req.files);
  }
};

// Controller function for Product List [GET '/']
export const listProduct = async (req, res) => {
  try {
    const products = await Product.find({
      isDeleted: {
        $ne: true,
      },
    }).sort({
      createdAt: -1,
    }).lean();
    res.json({ success: true, products });
  } catch (error) {
    if (!error.statusCode) console.log(error);
    return res.status(500).json({
      success: false,
      message: "Unable to load products",
    });
  }
};

export const listPopularProducts = async (_req, res) => {
  try {
    const products = await getPopularProducts();
    res.set("Cache-Control", "no-store");
    return res.json({ success: true, products });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Unable to load popular products",
    });
  }
};

// Controller function for get single product [GET '/single']
export const singleProduct = async (req, res) => {
  try {
    const productId = req.query.productId || req.body?.productId;

    if (!isValidObjectId(productId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
    }

    const product = await Product.findOne({
      _id: productId,
      isDeleted: { $ne: true },
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    return res.json({ success: true, product });
  } catch (error) {
    console.log(error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to load product",
    });
  }
};

// Controller function for toggle stock [POST '/toggle-stock']
export const toggleStock = async (req, res) => {
  try {
    if (req.user?.role !== "owner") {
      return res.status(403).json({
        success: false,
        message: "Not authorized",
      });
    }

    const { productId, size, inStock } = req.body;

    if (!isValidObjectId(productId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
    }

    if (typeof inStock !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "Invalid stock status",
      });
    }

    const product = await Product.findOne({
      _id: productId,
      isDeleted: {
        $ne: true,
      },
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Không truyền size: cập nhật switch tổng
    if (!size) {
      if (inStock && !hasAnyQuantity(product)) {
        return res.status(400).json({
          success: false,
          message: "Cannot enable a product with no stock",
        });
      }

      product.inStock = inStock;

      product.inStockBySize = Object.fromEntries(
        product.sizes.map((productSize) => [
          productSize,
          inStock && getSizeQuantity(product, productSize) > 0,
        ]),
      );
      product.markModified("inStockBySize");

      await product.save();

      return res.json({
        success: true,
        message: "Product status updated",
        product,
      });
    }

    // Có truyền size: cập nhật switch của size
    if (!product.sizes.includes(size)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product size",
      });
    }

    const quantity = getSizeQuantity(product, size);

    if (inStock && quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: "Cannot enable a size with zero quantity",
      });
    }

    product.inStockBySize = {
      ...(product.inStockBySize || {}),
      [size]: inStock,
    };

    product.markModified("inStockBySize");

    product.inStock = hasAnyEnabledSize(product);

    await product.save();

    return res.json({
      success: true,
      message: `Status for size ${size} updated`,
      product,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      message: "Unable to update stock status",
    });
  }
};

export const updateProduct = async (req, res) => {
  try {
    const { productId } = req.params;

    if (!isValidObjectId(productId)) {
      throw new ProductRequestError("Invalid product ID");
    }

    const currentProduct = await Product.findOne({
      _id: productId,
      isDeleted: {
        $ne: true,
      },
    });

    if (!currentProduct) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    const rawProductData = parseProductData(req.body.productData);
    const productData = normalizeProductData(rawProductData, currentProduct);
    const renames = getSizeRenames(rawProductData, currentProduct, productData.sizes);
    if (rawProductData.expectedUpdatedAt &&
        new Date(rawProductData.expectedUpdatedAt).getTime() !== new Date(currentProduct.updatedAt).getTime()) {
      throw new ProductRequestError("Product changed. Reload it before saving to avoid overwriting stock changes.", 409);
    }
    await validateProductCategory(productData);
    const existingImages = Array.isArray(rawProductData.existingImages)
      ? rawProductData.existingImages
      : [];
    const safeExistingImages = existingImages.filter((imageUrl) =>
      currentProduct.images.includes(imageUrl),
    );

    if (safeExistingImages.length + (req.files || []).length > 4) {
      throw new ProductRequestError("Only up to 4 images are allowed");
    }

    const uploadedImages = await Promise.all(
      (req.files || []).map(async (image) => {
        const result = await cloudinary.uploader.upload(image.path, {
          resource_type: "image",
        });

        return result.secure_url;
      }),
    );

    const images = [...safeExistingImages, ...uploadedImages];

    if (images.length === 0) {
      throw new ProductRequestError("At least one image is required");
    }

    const hasEnabledSize = productData.sizes.some(
      (size) => productData.inStockBySize[size],
    );

    const updatedProduct = await mongoose.connection.transaction(async (session) => {
      // Awaiting QR orders still refer to the old size when releasing reserved stock.
      const removedSizes = currentProduct.sizes.filter((size) => !productData.sizes.includes(size));
      const changedSizes = [...new Set([...removedSizes, ...renames.map(({ from }) => from)])];
      if (changedSizes.length && await Order.exists({
        paymentMethod: "QR",
        isPaid: false,
        status: "Awaiting Payment",
        items: { $elemMatch: { product: productId, size: { $in: changedSizes } } },
      }).session(session)) {
        throw new ProductRequestError("This size is reserved by a pending QR payment. Try again after the payment finishes or is cancelled.", 409);
      }
      const updated = await Product.findOneAndUpdate(
        { _id: productId, isDeleted: { $ne: true }, updatedAt: currentProduct.updatedAt },
        {
          ...productData,
          inStock: hasEnabledSize ? Boolean(currentProduct.inStock) : false,
          images,
        },
        { new: true, runValidators: true, session },
      );
      if (!updated) {
        throw new ProductRequestError("Product changed. Reload it before saving.", 409);
      }
      if (renames.length) {
        const { filter, pipeline } = buildCartSizeRename(productId, renames);
        await User.updateMany(filter, pipeline, { session, updatePipeline: true });
      }
      return updated;
    });

    return res.json({
      success: true,
      message: "Product updated successfully",
      product: updatedProduct,
    });
  } catch (error) {
    if (!error.statusCode) console.log(error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message:
        error.statusCode ? error.message : "Unable to update product",
    });
  } finally {
    await cleanupUploadedFiles(req.files);
  }
};

export const deleteProduct = async (req, res) => {
  try {
    if (req.user?.role !== "owner") {
      return res.status(403).json({
        success: false,
        message: "Not authorized",
      });
    }

    const { productId } = req.params;

    if (!isValidObjectId(productId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
    }

    const deletedProduct = await Product.findOneAndUpdate(
      {
        _id: productId,
        isDeleted: {
          $ne: true,
        },
      },
      {
        isDeleted: true,
        deletedAt: new Date(),
        inStock: false,
        popular: false,
      },
      {
        new: true,
      },
    );

    if (!deletedProduct) {
      return res.status(404).json({
        success: false,
        message: "Product not found or already deleted",
      });
    }

    // Xóa sản phẩm khỏi giỏ hàng của tất cả người dùng.
    const cartProductPath = `cartData.${productId}`;

    await User.updateMany(
      {
        [cartProductPath]: {
          $exists: true,
        },
      },
      {
        $unset: {
          [cartProductPath]: "",
        },
      },
    );

    return res.json({
      success: true,
      message: "Product deleted successfully",
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      success: false,
      message: "Unable to delete product",
    });
  }
};
