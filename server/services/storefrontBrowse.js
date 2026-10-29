import Product from "../models/Product.js";
import { browseCatalog, catalogSnapshot, getStorefrontCatalog, needsFragranceProfiles, toProductCard } from "./storefrontCatalog.js";
import { filterKey } from "./perfumeFilters.js";

const visible = { isPublished: { $ne: false }, isDeleted: { $ne: true } };
const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const exact = value => new RegExp(`^\\s*${value.normalize("NFC").trim().split(/\s+/).map(escape).join("\\s+")}\\s*$`, "i");
const projection = Object.fromEntries("title price sizes stockBySize inStockBySize category type brand inStock inventoryMode isPublished popular createdAt".split(" ").map(field => [field, 1]));
const sizeValue = field => ({ $let: { vars: { item: { $arrayElemAt: [{ $filter: { input: { $objectToArray: { $ifNull: [`$${field}`, {}] } }, as: "pair", cond: { $eq: ["$$pair.k", "$$size"] } } }, 0] } }, in: "$$item.v" } });
const quantity = { $convert: { input: sizeValue("stockBySize"), to: "double", onError: 0, onNull: 0 } };
const positiveQuantity = value => ({ $and: [{ $gt: [value, 0] }, { $lte: [value, Number.MAX_SAFE_INTEGER] }, { $eq: [value, { $trunc: value }] }] });
// Evaluate the same per-size enabled/quantity rules as productStock.js inside
// MongoDB; return only the requested cards instead of shipping the catalog to Node.
export const availableSizesExpression = { $filter: { input: { $ifNull: ["$sizes", []] }, as: "size", cond: {
  $let: { vars: { quantity, enabled: sizeValue("inStockBySize") }, in: { $and: [
    { $ifNull: ["$inStock", false] },
    { $or: [{ $eq: ["$inventoryMode", "source"] }, positiveQuantity("$$quantity")] },
    { $cond: [{ $eq: [{ $type: "$$enabled" }, "bool"] }, "$$enabled", positiveQuantity("$$quantity")] },
  ] } },
} } };
const maxAvailablePrice = { $reduce: { input: availableSizesExpression, initialValue: 0, in: {
  $max: ["$$value", { $let: { vars: { size: "$$this" }, in: { $convert: { input: sizeValue("price"), to: "double", onError: 0, onNull: 0 } } } }],
} } };

const metadata = () => catalogSnapshot("browse-metadata", 10000, async () => {
  const [result = {}] = await Product.aggregate([{ $match: visible }, { $facet: {
    types: [{ $group: { _id: { brand: "$brand", category: "$category", type: "$type" } } }],
    categories: [{ $group: { _id: "$category" } }],
    price: [{ $project: { maximum: maxAvailablePrice } }, { $group: { _id: null, maximum: { $max: "$maximum" } } }],
  } }]);
  return { types: (result.types || []).map(row => row._id), categories: (result.categories || []).map(row => row._id).filter(Boolean), maxPrice: result.price?.[0]?.maximum || 0 };
});

export const canPageBrowseDirectly = options => options.sort === "relevant" && options.minPrice === 0 && options.maxPrice === Infinity
  && !needsFragranceProfiles(options.facets) && !options.facets?.sizes?.length;

const basicFacetFilters = facets => {
  const clauses = [];
  for (const [facet, field] of [["brands", "brand"], ["origins", "origin"]]) if (facets[facet]?.length) clauses.push({ [field]: { $in: facets[facet].map(exact) } });
  if (facets.concentrations?.length) {
    const values = facets.concentrations.map(exact);
    clauses.push({ $or: [{ concentration: { $in: values } }, { concentration: { $in: ["", null] }, type: { $in: values } }] });
  }
  if (facets.gender?.length) {
    const genders = ["Nam", "Nữ", "Unisex"], selected = genders.filter(value => facets.gender.some(item => filterKey(value) === filterKey(item)));
    const categories = selected.map(value => ({ Nam: "Nước hoa nam", "Nữ": "Nước hoa nữ", Unisex: "Nước hoa unisex" })[value]);
    clauses.push({ $or: [{ gender: { $in: selected.map(exact) } }, { gender: { $nin: genders.map(exact) }, category: { $in: categories } }] });
  }
  return clauses;
};

export const readStorefrontBrowse = async options => {
  if (!canPageBrowseDirectly(options)) return browseCatalog(await getStorefrontCatalog(needsFragranceProfiles(options.facets)), options);
  return catalogSnapshot(`browse-page:${JSON.stringify(options)}`, 10000, async () => {
    const meta = await metadata();
    const availableTypes = [...new Set(meta.types.filter(row => (!options.brand || filterKey(row.brand) === options.brand)
      && (!options.categories.length || options.categories.includes(row.category))).map(row => row.type).filter(Boolean))].sort();
    const activeTypes = options.types.filter(type => availableTypes.includes(type));
    const clauses = basicFacetFilters(options.facets || {});
    if (options.brand) clauses.push({ brand: exact(options.brand) });
    if (options.categories.length) clauses.push({ category: { $in: options.categories } });
    if (activeTypes.length) clauses.push({ type: { $in: activeTypes } });
    if (options.q) clauses.push({ title: { $regex: escape(options.q), $options: "i" } });
    if (options.availability !== "all") clauses.push({ $expr: { $gt: [{ $size: availableSizesExpression }, 0] } });
    const match = { ...visible, ...(clauses.length ? { $and: clauses } : {}) };
    const base = [{ $match: match }, { $sort: { createdAt: -1, _id: -1 } }];
    const readPage = async page => {
      const [result = {}] = await Product.aggregate([...base, { $facet: {
        total: [{ $count: "count" }],
        products: [{ $skip: (page - 1) * options.limit }, { $limit: options.limit }, { $project: { ...projection, images: { $slice: [{ $ifNull: ["$images", []] }, 1] } } }],
      } }]);
      return { total: result.total?.[0]?.count || 0, products: result.products || [] };
    };
    let result = await readPage(options.page);
    const totalPages = Math.max(1, Math.ceil(result.total / options.limit)), page = Math.min(options.page, totalPages);
    if (page !== options.page && result.total > 0) result = await readPage(page);
    return { success: true, products: result.products.map(product => toProductCard({ ...product, _id: String(product._id) })),
      total: result.total, page, totalPages, pageSize: options.limit,
      filters: { types: availableTypes, categories: meta.categories, maxPrice: meta.maxPrice } };
  });
};

export const readStorefrontRelated = id => catalogSnapshot(`related-page:${id}`, 10000, async () => {
  const product = await Product.findOne({ ...visible, _id: id }).select("category type").lean();
  if (!product) return { success: true, products: [], isFallback: false };
  const projectionWithImage = { ...projection, images: { $slice: 1 } };
  const filter = { ...visible, _id: { $ne: id } };
  const related = product.category?.trim() ? await Product.find({ ...filter, category: exact(product.category) })
    .select(projectionWithImage).sort({ createdAt: -1, _id: -1 }).limit(6).lean() : [];
  if (related.length) return { success: true, products: related.map(row => toProductCard({ ...row, _id: String(row._id) })), isFallback: false };
  const candidates = await Product.aggregate([{ $match: { ...visible, _id: { $ne: product._id } } },
    { $set: { _score: { $add: [product.type?.trim() ? { $cond: [{ $regexMatch: { input: { $ifNull: ["$type", ""] }, regex: exact(product.type) } }, 2, 0] } : 0, { $cond: ["$popular", 1, 0] }] } } },
    { $sort: { _score: -1, createdAt: -1, _id: -1 } }, { $limit: 6 },
    { $project: { ...projection, images: { $slice: [{ $ifNull: ["$images", []] }, 1] } } },
  ]);
  return { success: true, products: candidates.map(row => toProductCard({ ...row, _id: String(row._id) })), isFallback: true };
});
