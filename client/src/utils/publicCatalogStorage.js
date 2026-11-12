// Only public catalog responses are kept in this tab. Restored responses are
// placeholders: the first consumer always refreshes their price and stock.
const storageKey = "velours:public-catalog:v1";
const supportedKey = key => typeof key === "string" && /^(browse:|detail:|popular$)/u.test(key);
export const createPublicCatalogStorage = (storage, { now = Date.now, maxAge = 300000, maxEntries = 12, maxLength = 750000 } = {}) => {
  const entries = new Map();
  const valid = entry => entry && supportedKey(entry.key) && Number.isFinite(entry.savedAt)
    && now() >= entry.savedAt && now() - entry.savedAt < maxAge && entry.data?.success === true
    && (entry.key.startsWith("detail:") ? typeof entry.data.product?._id === "string" : Array.isArray(entry.data.products));
  try {
    const raw = storage?.getItem(storageKey);
    if (raw && raw.length <= maxLength) {
      const saved = JSON.parse(raw);
      if (Array.isArray(saved)) for (const entry of saved.slice(-maxEntries)) {
        if (valid(entry)) entries.set(entry.key, entry);
      }
    }
  } catch { /* Storage can be disabled or full without blocking the catalog. */ }
  return {
    peek: key => valid(entries.get(key)) ? entries.get(key).data : undefined,
    set(key, data) {
      if (!supportedKey(key) || !storage) return;
      entries.delete(key);
      entries.set(key, { key, data, savedAt: now() });
      for (const [entryKey, entry] of entries) if (!valid(entry)) entries.delete(entryKey);
      while (entries.size > maxEntries) entries.delete(entries.keys().next().value);
      let raw = JSON.stringify([...entries.values()]);
      while (raw.length > maxLength && entries.size) {
        entries.delete(entries.keys().next().value);
        raw = JSON.stringify([...entries.values()]);
      }
      try { storage.setItem(storageKey, raw); } catch { /* Best effort only. */ }
    },
    clear() {
      entries.clear();
      try { storage?.removeItem(storageKey); } catch { /* Best effort only. */ }
    },
  };
};
