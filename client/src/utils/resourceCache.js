// Shared reads survive component unmounts; account changes dispose the cache.
export const createResourceCache = ({ now = Date.now, maxAge = 30000, maxEntries = 100 } = {}) => {
  const entries = new Map();
  const remove = (key) => {
    entries.get(key)?.controller?.abort();
    entries.delete(key);
  };
  const trim = () => {
    for (const [key, entry] of entries) {
      if (entries.size <= maxEntries) break;
      if (!entry.pending) remove(key);
    }
  };
  return {
    peek: (key) => entries.get(key)?.data,
    invalidate(prefix) {
      for (const key of entries.keys()) if (key.startsWith(prefix)) remove(key);
    },
    clear() { for (const key of entries.keys()) remove(key); },
    set(key, data) {
      remove(key);
      entries.set(key, { data, savedAt: now() });
      trim();
    },
    load(key, request, { force = false } = {}) {
      let entry = entries.get(key);
      if (entry?.pending) return entry.pending;
      if (!force && entry?.data !== undefined && now() - entry.savedAt < maxAge) return Promise.resolve(entry.data);
      if (!entry) { entry = {}; entries.set(key, entry); }
      const controller = new AbortController();
      entry.controller = controller;
      entry.pending = Promise.resolve().then(() => {
        controller.signal.throwIfAborted();
        return request(controller.signal);
      }).then((data) => {
        controller.signal.throwIfAborted();
        if (entries.get(key) === entry) {
          entry.data = data;
          entry.savedAt = now();
        }
        return data;
      }).catch((error) => {
        controller.signal.throwIfAborted();
        throw error;
      }).finally(() => {
        entry.pending = null;
        entry.controller = null;
        trim();
      });
      return entry.pending;
    },
  };
};
