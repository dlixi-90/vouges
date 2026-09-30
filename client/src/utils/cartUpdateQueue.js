// Coalesce rapid clicks and serialize writes per cart line. Different lines can
// save independently; an older response must never replace a newer intention.
export const createCartUpdateQueue = ({ onPendingChange = () => {}, delay = 180 } = {}) => {
  const entries = new Map();
  const publish = () => onPendingChange([...entries.keys()]);
  const finish = (entry, result) => {
    clearTimeout(entry.timer);
    entries.delete(entry.key);
    publish();
    entry.waiters.forEach((resolve) => resolve(result));
  };
  const send = async (entry) => {
    if (entries.get(entry.key) !== entry || entry.sending) return;
    entry.sending = true;
    const version = entry.version;
    const quantity = entry.quantity;
    try {
      const data = await entry.send(quantity, entry.controller.signal);
      if (entries.get(entry.key) !== entry) return;
      entry.confirmed = Number(data.quantity ?? quantity);
      entry.onAcknowledged?.(data);
      if (entry.version === version) {
        entry.onChange(entry.confirmed);
        finish(entry, { success: true, quantity: entry.confirmed });
        return;
      }
    } catch (error) {
      if (entries.get(entry.key) !== entry) return;
      if (entry.version === version) {
        entry.onChange(entry.confirmed);
        entry.onError?.(error);
        finish(entry, { success: false, message: error.response?.data?.message || error.message });
        return;
      }
      // A newer (possibly lower) quantity can still succeed after an old write fails.
    }
    entry.sending = false;
    entry.timer = setTimeout(() => send(entry), 0);
  };

  return {
    hasPending: () => entries.size > 0,
    enqueue({ key, quantity, initialQuantity, ...handlers }) {
      let entry = entries.get(key);
      if (!entry) {
        entry = { key, confirmed: initialQuantity, version: 0, waiters: [], controller: new AbortController() };
        entries.set(key, entry);
      }
      Object.assign(entry, handlers, { quantity });
      entry.version += 1;
      entry.onChange(quantity);
      publish();
      const result = new Promise((resolve) => entry.waiters.push(resolve));
      clearTimeout(entry.timer);
      if (!entry.sending) entry.timer = setTimeout(() => send(entry), quantity === 0 ? 0 : delay);
      return result;
    },
    cancelAll() {
      for (const entry of entries.values()) {
        clearTimeout(entry.timer);
        entry.controller.abort();
        entry.waiters.forEach((resolve) => resolve({ success: false, cancelled: true }));
      }
      entries.clear();
      publish();
    },
  };
};
