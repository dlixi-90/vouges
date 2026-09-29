export const getOrderedCartItems = (cartItems, cartAddedAt = {}) => {
  const items = [];
  let rank = 0;
  for (const [productId, sizes] of Object.entries(cartItems)) {
    for (const [size, quantity] of Object.entries(sizes || {})) {
      if (Number(quantity) <= 0) continue;
      rank += 1;
      const timestamp = Number(cartAddedAt?.[productId]?.[size]);
      items.push({
        _id: productId,
        size,
        addedAt: Number.isFinite(timestamp) && timestamp > 0 ? timestamp : rank,
      });
    }
  }
  return items.sort((a, b) => b.addedAt - a.addedAt || a._id.localeCompare(b._id) || a.size.localeCompare(b.size));
};

export const setCartLineAddedAt = (timestamps, productId, size, addedAt) => ({
  ...timestamps,
  [productId]: { ...timestamps[productId], [size]: addedAt },
});

// Replacing a size must not delete and reinsert the product itself.
export const moveCartSize = (cartItems, productId, fromSize, toSize, quantity) => {
  const next = structuredClone(cartItems);
  next[productId] ||= {};
  delete next[productId][fromSize];
  next[productId][toSize] = quantity;
  return next;
};
