import crypto from "node:crypto";
import mongoose from "mongoose";

export const catalogId = (key) => new mongoose.Types.ObjectId(crypto.createHash("sha256").update(`velours:apaniche:${key}`).digest("hex").slice(0, 24));
const normal = (value = "") => String(value).normalize("NFC").trim().replace(/\s+/g, " ");
const slug = (value = "") => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replaceAll("đ", "d").replaceAll("Đ", "D").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export const safeSizeKey = (label, id, used = new Set()) => {
  let key = normal(label || `SKU ${id}`).replaceAll(".", ",").replace(/^\$/, "");
  if (["__proto__", "constructor", "prototype"].includes(key)) key = `SKU ${id}`;
  if (key.length > 50) key = `${key.slice(0, 38)} · ${id}`;
  if (used.has(key.toLowerCase())) key = `${key.slice(0, 38)} · ${id}`;
  used.add(key.toLowerCase()); return key;
};

export const buildApanicheCatalog = (sources, variants, inventoryMode = "source") => {
  const byProduct = new Map();
  for (const variant of variants) { const list = byProduct.get(variant.productId) || []; list.push(variant); byProduct.set(variant.productId, list); }
  const terms = new Map(), categories = new Map(); const now = new Date();
  const addTerm = (kind, name, sourceUrl = "", productId) => {
    if (!name && !sourceUrl) return;
    const key = sourceUrl || slug(name); const termKey = `${kind}:${key}`;
    if (!terms.has(termKey)) terms.set(termKey, { _id: catalogId(termKey), kind, key, name: normal(name), sourceUrl, description: "", image: "", contentStatus: "linked", productIds: new Set() });
    terms.get(termKey).productIds.add(String(productId));
  };
  const products = sources.map((source) => {
    const data = source.detail?.data || {}; const specs = data.specifications || {};
    const get = (key) => normal(specs[key]?.value || "");
    const brand = get("thương hiệu") || normal(source.brands?.[0]?.name || "");
    const gender = get("giới tính"); const concentration = get("nồng độ");
    const ancillary = (source.categories || []).some((category) => ["my-pham", "lan-khu-mui", "nen-thom", "son", "my-pham-khac"].includes(slug(category.name)))
      || /nến thơm|lăn khử mùi|deodorant|body lotion|shampoo|sữa tắm|son môi/i.test(source.name);
    const catalogScope = ancillary ? "other" : "perfume";
    const genderKey = slug(gender);
    const category = ancillary ? "Ngoài danh mục nước hoa" : genderKey.includes("unisex") ? "Nước hoa unisex" : genderKey === "nam" ? "Nước hoa nam" : genderKey === "nu" ? "Nước hoa nữ" : "Nước hoa chưa phân loại";
    const type = concentration || "Chưa xác định nồng độ";
    if (!categories.has(category)) categories.set(category, new Set()); categories.get(category).add(type);
    const id = catalogId(`product:${source.sourceId}`);
    const price = {}, sizeImages = {}, stockBySize = {}, inStockBySize = {}, variantMetadata = {}, sizes = [], used = new Set();
    const options = byProduct.get(source.sourceId) || [];
    const normalizedOptions = options.length ? options : [{ sourceId: source.sourceId, sizeLabel: source.attributes?.find((attribute) => attribute.varies)?.terms?.[0]?.name || "Tiêu chuẩn", price: source.price, regularPrice: source.regularPrice, inStock: source.inStock, purchasable: source.purchasable, imageUrl: source.images?.[0]?.url }];
    for (const variant of normalizedOptions) {
      const key = safeSizeKey(variant.sizeLabel, variant.sourceId, used);
      const amount = Number.isSafeInteger(variant.price) && variant.price >= 0 ? variant.price : 0;
      sizes.push(key); price[key] = amount; stockBySize[key] = 0;
      inStockBySize[key] = variant.inStock === true && variant.purchasable !== false && amount > 0;
      if (variant.imageUrl) sizeImages[key] = variant.imageUrl;
      variantMetadata[key] = { sourceId: variant.sourceId, sku: variant.sku || `APA-${variant.sourceId}`, label: variant.sizeLabel || key, regularPrice: variant.regularPrice ?? null, sourceAvailable: variant.inStock ?? null, sourceUrl: variant.sourceUrl || source.sourceUrl };
    }
    const qualityIssues = new Set();
    if (!brand) qualityIssues.add("missing_brand"); if (!concentration) qualityIssues.add("missing_concentration");
    if (!get("nhóm hương")) qualityIssues.add("missing_scent_group");
    if (!source.images?.length) qualityIssues.add("missing_images");
    if (!Object.keys(data.scentNotes || {}).length) qualityIssues.add("missing_scent_notes");
    if (Object.values(price).some((amount) => amount === 0)) qualityIssues.add("zero_source_price");
    for (const item of [...(data.suitability || []), ...(data.longevity || []), ...(data.sillage || [])]) if (item.sourceValueIssue || item.sourceCountIssue) qualityIssues.add("source_assessment_anomaly");
    const product = {
      _id: id, title: normal(source.name), description: [normal(source.name), brand, concentration, gender].filter(Boolean).join(" · "), ingredients: "",
      price, sizes, stockBySize, inStockBySize, sizeImages, images: (source.images || []).map((image) => image.url).filter(Boolean),
      category, type, brand, concentration, gender, origin: get("xuất xứ"), catalogScope,
      isPublished: !ancillary, inStock: source.inStock === true && Object.values(inStockBySize).some(Boolean), inventoryMode,
      popular: false, isDeleted: false, qualityIssues: [...qualityIssues], variantMetadata,
      fragrance: { group: get("nhóm hương"), style: get("phong cách"), notes: data.scentNotes || {}, accords: data.accords || [], longevity: data.longevity || [], sillage: data.sillage || [], suitability: data.suitability || [], assessmentProvenance: data.assessmentProvenance || { methodologyVerified: false }, assessmentsVisible: true },
      source: { provider: "apaniche", id: source.sourceId, url: source.sourceUrl, fetchedAt: source.detail?.fetchedAt || source.apiFetchedAt }, createdAt: now, updatedAt: now,
    };
    addTerm("brand", brand, specs["thương hiệu"]?.links?.[0]?.url || "", id);
    for (const item of specs["nhóm hương"]?.links || []) addTerm("group", item.label, item.url, id);
    for (const item of data.accords || []) addTerm("accord", item.label, item.url || "", id);
    for (const phase of Object.values(data.scentNotes || {})) for (const item of phase) addTerm("note", item.name, item.url, id);
    return product;
  });
  return {
    products,
    categories: [...categories].map(([name, types]) => ({ _id: catalogId(`category:${name}`), name, nameKey: name.toLowerCase(), storefrontVisible: !name.startsWith("Ngoài"), types: [...types].map((typeName) => ({ _id: catalogId(`type:${name}:${typeName}`), name: typeName, nameKey: typeName.toLowerCase() })), createdAt: now, updatedAt: now })),
    terms: [...terms.values()].map(({ productIds, ...term }) => ({ ...term, productCount: productIds.size, createdAt: now, updatedAt: now })),
    sources: sources.map((source) => ({ _id: catalogId(`record:${source.sourceId}`), provider: "apaniche", sourceId: source.sourceId, productId: catalogId(`product:${source.sourceId}`), sourceUrl: source.sourceUrl, fetchedAt: new Date(source.detail?.fetchedAt || source.apiFetchedAt), data: source, createdAt: now, updatedAt: now })),
  };
};
