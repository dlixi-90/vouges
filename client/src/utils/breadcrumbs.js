import { STORE_CATEGORIES } from "../data/storeNavigation.js";

const normalized = value => String(value || "").normalize("NFC").trim().toLocaleLowerCase("vi-VN");
const categoryForGender = { nam: "Nước hoa nam", nữ: "Nước hoa nữ", unisex: "Nước hoa unisex" };
const knownCategory = value => STORE_CATEGORIES.find(category => normalized(category) === normalized(value)) || "";

export const productBreadcrumbCategory = product => {
  const gender = normalized(product.gender);
  return (Object.hasOwn(categoryForGender, gender) ? categoryForGender[gender] : "") || knownCategory(product.category);
};

export function collectionBreadcrumbUrl(category = "", brand = "") {
  const params = new URLSearchParams();
  if (category) params.set("category", category);
  if (brand) params.set("brand", brand);
  return `/collection${params.size ? `?${params}` : ""}`;
}

export function productBreadcrumbs(product) {
  const category = productBreadcrumbCategory(product), brand = String(product.brand || "").trim();
  return [
    { label: category || "Bộ sưu tập", to: collectionBreadcrumbUrl(category) },
    ...(brand ? [{ label: brand, to: collectionBreadcrumbUrl(category, brand) }] : []),
    { label: product.title },
  ];
}

export function collectionBreadcrumbs({ category = "", brand = "" } = {}) {
  const selected = knownCategory(category);
  return [
    { label: selected || "Bộ sưu tập", ...(brand ? { to: collectionBreadcrumbUrl(selected) } : {}) },
    ...(brand ? [{ label: brand }] : []),
  ];
}
