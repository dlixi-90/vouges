import assert from "node:assert/strict";
import test from "node:test";
import Product from "../../models/Product.js";
import {
  compareProducts,
  compareProductsToolDefinition,
} from "../../services/ai/tools/compareProducts.js";
import { getProductDetails } from "../../services/ai/tools/getProductDetails.js";
import { searchProducts } from "../../services/ai/tools/searchProducts.js";

const PRODUCT_A_ID = "507f1f77bcf86cd799439011";
const PRODUCT_B_ID = "507f1f77bcf86cd799439012";
const PRODUCT_C_ID = "507f1f77bcf86cd799439013";

const createQuery = (result) => ({
  select() {
    return this;
  },
  limit() {
    return this;
  },
  lean() {
    return Promise.resolve(result);
  },
});

const createProduct = ({
  id,
  title,
  price,
  sizes,
  stockBySize,
  inStockBySize,
  inStock = true,
}) => ({
  _id: id,
  title,
  description: `${title} description`,
  price,
  sizes,
  stockBySize,
  inStockBySize,
  images: [`${id}.jpg`],
  category: "Face Care",
  type: "Serum",
  popular: false,
  inStock,
  isDeleted: false,
  createdAt: new Date("2026-01-01T00:00:00Z"),
});

test("searchProducts lọc size còn hàng và đổi giá sang đơn vị đầy đủ", async () => {
  const originalFind = Product.find;
  let capturedFilter;

  Product.find = (filter) => {
    capturedFilter = filter;
    return createQuery([
      createProduct({
        id: PRODUCT_A_ID,
        title: "Hydrating Serum",
        price: { "30ml": 20000, "50ml": 30000 },
        sizes: ["30ml", "50ml"],
        stockBySize: { "30ml": 4, "50ml": 0 },
        inStockBySize: { "30ml": true, "50ml": true },
      }),
    ]);
  };

  try {
    const result = await searchProducts({
      query: "Hydrating",
      category: "Face Care",
      minPrice: 15000,
      sort: "price_asc",
      limit: 3,
    });

    assert.equal("inStock" in capturedFilter, false);
    assert.equal(capturedFilter.isDeleted.$ne, true);
    assert.equal(capturedFilter.$or[0].title.test("Hydrating Serum"), true);
    assert.equal(result.count, 1);
    assert.equal(result.products[0].availableOptions.length, 1);
    assert.equal(result.products[0].availableOptions[0].amount, 20000);
    assert.deepEqual(result.products[0].priceRange, {
      min: 20000,
      max: 20000,
      currency: process.env.CURRENCY || "VND",
    });

    await assert.rejects(
      searchProducts({ minPrice: 50000, maxPrice: 10000 }),
      /minPrice/,
    );
  } finally {
    Product.find = originalFind;
  }
});

test("searchProducts có thể tra cứu sản phẩm hết hàng và báo đúng trạng thái", async () => {
  const originalFind = Product.find;

  Product.find = () =>
    createQuery([
      createProduct({
        id: PRODUCT_A_ID,
        title: "Sold Out Serum",
        price: { "30ml": 20000 },
        sizes: ["30ml"],
        stockBySize: { "30ml": 0 },
        inStockBySize: { "30ml": false },
        inStock: false,
      }),
    ]);

  try {
    const allProducts = await searchProducts({ query: "Sold Out" });

    assert.equal(allProducts.count, 1);
    assert.equal(allProducts.products[0].isAvailable, false);
    assert.deepEqual(allProducts.products[0].availableOptions, []);
    assert.equal(allProducts.products[0].productOptions[0].isAvailable, false);
    assert.equal(allProducts.products[0].priceRange.min, 20000);

    const availableProducts = await searchProducts({
      query: "Sold Out",
      availability: "available",
    });
    assert.equal(availableProducts.count, 0);

    const outOfStockProducts = await searchProducts({
      query: "Sold Out",
      availability: "out_of_stock",
    });
    assert.equal(outOfStockProducts.count, 1);
  } finally {
    Product.find = originalFind;
  }
});

test("getProductDetails trả dữ liệu thật và xử lý productId không hợp lệ", async () => {
  const originalFindOne = Product.findOne;
  let databaseResult = createProduct({
    id: PRODUCT_A_ID,
    title: "Hydrating Serum",
    price: { "30ml": 20000 },
    sizes: ["30ml"],
    stockBySize: { "30ml": 2 },
    inStockBySize: { "30ml": true },
  });
  let findCalls = 0;

  Product.findOne = () => {
    findCalls += 1;
    return createQuery(databaseResult);
  };

  try {
    const found = await getProductDetails({ productId: PRODUCT_A_ID });

    assert.equal(found.found, true);
    assert.equal(found.product.id, PRODUCT_A_ID);
    assert.equal(found.product.priceRange.min, 20000);

    databaseResult = createProduct({
      id: PRODUCT_B_ID,
      title: "Sold Out Serum",
      price: { "30ml": 25000 },
      sizes: ["30ml"],
      stockBySize: { "30ml": 0 },
      inStockBySize: { "30ml": false },
      inStock: false,
    });
    const soldOut = await getProductDetails({ productId: PRODUCT_B_ID });
    assert.equal(soldOut.found, true);
    assert.equal(soldOut.product.isAvailable, false);
    assert.deepEqual(soldOut.product.availableOptions, []);
    assert.equal(soldOut.product.productOptions[0].isAvailable, false);
    assert.equal(soldOut.product.priceRange.min, 25000);

    databaseResult = null;
    const missing = await getProductDetails({ productId: PRODUCT_C_ID });
    assert.equal(missing.found, false);

    await assert.rejects(
      getProductDetails({ productId: "not-an-object-id" }),
      /productId/,
    );
    assert.equal(findCalls, 3);
  } finally {
    Product.findOne = originalFindOne;
  }
});

test("compareProducts giữ thứ tự yêu cầu và tính chỉ số khách quan", async () => {
  const originalFind = Product.find;
  let capturedFilter;
  const productA = createProduct({
    id: PRODUCT_A_ID,
    title: "Serum A",
    price: { M: 20000, L: 30000 },
    sizes: ["M", "L"],
    stockBySize: { M: 5, L: 2 },
    inStockBySize: { M: true, L: true },
  });
  const productB = createProduct({
    id: PRODUCT_B_ID,
    title: "Serum B",
    price: { M: 10000 },
    sizes: ["M"],
    stockBySize: { M: 3 },
    inStockBySize: { M: true },
  });

  Product.find = (filter) => {
    capturedFilter = filter;
    return createQuery([productB, productA]);
  };

  try {
    const result = await compareProducts({
      productIds: [PRODUCT_A_ID, PRODUCT_B_ID, PRODUCT_C_ID],
    });

    assert.deepEqual(capturedFilter._id.$in, [
      PRODUCT_A_ID,
      PRODUCT_B_ID,
      PRODUCT_C_ID,
    ]);
    assert.deepEqual(
      result.products.map((product) => product.id),
      [PRODUCT_A_ID, PRODUCT_B_ID],
    );
    assert.deepEqual(result.comparison.missingProductIds, [PRODUCT_C_ID]);
    assert.deepEqual(result.comparison.commonAvailableSizes, ["M"]);
    assert.equal(
      result.comparison.lowestStartingPrice.productId,
      PRODUCT_B_ID,
    );
    assert.equal(result.comparison.lowestStartingPrice.amount, 10000);
    assert.equal(
      compareProductsToolDefinition.function.parameters.additionalProperties,
      false,
    );

    await assert.rejects(
      compareProducts({ productIds: [PRODUCT_A_ID] }),
      /từ 2 đến 4/,
    );
    await assert.rejects(
      compareProducts({ productIds: [PRODUCT_A_ID, PRODUCT_A_ID] }),
      /trùng nhau/,
    );
    await assert.rejects(
      compareProducts({
        productIds: [PRODUCT_A_ID, PRODUCT_B_ID],
        userId: "unexpected",
      }),
      /không được hỗ trợ/,
    );
  } finally {
    Product.find = originalFind;
  }
});
