// A card represents the entire product, so its range includes every priced
// size, including temporarily sold-out ones, independent of a selected filter.
export const getProductPriceRange = product => {
  const price = product?.price || {};
  const sizes = Array.isArray(product?.sizes) && product.sizes.length
    ? product.sizes : Object.keys(price);
  const amounts = sizes.map(size => price[size]).filter(value => typeof value === "number" || typeof value === "string")
    .map(Number).filter(value => Number.isSafeInteger(value) && value > 0);
  if (!amounts.length) return null;
  return { min: Math.min(...amounts), max: Math.max(...amounts) };
};
