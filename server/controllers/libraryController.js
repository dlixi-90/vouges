import FragranceTerm from "../models/FragranceTerm.js";
import Product from "../models/Product.js";
import { catalogSnapshot, toProductCard } from "../services/storefrontCatalog.js";
import { sanitizeArticle, LIBRARY_ARTICLE_LIMITS } from "../../client/src/utils/productArticle.js";
import { LIBRARY_KINDS, librarySlug } from "../../client/src/utils/fragranceLibrary.js";
import {libraryImage, libraryReference, publicDirectoryOverview, libraryOriginIds, libraryTermOrigins, libraryEnglishName} from "../services/libraryDirectory.js";
import {libraryProductRelation} from "../services/libraryRelations.js";

const fail = (message, statusCode = 400) => { throw Object.assign(new Error(message), { statusCode }); };
const readText = value => {
  if (value === undefined) return "";
  if (typeof value !== "string" || value.length > 200) fail("Từ khóa không hợp lệ.");
  return value.normalize("NFC").trim();
};
const nameKey = value => value.normalize("NFC").trim().toLocaleLowerCase("vi-VN");
const foldText = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d").toLocaleLowerCase("vi-VN").trim();
const action = handler => async (req, res) => {
  try {
    res.set("Cache-Control", "no-store");
    if (!Object.hasOwn(LIBRARY_KINDS, req.params.kind)) fail("Không tìm thấy thư viện.", 404);
    await handler(req, res);
  } catch (error) {
    if (!error.statusCode) console.error(error);
    res.status(error.statusCode || 500).json({ success: false, message: error.statusCode ? error.message : "Không thể tải thư viện. Vui lòng thử lại." });
  }
};
const directory = kind => catalogSnapshot(`library-directory:${kind}`, 30000, async () => {
  const rows = await FragranceTerm.find({ kind }).select("kind key name slug contentStatus image").lean();
  return rows.filter(t => t.name?.trim()).map(term => ({ id: String(term._id), kind, name: term.name, englishName: libraryEnglishName(term), slug: librarySlug(term), contentStatus: term.contentStatus, image: libraryImage(term.image), originIds: libraryTermOrigins(kind, String(term._id)) }))
    .sort((a, b) => a.name.localeCompare(b.name, "vi", { sensitivity: "base", numeric: true }));
});
export const publicLibraryTerms = action(async (req, res) => {
  const view = readText(req.query.view);
  if (view && view !== "directory") fail("Cách hiển thị thư viện không hợp lệ.");
  const q = nameKey(readText(req.query.q));
  const origin=readText(req.query.origin),ids=origin?libraryOriginIds(req.params.kind,origin):null;
  if(origin&&!ids)fail("Không tìm thấy nhóm nguồn gốc này.",404);
  const page = Number(req.query.page ?? 1);
  if (!Number.isSafeInteger(page) || page < 1 || page > 10000) fail("Phân trang không hợp lệ.");
  const allowed=ids?new Set(ids):null;
  const rows = (await directory(req.params.kind)).filter(t => (!allowed||allowed.has(t.id))&&(!q || nameKey(t.name).includes(q) || foldText(t.name).includes(foldText(q)) || (t.englishName && foldText(t.englishName).includes(foldText(q)))));
  if (view === "directory" && rows.length > 2000) fail("Thư viện vượt giới hạn hiển thị. Vui lòng tìm kiếm theo tên.", 413);
  const pageSize = view === "directory" ? Math.max(1, rows.length) : 24, totalPages = Math.max(1, Math.ceil(rows.length / pageSize)), active = Math.min(page, totalPages);
  res.set("Cache-Control", "public, max-age=10, s-maxage=60, stale-while-revalidate=120");
  res.json({ success: true, terms: rows.slice((active - 1) * pageSize, active * pageSize), total: rows.length, page: active, pageSize, totalPages, overview:publicDirectoryOverview(req.params.kind) });
});
export function libraryProductFilter(term) {
  return { isPublished: { $ne: false }, isDeleted: { $ne: true }, ...libraryProductRelation(term) };
}
export const publicLibraryTerm = action(async (req, res) => {
  const slug = readText(req.params.slug), name = readText(req.query.name), page = Number(req.query.page ?? 1);
  if ((!slug && !name) || !Number.isSafeInteger(page) || page < 1 || page > 10000) fail("Thông tin trang không hợp lệ.");
  const rows = await directory(req.params.kind);
  const matches = rows.filter(t => slug ? t.slug === slug : nameKey(t.name) === nameKey(name));
  if (matches.length !== 1) fail("Không tìm thấy nội dung này.", 404);
  const payload = await catalogSnapshot(`library-term:${req.params.kind}:${matches[0].id}:${page}`, 30000, async () => {
    const source = await FragranceTerm.findById(matches[0].id).select("kind key name description descriptionContent contentStatus sourceUrl contentImport.relatedHeading").lean();
    if (!source) fail("Không tìm thấy nội dung này.", 404);
    const filter = libraryProductFilter(source), pageSize = 15;
    const projection = { ...Object.fromEntries("title price sizes stockBySize inStockBySize category type brand inStock inventoryMode isPublished popular createdAt".split(" ").map(field => [field, 1])), images: { $slice: 1 } };
    let total, totalPages, active, products;
    if (page === 1) {
      [total, products] = await Promise.all([
        Product.countDocuments(filter),
        Product.find(filter).select(projection).sort({ createdAt: -1, _id: -1 }).skip(0).limit(pageSize).lean(),
      ]);
      totalPages = Math.max(1, Math.ceil(total / pageSize));
      active = 1;
    } else {
      total = await Product.countDocuments(filter);
      totalPages = Math.max(1, Math.ceil(total / pageSize));
      active = Math.min(page, totalPages);
      products = await Product.find(filter).select(projection).sort({ createdAt: -1, _id: -1 }).skip((active - 1) * pageSize).limit(pageSize).lean();
    }
    // Publish an explicit reading reference; keep import evidence and internal keys private.
    return {
      success: true,
      term: { ...matches[0], description: source.description, descriptionContent: source.descriptionContent ? sanitizeArticle(source.descriptionContent, LIBRARY_ARTICLE_LIMITS) : null, contentStatus: source.contentStatus, relatedHeading:typeof source.contentImport?.relatedHeading==='string'?source.contentImport.relatedHeading.slice(0,500):'', referenceUrl:libraryReference(source.sourceUrl) },
      products: products.map(p => toProductCard({ ...p, _id: String(p._id) })),
      total, page: active, totalPages, pageSize,
    };
  });
  res.set("Cache-Control", "public, max-age=10, s-maxage=60, stale-while-revalidate=120");
  res.json(payload);
});
