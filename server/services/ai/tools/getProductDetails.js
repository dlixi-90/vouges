import { isValidObjectId } from "mongoose";
import Product from "../../../models/Product.js";
import {
  getAvailableProductOptions,
  getProductOptions,
  getProductPriceRange,
  getPerfumeProfile,
} from "./productToolUtils.js";

const MAX_DESCRIPTION_LENGTH = 2000;

export const getProductDetailsToolDefinition = {
  type: "function",
  function: {
    name: "getProductDetails",
    description:
      "Lấy hồ sơ nước hoa thật khi đã biết productId: thương hiệu, xuất xứ, nồng độ, nhóm hương, tầng hương, accords, đánh giá lưu/tỏa và mùa/ngày/đêm; giá, số tồn và giới hạn mua riêng từng dung tích.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        productId: {
          type: "string",
          description:
            "MongoDB ObjectId của sản phẩm, thường lấy từ kết quả searchProducts hoặc URL /collection/:productId.",
        },
      },
      required: ["productId"],
    },
  },
};

export const getProductDetails = async (argumentsValue = {}) => {
  if (
    !argumentsValue ||
    typeof argumentsValue !== "object" ||
    Array.isArray(argumentsValue)
  ) {
    throw new Error("Tham số sản phẩm không hợp lệ");
  }

  const productId = String(argumentsValue.productId || "").trim();

  if (!isValidObjectId(productId)) {
    throw new Error("productId không hợp lệ");
  }

  const product = await Product.findOne({
    _id: productId,
    isDeleted: { $ne: true },
    isPublished: { $ne: false },
    catalogScope: { $ne: "other" },
  })
    .select(
      "title description price sizes stockBySize inventoryMode isPublished inStockBySize images category type popular inStock brand origin concentration gender fragrance",
    )
    .lean();

  if (!product) {
    return {
      found: false,
      product: null,
      message: "Không tìm thấy sản phẩm hoặc sản phẩm đã ngừng bán.",
    };
  }

  const availableOptions = getAvailableProductOptions(product);
  const productOptions = getProductOptions(product);

  return {
    found: true,
    product: {
      id: String(product._id),
      title: product.title,
      description: product.description.slice(0, MAX_DESCRIPTION_LENGTH),
      category: product.category,
      type: product.type,
      ...getPerfumeProfile(product),
      popular: Boolean(product.popular),
      isAvailable: availableOptions.length > 0,
      availableOptions,
      productOptions,
      priceRange: getProductPriceRange(
        availableOptions.length > 0 ? availableOptions : productOptions,
      ),
      image: product.images?.[0] || null,
      url: `/collection/${product._id}`,
    },
    message:
      availableOptions.length > 0
        ? "Thông tin được lấy trực tiếp từ danh mục sản phẩm Velours."
        : "Sản phẩm hiện không có size khả dụng.",
  };
};
