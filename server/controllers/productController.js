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
    throw new ProductRequestError("Vui lòng cung cấp dữ liệu sản phẩm");
  }

  try {
    return JSON.parse(rawProductData);
  } catch {
    throw new ProductRequestError("Dữ liệu sản phẩm không hợp lệ");
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
    throw new ProductRequestError("Dữ liệu sản phẩm không hợp lệ");
  }

  if (
    title.length > 200 ||
    description.length > 5000 ||
    ingredients.length > 5000 ||
    category.length > 100 ||
    type.length > 100 ||
    sizes.length > 50
  ) {
    throw new ProductRequestError("Dữ liệu sản phẩm vượt quá độ dài cho phép");
  }

  if (
    sizes.some((size) => !isValidSizeName(size)) ||
    new Set(sizes.map((size) => size.toLowerCase())).size !== sizes.length
  ) {
    throw new ProductRequestError("Các dung tích sản phẩm phải hợp lệ và không được trùng nhau");
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
      throw new ProductRequestError(`Giá không hợp lệ cho dung tích ${size}`);
    }

    if (!Number.isSafeInteger(quantity) || quantity < 0) {
      throw new ProductRequestError(`Số lượng không hợp lệ cho dung tích ${size}`);
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
      throw new ProductRequestError("Cần có ít nhất một ảnh");
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

    return res.status(201).json({ success: true, message: "Đã thêm sản phẩm" });
  } catch (error) {
    if (!error.statusCode) console.log(error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message:
        error.statusCode === 400 ? error.message : "Không thể tạo sản phẩm",
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
      message: "Không thể tải danh sách sản phẩm",
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
      message: "Không thể tải sản phẩm bán chạy",
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
        message: "Mã sản phẩm không hợp lệ",
      });
    }

    const product = await Product.findOne({
      _id: productId,
      isDeleted: { $ne: true },
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy sản phẩm",
      });
    }

    return res.json({ success: true, product });
  } catch (error) {
    console.log(error.message);
    return res.status(500).json({
      success: false,
      message: "Không thể tải sản phẩm",
    });
  }
};

// Controller function for toggle stock [POST '/toggle-stock']
export const toggleStock = async (req, res) => {
  try {
    if (req.user?.role !== "owner") {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền thực hiện thao tác này",
      });
    }

    const { productId, size, inStock } = req.body;

    if (!isValidObjectId(productId)) {
      return res.status(400).json({
        success: false,
        message: "Mã sản phẩm không hợp lệ",
      });
    }

    if (typeof inStock !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "Trạng thái tồn kho không hợp lệ",
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
        message: "Không tìm thấy sản phẩm",
      });
    }

    // Không truyền size: cập nhật switch tổng
    if (!size) {
      if (inStock && !hasAnyQuantity(product)) {
        return res.status(400).json({
          success: false,
          message: "Không thể mở bán sản phẩm đã hết hàng",
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
        message: "Đã cập nhật trạng thái sản phẩm",
        product,
      });
    }

    // Có truyền size: cập nhật switch của size
    if (!product.sizes.includes(size)) {
      return res.status(400).json({
        success: false,
        message: "Dung tích sản phẩm không hợp lệ",
      });
    }

    const quantity = getSizeQuantity(product, size);

    if (inStock && quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: "Không thể mở bán dung tích có số lượng bằng 0",
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
      message: `Trạng thái của dung tích ${size} đã được cập nhật`,
      product,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      message: "Không thể cập nhật trạng thái tồn kho",
    });
  }
};

export const updateProduct = async (req, res) => {
  try {
    const { productId } = req.params;

    if (!isValidObjectId(productId)) {
      throw new ProductRequestError("Mã sản phẩm không hợp lệ");
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
        message: "Không tìm thấy sản phẩm",
      });
    }

    const rawProductData = parseProductData(req.body.productData);
    const productData = normalizeProductData(rawProductData, currentProduct);
    const renames = getSizeRenames(rawProductData, currentProduct, productData.sizes);
    if (rawProductData.expectedUpdatedAt &&
        new Date(rawProductData.expectedUpdatedAt).getTime() !== new Date(currentProduct.updatedAt).getTime()) {
      throw new ProductRequestError("Sản phẩm đã thay đổi. Vui lòng tải lại trước khi lưu để tránh ghi đè các thay đổi về tồn kho.", 409);
    }
    await validateProductCategory(productData);
    const existingImages = Array.isArray(rawProductData.existingImages)
      ? rawProductData.existingImages
      : [];
    const safeExistingImages = existingImages.filter((imageUrl) =>
      currentProduct.images.includes(imageUrl),
    );

    if (safeExistingImages.length + (req.files || []).length > 4) {
      throw new ProductRequestError("Chỉ được tải lên tối đa 4 ảnh");
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
      throw new ProductRequestError("Cần có ít nhất một ảnh");
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
        throw new ProductRequestError("Dung tích này đang được giữ chỗ cho một giao dịch thanh toán bằng mã QR. Vui lòng thử lại sau khi giao dịch hoàn tất hoặc bị hủy.", 409);
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
        throw new ProductRequestError("Sản phẩm đã thay đổi. Vui lòng tải lại trước khi lưu.", 409);
      }
      if (renames.length) {
        const { filter, pipeline } = buildCartSizeRename(productId, renames);
        await User.updateMany(filter, pipeline, { session, updatePipeline: true });
      }
      return updated;
    });

    return res.json({
      success: true,
      message: "Đã cập nhật sản phẩm thành công",
      product: updatedProduct,
    });
  } catch (error) {
    if (!error.statusCode) console.log(error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message:
        error.statusCode ? error.message : "Không thể cập nhật sản phẩm",
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
        message: "Bạn không có quyền thực hiện thao tác này",
      });
    }

    const { productId } = req.params;

    if (!isValidObjectId(productId)) {
      return res.status(400).json({
        success: false,
        message: "Mã sản phẩm không hợp lệ",
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
        message: "Không tìm thấy sản phẩm hoặc sản phẩm đã bị xóa",
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
      message: "Đã xóa sản phẩm thành công",
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      success: false,
      message: "Không thể xóa sản phẩm",
    });
  }
};
