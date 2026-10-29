import Product from "../models/Product.js";
import { invalidatePublicBrands } from "./publicBrands.js";
import { isSizeAvailable, hasAnyAvailableSize } from "../utils/productStock.js";
import { selectRelatedProducts } from "../../client/src/utils/relatedProducts.js";
import { productFilterValues, parsePerfumeFilters, matchesPerfumeFilters } from "./perfumeFilters.js";

const fields = "title price sizes stockBySize inStockBySize images category type brand gender origin concentration inStock inventoryMode isPublished popular createdAt";
const profileFields = "fragrance.notes.top.name fragrance.notes.middle.name fragrance.notes.base.name fragrance.accords.label fragrance.style fragrance.longevity.label fragrance.longevity.displayedCount fragrance.sillage.label fragrance.sillage.displayedCount fragrance.suitability.label fragrance.suitability.displayedPercent";
const profileKeys = ["longevity", "sillage", "suitability", "notes", "accords", "styles"];
const dominantRows = field => ({ $let: { vars: { rows: { $filter: { input: { $ifNull: [`$fragrance.${field}`, []] }, as: "row", cond: {
  $and: [{ $isNumber: "$$row.displayedCount" }, { $gt: ["$$row.displayedCount", 0] }, { $lte: ["$$row.displayedCount", Number.MAX_SAFE_INTEGER] }, { $eq: ["$$row.displayedCount", { $trunc: { $convert: { input: "$$row.displayedCount", to: "double", onError: 0, onNull: 0 } } }] }],
} } } }, in: { $map: { input: { $filter: { input: "$$rows", as: "row", cond: { $eq: ["$$row.displayedCount", { $max: "$$rows.displayedCount" }] } } }, as: "row", in: { label: "$$row.label", displayedCount: "$$row.displayedCount" } } } } });
const visible = { isPublished: { $ne: false }, isDeleted: { $ne: true } };
const entries = new Map();
let revision = 0;
// A small, bounded server snapshot shares simultaneous public reads. Prices and
// stock are always checked again by the cart/checkout APIs against MongoDB.
export const invalidateStorefrontCatalog = () => { revision++; entries.clear(); invalidatePublicBrands(); };
export const catalogSnapshot = (key, maxAge, read) => {
  const existing = entries.get(key);
  if (existing?.pending) return existing.pending;
  if (existing && Date.now() < existing.expiresAt) return Promise.resolve(existing.data);
  const generation = revision;
  const entry = {};
  entries.set(key, entry);
  // Page/search snapshots share this store; keep it bounded between writes.
  for (const [oldKey, oldEntry] of entries) {
    if (entries.size <= 64) break;
    if (oldKey !== key && !oldEntry.pending) entries.delete(oldKey);
  }
  entry.pending = Promise.resolve().then(read).then(data => {
    if (revision === generation && entries.get(key) === entry) { entry.data = data; entry.expiresAt = Date.now() + maxAge; }
    return data;
  }).finally(() => { entry.pending = null; });
  return entry.pending;
};
export const needsFragranceProfiles = filters => profileKeys.some(key => filters?.[key]?.length);
export const getStorefrontCatalog = async (includeProfiles = false) => {
  const cards = catalogSnapshot("cards", 10000, async () => {
    const projection = { ...Object.fromEntries(fields.split(" ").map(field => [field, 1])), images: { $slice: 1 } };
    const products = await Product.find(visible).select(projection).sort({ createdAt: -1, _id: -1 }).lean();
    return products.map(product => ({ ...product, _id: String(product._id), images: product.images?.slice(0, 1) || [], _filters: productFilterValues(product) }));
  });
  if (!includeProfiles) return cards;
  // Fragrance descriptions/votes are loaded only for the advanced filter, and
  // separately cached from frequently changing quantities and prices.
  const profiles = catalogSnapshot("profiles", 300000, async () => {
    const projection = Object.fromEntries(profileFields.split(" ").filter(field => !field.includes("longevity") && !field.includes("sillage") && !field.includes("suitability")).map(field => [field, 1]));
    const products = await Product.aggregate([{ $match: visible }, { $project: { ...projection,
      "fragrance.longevity": dominantRows("longevity"), "fragrance.sillage": dominantRows("sillage"),
      "fragrance.suitability": { $map: { input: { $filter: { input: { $ifNull: ["$fragrance.suitability", []] }, as: "row", cond: { $and: [{ $isNumber: "$$row.displayedPercent" }, { $gte: ["$$row.displayedPercent", 50] }, { $lte: ["$$row.displayedPercent", 100] }] } } }, as: "row", in: { label: "$$row.label", displayedPercent: "$$row.displayedPercent" } } },
    } }]);
    return new Map(products.map(product => [String(product._id), productFilterValues(product)]));
  });
  const [products, metadata] = await Promise.all([cards, profiles]);
  return products.map(product => ({ ...product, _filters: { ...product._filters,
    ...Object.fromEntries(profileKeys.map(key => [key, metadata.get(product._id)?.[key] || []])) } }));
};
export const getDisplayedPrice = product => {
  const size = product.sizes?.find(size => isSizeAvailable(product, size));
  return size ? Number(product.price?.[size]) : Infinity;
};
const fail = () => { throw Object.assign(new Error("Bộ lọc sản phẩm không hợp lệ"), { statusCode: 400 }); };
const text = value => {
  if (value === undefined) return "";
  if (typeof value !== "string" || value.length > 200) fail();
  return value;
};
const list = value => {
  if (!value) return [];
  try {
    const values = JSON.parse(text(value));
    if (!Array.isArray(values) || values.length > 20 || values.some(item => typeof item !== "string" || item.length > 100)) fail();
    return values;
  } catch { fail(); }
};
const key = value => value.normalize("NFC").trim().toLocaleLowerCase("vi-VN");
export const parseBrowseQuery = query => {
  const page = Number(query.page ?? 1), limit = Number(query.limit ?? 16);
  if (!Number.isSafeInteger(page) || page < 1 || page > 100000 || ![6, 10, 12, 16].includes(limit)) fail();
  const minPrice = Number(query.minPrice ?? 0), maxPrice = query.maxPrice === undefined ? Infinity : Number(query.maxPrice);
  if (!Number.isSafeInteger(minPrice) || minPrice < 0 || (query.maxPrice !== undefined && (!Number.isSafeInteger(maxPrice) || maxPrice < minPrice))) fail();
  const sort = query.sort ?? "relevant", availability = query.availability ?? "available";
  if (!["relevant", "low", "high"].includes(sort) || !["available", "all"].includes(availability)) fail();
  return { page, limit, minPrice, maxPrice, sort, availability, q: text(query.q).toLowerCase(),
    brand: key(text(query.brand)), categories: list(query.categories), types: list(query.types), facets: parsePerfumeFilters(query.facets) };
};
export const browseCatalog = (catalog, options) => {
  const { page, limit, minPrice, maxPrice, sort, availability, q, brand, categories, types, facets = {} } = options;
  const availableTypes = [...new Set(catalog.filter(product => (!brand || key(product.brand || "") === brand)
    && (!categories.length || categories.includes(product.category))).map(product => product.type).filter(Boolean))].sort();
  const activeTypes = types.filter(type => availableTypes.includes(type));
  const priceFor = product => {
    const size = displaySize(product);
    return size ? Number(product.price?.[size]) : getDisplayedPrice(product);
  };
  const displaySize = product => {
    const sizes = (product.sizes || []).filter(size => isSizeAvailable(product, size) && (!facets.sizes?.length || facets.sizes.includes(size)));
    return sizes.find(size => Number(product.price?.[size]) >= minPrice && Number(product.price?.[size]) <= maxPrice) || sizes[0];
  };
  let products = catalog.filter(product => (availability === "all" || hasAnyAvailableSize(product))
    && (!brand || key(product.brand || "") === brand) && (!q || product.title.toLowerCase().includes(q))
    && (!categories.length || categories.includes(product.category)) && (!activeTypes.length || activeTypes.includes(product.type))
    && matchesPerfumeFilters(product._filters || productFilterValues(product), facets)
    && (minPrice === 0 && maxPrice === Infinity || priceFor(product) >= minPrice && priceFor(product) <= maxPrice));
  if (sort !== "relevant") products = products.toSorted((a, b) => (priceFor(a) - priceFor(b)) * (sort === "low" ? 1 : -1));
  const total = products.length, totalPages = Math.max(1, Math.ceil(total / limit)), activePage = Math.min(page, totalPages);
  return { success: true, products: products.slice((activePage - 1) * limit, activePage * limit).map(product => ({ ...toProductCard(product),
    ...(facets.sizes?.length || minPrice > 0 || maxPrice !== Infinity ? { displaySize: displaySize(product) } : {}) })), total,
    page: activePage, totalPages, pageSize: limit, filters: { types: availableTypes,
      categories: [...new Set(catalog.map(product => product.category).filter(Boolean))],
      maxPrice: catalog.reduce((max, product) => Math.max(max, ...Object.entries(product.price || {}).filter(([size]) => isSizeAvailable(product, size)).map(([, price]) => Number(price) || 0)), 0) } };
};
export const toProductCard = product => Object.fromEntries(["_id", "title", "price", "sizes", "stockBySize", "inStockBySize", "images", "category", "type", "brand", "inStock", "inventoryMode", "isPublished", "popular", "createdAt"].filter(field => product[field] !== undefined).map(field => [field, product[field]]));
export const relatedCatalog = (catalog, productId) => {
  const product = catalog.find(item => item._id === productId);
  if (!product) return { success: true, products: [], isFallback: false };
  const result = selectRelatedProducts(catalog, product, productId);
  return { success: true, ...result, products: result.products.map(toProductCard) };
};
