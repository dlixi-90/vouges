import { isValidObjectId } from "mongoose";
import Product from "../../../models/Product.js";
import {
  getAvailableProductOptions,
  getProductOptions,
  getProductPriceRange,
} from "./productToolUtils.js";

const MAX_DESCRIPTION_LENGTH = 2000;

export const getProductDetailsToolDefinition = {
  type: "function",
  function: {
    name: "getProductDetails",
    description:
      "Lấy thông tin chi tiết của một sản phẩm Velours khi đã biết productId. Dùng khi người dùng hỏi kỹ hơn về một sản phẩm cụ thể, giá theo size, mô tả hoặc tình trạng còn bán.",
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
      brand: product.brand || null,
      concentration: product.concentration || null,
      gender: product.gender || null,
      origin: product.origin || null,
      fragrance: {group:product.fragrance?.group||null,style:product.fragrance?.style||null,notes:product.fragrance?.notes||{},accords:(product.fragrance?.accords||[]).map(item=>item.label)},
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
