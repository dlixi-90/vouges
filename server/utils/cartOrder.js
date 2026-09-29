// Older carts have no timestamps. Their stored insertion order is the only
// available baseline; keep these ranks below timestamps of newly added lines.
export const getCartAddedAt = (cartData = {}, saved = {}) => {
  const result = {};
  let rank = 0;
  for (const [productId, sizes] of Object.entries(cartData)) {
    for (const [size, quantity] of Object.entries(sizes || {})) {
      if (Number(quantity) <= 0) continue;
      rank += 1;
      const timestamp = Number(saved?.[productId]?.[size]);
      result[productId] ||= {};
      result[productId][size] = Number.isFinite(timestamp) && timestamp > 0 ? timestamp : rank;
    }
  }
  return result;
};

export const getMissingCartAddedAtUpdates = (cartData, saved) => {
  const normalized = getCartAddedAt(cartData, saved);
  const updates = {};
  for (const [productId, sizes] of Object.entries(normalized)) {
    for (const [size, timestamp] of Object.entries(sizes)) {
      if (saved?.[productId]?.[size] !== timestamp) {
        updates[`cartAddedAt.${productId}.${size}`] = timestamp;
      }
    }
  }
  return updates;
};

export const getNextCartAddedAt = (saved = {}) => Math.max(
  Date.now(),
  ...Object.values(saved).flatMap((sizes) => Object.values(sizes || {}).map((value) => (Number(value) || 0) + 1)),
);
