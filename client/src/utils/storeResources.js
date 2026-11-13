import { createResourceCache } from "./resourceCache.js";
import { mergeSupportSnapshot } from "./supportChat.js";

export const createStoreResources = ({ cache = createResourceCache(), axios, userId, getToken }) => {
  const catalogCache = createResourceCache({ maxAge: 60000, maxEntries: 80 });
  const supportCache = createResourceCache({ maxAge: 15000, maxEntries: 12 });
  const catalogListeners = new Set();
  const notifyCatalog = () => {
    for (const listener of catalogListeners) listener();
  };
  const memberKey = `membership:${userId}`;
  const reviewKey = (productId, page = 1) => `reviews:${productId}:${page}`;
  const ownKey = (productId) => `own-review:${userId}:${productId}`;
  const ordersKey = page => `customer-orders:${userId}:${page}`;
  const singleOrderKey = orderId => `customer-order:${userId}:${String(orderId || "").toLowerCase()}`;
  const mySupportKey = `mine:${userId}`;
  const addressesKey = `addresses:${userId}`;
  const read = async (url, signal, authenticated = false, params) => {
    const headers = authenticated ? { Authorization: `Bearer ${await getToken()}` } : undefined;
    signal.throwIfAborted();
    const { data } = await axios.get(url, { headers, params, signal, timeout: 15000 });
    if (!data.success) throw new Error(data.message || "Không thể tải dữ liệu. Vui lòng thử lại.");
    return data;
  };
  return {
    clear: () => { cache.clear(); catalogCache.clear(); supportCache.clear(); },
    peekOrders: (page = 1) => cache.peek(ordersKey(page)),
    peekOrder: (orderId) => {
      if (!userId || !orderId) return undefined;
      const direct = cache.peek(singleOrderKey(orderId));
      if (direct) return direct;
      const target = String(orderId).toLowerCase();
      for (let page = 1; page <= 5; page++) {
        const found = cache.peek(ordersKey(page))?.orders?.find(item => String(item?._id || "").toLowerCase() === target);
        if (found) return found;
      }
      return undefined;
    },
    setOrder: (order) => {
      if (userId && order?._id) cache.set(singleOrderKey(order._id), order);
    },
    invalidateOrders: () => {
      cache.invalidate(`customer-orders:${userId}:`);
      cache.invalidate(`customer-order:${userId}:`);
    },
    loadOrders(page = 1, options) {
      if (!userId) return Promise.resolve(null);
      return cache.load(ordersKey(page), signal => read("/api/orders/mine", signal, true, {page,pageSize:10}), options);
    },
    peekAddresses: () => cache.peek(addressesKey),
    invalidateAddresses: () => cache.invalidate(addressesKey),
    loadAddresses(options) {
      if (!userId) return Promise.resolve(null);
      return cache.load(addressesKey, signal => read("/api/addresses",signal,true), options);
    },
    peekCatalog: (path, root = "/api/catalog") => catalogCache.peek(`catalog:${root}${path}`),
    setCatalog: (path, root, data) => catalogCache.set(`catalog:${root}${path}`, data),
    invalidateCatalog: () => {
      catalogCache.invalidate("catalog:");
      if (typeof window !== "undefined") {
        try { window.localStorage?.setItem("velours:catalog-updated", String(Date.now())); } catch { /* Ignore storage restrictions. */ }
      }
      notifyCatalog();
    },
    subscribeCatalog: (listener) => {
      catalogListeners.add(listener);
      return () => catalogListeners.delete(listener);
    },
    loadCatalog: (path, root = "/api/catalog", options) => catalogCache.load(`catalog:${root}${path}`,
      signal => read(`${root}${path}`, signal, true), options),
    peekSupportInbox: path => cache.peek(`support-inbox:${path}`),
    setSupportInbox: (path, data) => cache.set(`support-inbox:${path}`, data),
    invalidateSupportInbox: () => cache.invalidate("support-inbox:"),
    invalidateSupport: () => { cache.invalidate("support-inbox:"); supportCache.clear(); },
    loadSupportInbox: (path, options) => cache.load(`support-inbox:${path}`, signal => read(path, signal, true), options),
    peekSupportConversation: id => supportCache.peek(String(id)),
    setSupportConversation(id, snapshot) {
      if (String(snapshot?.conversation?._id) !== String(id)) return;
      const current = mergeSupportSnapshot(supportCache.peek(String(id)), snapshot);
      const bounded = { ...current, messages: current.messages.slice(-50) };
      // Keep recent messages for fast switching; older history remains paginated.
      supportCache.set(String(id), bounded);
      if (userId && String(supportCache.peek(mySupportKey)?.conversation?._id) === String(id)) {
        supportCache.set(mySupportKey, bounded);
      }
    },
    loadSupportConversation(id, options) {
      if (!userId) return Promise.resolve(null);
      return supportCache.load(String(id), signal => read(`/api/support/conversations/${encodeURIComponent(id)}/messages?limit=25`, signal, true), options);
    },
    peekMySupport: () => userId ? supportCache.peek(mySupportKey) : undefined,
    setMySupport(snapshot) {
      if (!userId || !snapshot) return;
      if (snapshot.conversation?._id) {
        const id = String(snapshot.conversation._id);
        const merged = mergeSupportSnapshot(supportCache.peek(id) || supportCache.peek(mySupportKey), snapshot);
        const bounded = { ...merged, messages: merged.messages.slice(-50) };
        supportCache.set(id, bounded);
        supportCache.set(mySupportKey, bounded);
      } else {
        supportCache.set(mySupportKey, snapshot);
      }
    },
    loadMySupport(options) {
      if (!userId) return Promise.resolve(null);
      return supportCache.load(mySupportKey, async signal => {
        const data = await read("/api/support/mine", signal, true);
        if (data?.conversation?._id) {
          const id = String(data.conversation._id);
          const merged = mergeSupportSnapshot(supportCache.peek(id), data);
          supportCache.set(id, { ...merged, messages: merged.messages.slice(-50) });
        }
        return data;
      }, options);
    },
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
