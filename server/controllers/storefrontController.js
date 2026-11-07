import { isObjectIdOrHexString } from "mongoose";
import Product from "../models/Product.js";
import { catalogSnapshot, getStorefrontFilterCatalog, parseBrowseQuery } from "../services/storefrontCatalog.js";
import { collectStorefrontFilters } from "../services/perfumeFilters.js";
import { readStorefrontBrowse, readStorefrontRelated } from "../services/storefrontBrowse.js";

// Catalog cards are advisory; cart and checkout endpoints always re-read live stock and price.
// Longer edge caching avoids repeating the same MongoDB browse aggregation for every visitor.
const PUBLIC_CATALOG_CACHE = "public, max-age=10, s-maxage=60, stale-while-revalidate=120";
const PUBLIC_FILTER_CACHE = "public, max-age=15, s-maxage=15, stale-while-revalidate=30";
const action = handler => async (req, res) => {
  try {
    res.set("Cache-Control", "no-store");
    await handler(req, res);
  } catch (error) {
    if (!error.statusCode) console.error(error);
    res.status(error.statusCode || 500).json({ success: false, message: error.statusCode ? error.message : "Không thể tải sản phẩm. Vui lòng thử lại." });
  }
};
export const browseProducts = action(async (req, res) => {
  const options = parseBrowseQuery(req.query);
  const result = await readStorefrontBrowse(options);
  res.set("Cache-Control", PUBLIC_CATALOG_CACHE);
  res.json(result);
});
export const productFilters = action(async (_req, res) => {
  const result = await catalogSnapshot("filter-options", 15000, async () => ({
    success: true,
    options: collectStorefrontFilters(await getStorefrontFilterCatalog()),
  }));
  res.set("Cache-Control", PUBLIC_FILTER_CACHE);
  res.json(result);
});
export const relatedProducts = action(async (req, res) => {
  if (!isObjectIdOrHexString(req.query.productId)) throw Object.assign(new Error("Mã sản phẩm không hợp lệ"), { statusCode: 400 });
  const result = await readStorefrontRelated(req.query.productId);
  res.set("Cache-Control", PUBLIC_CATALOG_CACHE);
  res.json(result);
});
export const batchProducts = action(async (req, res) => {
  const ids = typeof req.query.ids === "string" ? [...new Set(req.query.ids.split(","))] : [];
  if (!ids.length || ids.length > 100 || ids.some(id => !isObjectIdOrHexString(id))) throw Object.assign(new Error("Danh sách sản phẩm không hợp lệ"), { statusCode: 400 });
  // Cart reads bypass the catalog snapshot and include every size's current
  // quantity/image. Unpublished/deleted products never become orderable here.
  const products = await Product.find({ _id: { $in: ids }, isPublished: { $ne: false }, isDeleted: { $ne: true } })
    .select("title price sizes stockBySize inStockBySize sizeImages images category type inStock inventoryMode isPublished").lean();
  res.json({ success: true, products: products.map(product => ({ ...product, images: product.images?.slice(0, 1) || [] })) });
});
