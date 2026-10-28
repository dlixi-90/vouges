import { createResourceCache } from "./resourceCache.js";

export const createStoreResources = ({ cache = createResourceCache(), axios, userId, getToken }) => {
  const memberKey = `membership:${userId}`;
  const reviewKey = (productId, page = 1) => `reviews:${productId}:${page}`;
  const ownKey = (productId) => `own-review:${userId}:${productId}`;
  const read = async (url, signal, authenticated = false, params) => {
    const headers = authenticated ? { Authorization: `Bearer ${await getToken()}` } : undefined;
    signal.throwIfAborted();
    const { data } = await axios.get(url, { headers, params, signal, timeout: 15000 });
    if (!data.success) throw new Error(data.message || "Không thể tải dữ liệu. Vui lòng thử lại.");
    return data;
  };
  return {
    clear: () => cache.clear(),
    peekCatalog: (path, root = "/api/catalog") => cache.peek(`catalog:${root}${path}`),
    setCatalog: (path, root, data) => cache.set(`catalog:${root}${path}`, data),
    invalidateCatalog: () => cache.invalidate("catalog:"),
    loadCatalog: (path, root = "/api/catalog", options) => cache.load(`catalog:${root}${path}`,
      signal => read(`${root}${path}`, signal, true), options),
    peekSupportInbox: path => cache.peek(`support-inbox:${path}`),
    setSupportInbox: (path, data) => cache.set(`support-inbox:${path}`, data),
    invalidateSupport: () => cache.invalidate("support-inbox:"),
    loadSupportInbox: (path, options) => cache.load(`support-inbox:${path}`, signal => read(path, signal, true), options),
    peekMembership: () => cache.peek(memberKey),
    invalidateMembership: () => cache.invalidate(memberKey),
    loadMembership(options) {
      if (!userId) return Promise.resolve(null);
      return cache.load(memberKey, async (signal) => {
        const data = await read("/api/vouchers/mine", signal, true);
        return { userId, profile: data.profile, vouchers: data.vouchers || [] };
      }, options);
    },
    peekReviews: (productId, page = 1) => cache.peek(reviewKey(productId, page)),
    invalidateReviews: (productId) => cache.invalidate(`reviews:${productId}:`),
    loadReviews: (productId, page = 1, options) => cache.load(reviewKey(productId, page),
      (signal) => read(`/api/products/${productId}/reviews`, signal, false, { page }), options),
    peekOwnReview: (productId) => cache.peek(ownKey(productId)),
    setOwnReview: (productId, data) => cache.set(ownKey(productId), { ...data, userId }),
    loadOwnReview(productId, options) {
      if (!userId) return Promise.resolve(null);
      return cache.load(ownKey(productId), async (signal) => ({
        ...await read(`/api/products/${productId}/reviews/mine`, signal, true), userId,
      }), options);
    },
  };
};
