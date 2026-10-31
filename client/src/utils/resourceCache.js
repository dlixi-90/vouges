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
  const consume = (key, entry, read, signal) => {
    if (!signal) { read.shared = true; return read.promise; }
    const consumer = {};
    read.consumers.add(consumer);
    return new Promise((resolve, reject) => {
      const release = () => { signal.removeEventListener("abort", abort); read.consumers.delete(consumer); };
      const abort = () => {
        release();
        reject(signal.reason);
        if (!read.shared && !read.consumers.size && entry.read === read) {
          entry.read = null; entry.pending = null; entry.controller = null;
          if (entry.data === undefined && entries.get(key) === entry) entries.delete(key);
          read.controller.abort();
        }
      };
      signal.addEventListener("abort", abort, { once: true });
      read.promise.then(data => { release(); resolve(data); }, error => { release(); reject(error); });
    });
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
    load(key, request, { force = false, signal } = {}) {
      if (signal?.aborted) return Promise.reject(signal.reason);
      let entry = entries.get(key);
      if (entry?.pending) return consume(key, entry, entry.read, signal);
      if (!force && entry?.data !== undefined && now() - entry.savedAt < maxAge) return Promise.resolve(entry.data);
      if (!entry) { entry = {}; entries.set(key, entry); }
      const controller = new AbortController();
      entry.controller = controller;
      const read = { controller, consumers: new Set(), shared: false };
      entry.read = read;
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
        if (entry.read === read) { entry.pending = null; entry.controller = null; entry.read = null; }
        trim();
      });
      read.promise = entry.pending;
      return consume(key, entry, read, signal);
    },
  };
};
