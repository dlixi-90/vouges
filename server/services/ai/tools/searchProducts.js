import Product from "../../../models/Product.js";
import {
  getAvailableProductOptions,
  getProductOptions,
  getProductPriceRange,
} from "./productToolUtils.js";

const DEFAULT_RESULT_LIMIT = 5;
const MAX_RESULT_LIMIT = 8;
const ALLOWED_SORTS = ["relevant", "price_asc", "price_desc", "newest"];
const ALLOWED_AVAILABILITY = ["all", "available", "out_of_stock"];

const escapeRegExp = (value) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const readOptionalText = (value, field, maxLength) => {
  if (value === undefined || value === null || value === "") return "";
  if (typeof value !== "string") throw new Error(`${field} phải là chuỗi`);

  const normalizedValue = value.trim();

  if (normalizedValue.length > maxLength) {
    throw new Error(`${field} quá dài`);
  }

  return normalizedValue;
};

const readOptionalPrice = (value, field) => {
  if (value === undefined || value === null) return null;

  const normalizedValue = Number(value);

  if (!Number.isFinite(normalizedValue) || normalizedValue < 0) {
    throw new Error(`${field} phải là số không âm`);
  }

  return normalizedValue;
};

const getRelevanceScore = (product, normalizedQuery) => {
  if (!normalizedQuery) return product.popular ? 1 : 0;

  const title = product.title.toLowerCase();
  const category = product.category.toLowerCase();
  const type = product.type.toLowerCase();
  const description = product.description.toLowerCase();

  return (
    (title === normalizedQuery ? 10 : 0) +
    (title.includes(normalizedQuery) ? 6 : 0) +
    (type.includes(normalizedQuery) ? 4 : 0) +
    (category.includes(normalizedQuery) ? 3 : 0) +
    (description.includes(normalizedQuery) ? 1 : 0) +
    (product.popular ? 1 : 0)
  );
};

export const searchProductsToolDefinition = {
  type: "function",
  function: {
    name: "searchProducts",
    description:
      "Tìm sản phẩm thật trong toàn bộ danh mục sản phẩm Velours, bao gồm cả sản phẩm hết hàng. Dùng tool này khi người dùng hỏi về tên sản phẩm, loại, danh mục, giá, size, tình trạng còn hàng hoặc cần gợi ý sản phẩm đang bán.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        query: {
          type: "string",
          description:
            "Từ khóa tìm trong tên, mô tả, loại và danh mục sản phẩm.",
          maxLength: 100,
        },
        category: {
          type: "string",
          maxLength: 100,
          description: "Danh mục sản phẩm nếu người dùng yêu cầu cụ thể.",
        },
        type: {
          type: "string",
          description: "Loại sản phẩm cụ thể, ví dụ Serum hoặc Shampoo.",
          maxLength: 80,
        },
        minPrice: {
          type: "number",
          minimum: 0,
          description:
            "Giá tối thiểu theo đơn vị tiền tệ đầy đủ, ví dụ 150000 nghĩa là 150.000 VND.",
        },
        maxPrice: {
          type: "number",
          minimum: 0,
          description:
            "Giá tối đa theo đơn vị tiền tệ đầy đủ, ví dụ 500000 nghĩa là 500.000 VND.",
        },
        sort: {
          type: "string",
          enum: ALLOWED_SORTS,
          description:
            "Cách sắp xếp: liên quan nhất, giá tăng, giá giảm hoặc mới nhất.",
        },
        availability: {
          type: "string",
          enum: ALLOWED_AVAILABILITY,
          description:
            "Lọc theo tồn kho: all để tra cứu toàn bộ danh mục sản phẩm, available cho sản phẩm mua được, out_of_stock cho sản phẩm đã hết hàng. Mặc định là all.",
        },
        limit: {
          type: "integer",
          minimum: 1,
          maximum: MAX_RESULT_LIMIT,
          description: "Số sản phẩm cần trả về, mặc định là 5.",
        },
      },
    },
  },
};

export const searchProducts = async (argumentsValue = {}) => {
  if (
    !argumentsValue ||
    typeof argumentsValue !== "object" ||
    Array.isArray(argumentsValue)
  ) {
    throw new Error("Tham số tìm kiếm không hợp lệ");
  }

  const query = readOptionalText(argumentsValue.query, "query", 100);
  const category = readOptionalText(argumentsValue.category, "category", 100);
  const type = readOptionalText(argumentsValue.type, "type", 80);
  const minPrice = readOptionalPrice(argumentsValue.minPrice, "minPrice");
  const maxPrice = readOptionalPrice(argumentsValue.maxPrice, "maxPrice");
  const sort = argumentsValue.sort || "relevant";
  const availability = argumentsValue.availability || "all";
  const limit = argumentsValue.limit ?? DEFAULT_RESULT_LIMIT;

  if (!ALLOWED_SORTS.includes(sort)) {
    throw new Error("sort không hợp lệ");
  }

  if (!ALLOWED_AVAILABILITY.includes(availability)) {
    throw new Error("availability không hợp lệ");
  }

  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_RESULT_LIMIT) {
    throw new Error(`limit phải từ 1 đến ${MAX_RESULT_LIMIT}`);
  }

  if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) {
    throw new Error("minPrice không được lớn hơn maxPrice");
  }

  const databaseFilter = {
    isDeleted: { $ne: true },
  };

  if (query) {
    const queryPattern = new RegExp(escapeRegExp(query), "i");
    databaseFilter.$or = [
      { title: queryPattern },
      { description: queryPattern },
      { category: queryPattern },
      { type: queryPattern },
    ];
  }

  if (category) {
    databaseFilter.category = new RegExp(`^${escapeRegExp(category)}$`, "i");
  }

  if (type) {
    databaseFilter.type = new RegExp(`^${escapeRegExp(type)}$`, "i");
  }

  const databaseProducts = await Product.find(databaseFilter)
    .select(
      "title description price sizes stockBySize inStockBySize images category type popular inStock createdAt",
    )
    .lean();

  const normalizedQuery = query.toLowerCase();

  const matchingProducts = databaseProducts
    .map((product) => {
      const availableOptions = getAvailableProductOptions(product);
      const isAvailable = availableOptions.length > 0;

      if (availability === "available" && !isAvailable) return null;
      if (availability === "out_of_stock" && isAvailable) return null;

      const productOptions = getProductOptions(product);
      const searchableOptions = isAvailable ? availableOptions : productOptions;

      const matchingOptions = searchableOptions.filter(
        (option) =>
          (minPrice === null || option.amount >= minPrice) &&
          (maxPrice === null || option.amount <= maxPrice),
      );

      if (matchingOptions.length === 0) return null;

      return {
        id: String(product._id),
        title: product.title,
        description: product.description.slice(0, 280),
        category: product.category,
        type: product.type,
        popular: Boolean(product.popular),
        isAvailable,
        availableOptions: isAvailable ? matchingOptions : [],
        productOptions,
        priceRange: getProductPriceRange(matchingOptions),
        image: product.images?.[0] || null,
        url: `/collection/${product._id}`,
        createdAt: product.createdAt,
        relevanceScore: getRelevanceScore(product, normalizedQuery),
      };
    })
    .filter(Boolean);

  matchingProducts.sort((firstProduct, secondProduct) => {
    if (sort === "price_asc") {
      return firstProduct.priceRange.min - secondProduct.priceRange.min;
    }

    if (sort === "price_desc") {
      return secondProduct.priceRange.max - firstProduct.priceRange.max;
    }

    if (sort === "newest") {
      return new Date(secondProduct.createdAt) - new Date(firstProduct.createdAt);
    }

    return secondProduct.relevanceScore - firstProduct.relevanceScore;
  });

  const products = matchingProducts.slice(0, limit).map((product) => {
    const { relevanceScore, createdAt, ...publicProduct } = product;
    return publicProduct;
  });

  return {
    count: products.length,
    products,
    filters: {
      query: query || null,
      category: category || null,
      type: type || null,
      minPrice,
      maxPrice,
      sort,
      availability,
    },
    message:
      products.length > 0
        ? "Các sản phẩm này được lấy trực tiếp từ danh mục sản phẩm Velours; hãy kiểm tra isAvailable trước khi tư vấn mua hàng."
        : "Không tìm thấy sản phẩm phù hợp với điều kiện.",
  };
};
