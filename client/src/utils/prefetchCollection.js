import { prefetchRoute } from "./prefetchRoute.js";

// Match the collection's default request so hover/focus and navigation share it.
export const prefetchCollection = (publicCatalog, href = "/collection", q = "") => {
  prefetchRoute(href);
  const [pathname, query] = href.split("?");
  if (pathname !== "/collection") return;
  const params = new URLSearchParams(query);
  const gender = ({ "Nước hoa nam": "Nam", "Nước hoa nữ": "Nữ", "Nước hoa unisex": "Unisex" })[params.get("category")];
  const brand = params.get("brand");
  void publicCatalog.browse({ q, facets: JSON.stringify({ ...(gender ? { gender: [gender] } : {}), ...(brand ? { brands: [brand] } : {}) }) }).catch(() => {});
};
