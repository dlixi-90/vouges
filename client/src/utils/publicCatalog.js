import { createResourceCache } from "./resourceCache.js";

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
    browseKey: params => `browse:${key(params)}`,
    peekBrowse: params => cache.peek(`browse:${key(params)}`),
    browse: (params = {}, options) => cache.load(`browse:${key(params)}`, signal => read("/api/products/browse", params, signal), options),
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
