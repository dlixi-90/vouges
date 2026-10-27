import Product from "../models/Product.js";
import FragranceTerm from "../models/FragranceTerm.js";
import { hasAnyAvailableSize } from "../utils/productStock.js";
import brandImages from "../data/brandImages.json" with { type: "json" };

const nameKey = value => value.normalize("NFC").trim().toLocaleLowerCase("vi-VN");
const logoKey = value => nameKey(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
const urlKey = value => (value || "").replace(/\/+$/, "").toLowerCase();

export const buildPublicBrands = (products, terms, images = brandImages.brands) => {
  const byName = new Map(terms.filter(term => term.name).map(term => [nameKey(term.name), term]));
  const byLogoName = new Map(images.map(item => [logoKey(item.name), item]));
  const bySource = new Map(images.map(item => [urlKey(item.sourceUrl), item]));
  const grouped = new Map();
  for (const product of products) {
    if (product.isPublished === false || product.isDeleted || typeof product.brand !== "string" || !product.brand.trim()) continue;
    const name = product.brand.normalize("NFC").trim(), key = nameKey(name);
    if (!grouped.has(key)) {
      const term = byName.get(key), image = bySource.get(urlKey(term?.sourceUrl)) || byLogoName.get(logoKey(name));
      grouped.set(key, { name, image: term?.image || image?.image || "", productCount: 0, availableCount: 0 });
    }
    const brand = grouped.get(key);
    brand.productCount++;
    if (hasAnyAvailableSize(product)) brand.availableCount++;
  }
  return [...grouped.values()].sort((a, b) => a.name.localeCompare(b.name, "vi", { sensitivity: "base", numeric: true }));
};

export const getPublicBrands = async () => {
  const [products, terms] = await Promise.all([
    Product.find({ isPublished: { $ne: false }, isDeleted: { $ne: true }, brand: { $type: "string", $ne: "" } })
      .select("brand sizes inventoryMode stockBySize inStockBySize inStock isPublished isDeleted").lean(),
    FragranceTerm.find({ kind: "brand" }).select("name image sourceUrl").lean(),
  ]);
  return buildPublicBrands(products, terms);
};
