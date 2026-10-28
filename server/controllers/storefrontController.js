import { isObjectIdOrHexString } from "mongoose";
import Product from "../models/Product.js";
import { browseCatalog, getStorefrontCatalog, needsFragranceProfiles, parseBrowseQuery, relatedCatalog } from "../services/storefrontCatalog.js";
import { collectPerfumeFilters } from "../services/perfumeFilters.js";

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
  res.json(browseCatalog(await getStorefrontCatalog(needsFragranceProfiles(options.facets)), options));
});
export const productFilters = action(async (_req, res) => {
  res.json({ success: true, options: collectPerfumeFilters(await getStorefrontCatalog(true)) });
});
export const relatedProducts = action(async (req, res) => {
  if (!isObjectIdOrHexString(req.query.productId)) throw Object.assign(new Error("Mã sản phẩm không hợp lệ"), { statusCode: 400 });
  res.json(relatedCatalog(await getStorefrontCatalog(), req.query.productId));
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
