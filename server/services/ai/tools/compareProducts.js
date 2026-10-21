import { isValidObjectId } from "mongoose";
import Product from "../../../models/Product.js";
import {
  getAvailableProductOptions,
  getProductOptions,
  getProductPriceRange,
} from "./productToolUtils.js";

const MIN_PRODUCTS = 2;
const MAX_PRODUCTS = 4;
const MAX_DESCRIPTION_LENGTH = 600;
const ALLOWED_ARGUMENT_KEYS = new Set(["productIds"]);

export const compareProductsToolDefinition = {
  type: "function",
  function: {
    name: "compareProducts",
    description:
      "So sánh từ 2 đến 4 sản phẩm thật trong danh mục sản phẩm Velours khi đã biết productId. Trả dữ liệu khách quan về giá, size khả dụng, danh mục, loại và tình trạng bán; không tự quyết định sản phẩm tốt nhất thay người dùng.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        productIds: {
          type: "array",
          minItems: MIN_PRODUCTS,
          maxItems: MAX_PRODUCTS,
          uniqueItems: true,
          items: {
            type: "string",
            description: "MongoDB ObjectId của một sản phẩm cần so sánh.",
          },
          description:
            "Danh sách 2 đến 4 productId lấy từ searchProducts hoặc getProductDetails.",
        },
      },
      required: ["productIds"],
    },
  },
};

const validateArguments = (argumentsValue) => {
  if (
    !argumentsValue ||
    typeof argumentsValue !== "object" ||
    Array.isArray(argumentsValue)
  ) {
    throw new Error("Tham số so sánh sản phẩm không hợp lệ");
  }

  const unexpectedKey = Object.keys(argumentsValue).find(
    (key) => !ALLOWED_ARGUMENT_KEYS.has(key),
  );

  if (unexpectedKey) {
    throw new Error(`Tham số ${unexpectedKey} không được hỗ trợ`);
  }

  if (!Array.isArray(argumentsValue.productIds)) {
    throw new Error("productIds phải là một mảng");
  }

  const productIds = argumentsValue.productIds.map((productId) =>
    String(productId || "").trim(),
  );

  if (productIds.length < MIN_PRODUCTS || productIds.length > MAX_PRODUCTS) {
    throw new Error(
      `Cần chọn từ ${MIN_PRODUCTS} đến ${MAX_PRODUCTS} sản phẩm để so sánh`,
    );
  }

  if (productIds.some((productId) => !isValidObjectId(productId))) {
    throw new Error("Danh sách productId không hợp lệ");
  }

  if (new Set(productIds).size !== productIds.length) {
    throw new Error("Các productId so sánh không được trùng nhau");
  }

  return productIds;
};

const getCommonAvailableSizes = (products) => {
  if (products.length === 0) return [];

  const [firstProduct, ...remainingProducts] = products;
  const firstSizes = firstProduct.availableOptions.map((option) => option.size);

  return firstSizes.filter((size) =>
    remainingProducts.every((product) =>
      product.availableOptions.some((option) => option.size === size),
    ),
  );
};

const getLowestStartingPrice = (products) => {
  const pricedProducts = products.filter(
    (product) => product.isAvailable && product.priceRange,
  );

  if (pricedProducts.length === 0) return null;

  const lowestProduct = pricedProducts.reduce((currentLowest, product) =>
    product.priceRange.min < currentLowest.priceRange.min
      ? product
      : currentLowest,
  );

  return {
    productId: lowestProduct.id,
    amount: lowestProduct.priceRange.min,
    currency: lowestProduct.priceRange.currency,
  };
};

export const compareProducts = async (argumentsValue = {}) => {
  const productIds = validateArguments(argumentsValue);
  const databaseProducts = await Product.find({
    _id: { $in: productIds },
    isDeleted: { $ne: true },
  })
    .select(
      "title description price sizes stockBySize inStockBySize images category type popular inStock",
    )
    .lean();
  const databaseProductsById = new Map(
    databaseProducts.map((product) => [String(product._id), product]),
  );
  const missingProductIds = productIds.filter(
    (productId) => !databaseProductsById.has(productId),
  );
  const products = productIds
    .map((productId) => databaseProductsById.get(productId))
    .filter(Boolean)
    .map((product) => {
      const availableOptions = getAvailableProductOptions(product);
      const productOptions = getProductOptions(product);

      return {
        id: String(product._id),
        title: product.title,
        description: String(product.description || "").slice(
          0,
          MAX_DESCRIPTION_LENGTH,
        ),
        category: product.category,
        type: product.type,
        popular: Boolean(product.popular),
        isAvailable: availableOptions.length > 0,
        availableOptions,
        productOptions,
        priceRange: getProductPriceRange(
          availableOptions.length > 0 ? availableOptions : productOptions,
        ),
        image: product.images?.[0] || null,
        url: `/collection/${product._id}`,
      };
    });

  return {
    count: products.length,
    products,
    comparison: {
      requestedProductIds: productIds,
      missingProductIds,
      commonAvailableSizes: getCommonAvailableSizes(products),
      lowestStartingPrice: getLowestStartingPrice(products),
    },
    message:
      products.length >= MIN_PRODUCTS
        ? "Dữ liệu so sánh được lấy trực tiếp từ danh mục sản phẩm Velours. Hãy dựa vào nhu cầu của người dùng để giải thích khác biệt."
        : "Không tìm thấy đủ sản phẩm đang bán để thực hiện so sánh.",
  };
};
