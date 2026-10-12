import Order from "../models/Order.js";
import Product from "../models/Product.js";

// Count units across all sizes, only after payment has been confirmed.
// Payment Review orders have received money but are not confirmed sales yet.
export const getPopularProducts = async () => {
  return Order.aggregate([
    {
      $match: {
        isPaid: true,
        status: { $in: ["Order Placed", "Packing", "Shipping", "Delivery"] },
      },
    },
    { $unwind: "$items" },
    { $match: { "items.quantity": { $gt: 0 } } },
    {
      $group: {
        _id: "$items.product",
        soldQuantity: { $sum: "$items.quantity" },
      },
    },
    {
      $set: {
        productId: {
          $convert: { input: "$_id", to: "objectId", onError: null, onNull: null },
        },
      },
    },
    {
      $lookup: {
        from: Product.collection.name,
        localField: "productId",
        foreignField: "_id",
        as: "product",
      },
    },
    { $unwind: "$product" },
    { $match: { "product.isDeleted": { $ne: true } } },
    // Stable ordering when products have sold the same number of units.
    { $sort: { soldQuantity: -1, "product._id": 1 } },
    { $limit: 10 },
    {
      $project: {
        _id: "$product._id",
        title: "$product.title",
        images: "$product.images",
        type: "$product.type",
        category: "$product.category",
        price: "$product.price",
        sizes: "$product.sizes",
        stockBySize: "$product.stockBySize",
        inStockBySize: "$product.inStockBySize",
        inStock: "$product.inStock",
        soldQuantity: 1,
      },
    },
  ]);
};
