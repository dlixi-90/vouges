import { createResourceCache } from "./resourceCache.js";

export const COLLECTION_PAGE_SIZE = 15;

export const normalizeBrowseParams = (params = {}) => {
  const values = { page: 1, limit: COLLECTION_PAGE_SIZE, availability: "available", sort: "relevant", minPrice: 0, ...params };
  try {
    const facets = values.facets === undefined ? {} : JSON.parse(values.facets);
    values.facets = JSON.stringify(Object.fromEntries(Object.entries(facets).filter(([, selected]) => selected.length).sort(([a], [b]) => a.localeCompare(b))));
  } catch { /* Leave malformed filters for the API to reject. */ }
  return Object.fromEntries(Object.entries(values).filter(([field, value]) => value !== undefined && !(value === "" && ["q", "brand"].includes(field))));
};

export const createPublicCatalog = ({ axios, cache = createResourceCache({ maxAge: 15000, maxEntries: 60 }) }) => {
  const metadata = createResourceCache({ maxAge: 300000, maxEntries: 4 });
  const read = async (url, params, signal) => {
    const { data } = await axios.get(url, { params, signal, timeout: 15000 });
    if (!data.success) throw new Error(data.message || "Không thể tải sản phẩm.");
    return data;
  };
  const key = params => JSON.stringify(Object.entries(params).filter(([, value]) => value !== undefined).sort(([a], [b]) => a.localeCompare(b)));
  return {
    clear: () => { cache.clear(); metadata.clear(); },
    browseKey: params => `browse:${key(normalizeBrowseParams(params))}`,
    peekBrowse: params => cache.peek(`browse:${key(normalizeBrowseParams(params))}`),
    browse: (params = {}, options) => cache.load(`browse:${key(normalizeBrowseParams(params))}`, signal => read("/api/products/browse", normalizeBrowseParams(params), signal), options),
    peekDetail: id => cache.peek(`detail:${id}`),
    detail: (id, options) => cache.load(`detail:${id}`, signal => read("/api/products/single", { productId: id }, signal), options),
    related: id => cache.load(`related:${id}`, signal => read("/api/products/related", { productId: id }, signal)),
    brands: options => metadata.load("brands", signal => read("/api/products/brands", {}, signal), options),
    peekBrands: () => metadata.peek("brands"),
    filters: options => metadata.load("filters", signal => read("/api/products/filters", {}, signal), options),
    peekFilters: () => metadata.peek("filters"),
    batch: async ids => {
      const unique = [...new Set(ids)].sort(), chunks = [];
      for (let index = 0; index < unique.length; index += 100) chunks.push(unique.slice(index, index + 100));
      const responses = await Promise.all(chunks.map(chunk => axios.get("/api/products/batch", { params: { ids: chunk.join(",") }, timeout: 15000 })));
      if (responses.some(({ data }) => !data.success)) throw new Error("Không thể tải sản phẩm trong giỏ.");
      return responses.flatMap(({ data }) => data.products);
    },
  };
};
