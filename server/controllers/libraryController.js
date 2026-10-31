import FragranceTerm from "../models/FragranceTerm.js";
import Product from "../models/Product.js";
import { catalogSnapshot, toProductCard } from "../services/storefrontCatalog.js";
import { sanitizeArticle } from "../../client/src/utils/productArticle.js";
import { LIBRARY_KINDS, librarySlug } from "../../client/src/utils/fragranceLibrary.js";

const fail = (message, statusCode = 400) => { throw Object.assign(new Error(message), { statusCode }); };
const readText = value => {
  if (value === undefined) return "";
  if (typeof value !== "string" || value.length > 200) fail("Từ khóa không hợp lệ.");
  return value.normalize("NFC").trim();
};
const nameKey = value => value.normalize("NFC").trim().toLocaleLowerCase("vi-VN");
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
  const rows = await FragranceTerm.find({ kind }).select("kind key name contentStatus").lean();
  return rows.filter(t => t.name?.trim()).map(term => ({ id: String(term._id), kind, name: term.name, slug: librarySlug(term), contentStatus: term.contentStatus }))
    .sort((a, b) => a.name.localeCompare(b.name, "vi", { sensitivity: "base", numeric: true }));
});
export const publicLibraryTerms = action(async (req, res) => {
  const q = nameKey(readText(req.query.q));
  const page = Number(req.query.page ?? 1);
  if (!Number.isSafeInteger(page) || page < 1 || page > 10000) fail("Phân trang không hợp lệ.");
  const rows = (await directory(req.params.kind)).filter(t => !q || nameKey(t.name).includes(q));
  const pageSize = 24, totalPages = Math.max(1, Math.ceil(rows.length / pageSize)), active = Math.min(page, totalPages);
  res.json({ success: true, terms: rows.slice((active - 1) * pageSize, active * pageSize), total: rows.length, page: active, pageSize, totalPages });
});
const exact = value => new RegExp(`^\\s*${value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, "i");
export function libraryProductFilter(term) {
  const value = exact(term.name);
  let relation;
  if (term.kind === "brand") relation = { brand: value };
  else if (term.kind === "group") relation = { $or: [{ "fragrance.group": value }, { "fragrance.components.group": value }] };
  else if (term.kind === "accord") relation = { "fragrance.accords.label": value };
  else {
    const fields = ["top", "middle", "base", "general"].flatMap(phase => [`fragrance.notes.${phase}`, `fragrance.components.notes.${phase}`]);
    relation = { $or: fields.flatMap(field => [{ [`${field}.name`]: value }, ...(term.sourceUrl ? [{ [`${field}.url`]: term.sourceUrl }] : [])]) };
  }
  return { isPublished: { $ne: false }, isDeleted: { $ne: true }, ...relation };
}
export const publicLibraryTerm = action(async (req, res) => {
  const slug = readText(req.params.slug), name = readText(req.query.name), page = Number(req.query.page ?? 1);
  if ((!slug && !name) || !Number.isSafeInteger(page) || page < 1 || page > 10000) fail("Thông tin trang không hợp lệ.");
  const rows = await directory(req.params.kind);
  const matches = rows.filter(t => slug ? t.slug === slug : nameKey(t.name) === nameKey(name));
  if (matches.length !== 1) fail("Không tìm thấy nội dung này.", 404);
  const source = await FragranceTerm.findById(matches[0].id).select("kind key name description descriptionContent contentStatus sourceUrl").lean();
  if (!source) fail("Không tìm thấy nội dung này.", 404);
  const filter = libraryProductFilter(source), pageSize = 15;
  const total = await Product.countDocuments(filter), totalPages = Math.max(1, Math.ceil(total / pageSize)), active = Math.min(page, totalPages);
  const products = await Product.find(filter).select({ ...Object.fromEntries("title price sizes stockBySize inStockBySize category type brand inStock inventoryMode isPublished popular createdAt".split(" ").map(field => [field, 1])), images: { $slice: 1 } })
    .sort({ createdAt: -1, _id: -1 }).skip((active - 1) * pageSize).limit(pageSize).lean();
  // Source URLs, import evidence and internal keys never appear in public responses.
  res.json({ success: true, term: { ...matches[0], description: source.description, descriptionContent: source.descriptionContent ? sanitizeArticle(source.descriptionContent) : null, contentStatus: source.contentStatus },
    products: products.map(p => toProductCard({ ...p, _id: String(p._id) })), total, page: active, totalPages, pageSize });
});
