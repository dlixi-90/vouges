// In-memory only. The provider clears this store when the authenticated account changes.
export const createDashboardCache = ({ now = Date.now, maxAge = 30000 } = {}) => {
  const entries = new Map();
  const invalidate = () => {
    for (const entry of entries.values()) {
      entry.savedAt = -Infinity;
      entry.controller?.abort();
      entry.controller = null;
      entry.pending = null;
    }
  };
  return {
    invalidate,
    peek: (key) => entries.get(key)?.data,
    clear() { invalidate(); entries.clear(); },
    updateOrder(order) {
      invalidate();
      for (const entry of entries.values()) {
        if (entry.data) entry.data = {
          ...entry.data,
          orders: entry.data.orders.map((item) => item._id === order._id
            ? { ...item, status: order.status, isPaid: order.isPaid, paidAt: order.paidAt } : item),
        };
      }
    },
    load(key, request, { force = false } = {}) {
      let entry = entries.get(key);
      if (!entry) { entry = { savedAt: -Infinity }; entries.set(key, entry); }
      if (entry.pending) return entry.pending;
      if (!force && entry.data && now() - entry.savedAt < maxAge) return Promise.resolve(entry.data);
      const controller = new AbortController();
      entry.controller = controller;
      entry.pending = Promise.resolve().then(() => {
        controller.signal.throwIfAborted();
        return request(controller.signal);
      }).then((data) => {
        controller.signal.throwIfAborted();
        if (entries.get(key) === entry && entry.controller === controller) {
          entry.data = data;
          entry.savedAt = now();
        }
        return data;
      }).finally(() => {
        if (entry.controller === controller) {
          entry.pending = null;
          entry.controller = null;
        }
      });
      return entry.pending;
    },
  };
};
