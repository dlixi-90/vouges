const normalize = (value) => typeof value === "string"
  ? value.normalize("NFC").trim().replace(/\s+/g, " ").toLowerCase()
  : "";

export const selectRelatedProducts = (products, product, productId = product._id) => {
  const candidates = products.filter((item) => item._id !== productId && !item.isDeleted);
  const category = normalize(product.category);
  const related = category
    ? candidates.filter((item) => normalize(item.category) === category)
    : [];

  if (related.length) return { products: related.slice(0, 6), isFallback: false };

  // A new category may only contain the current product. Offer other products
  // instead, prioritizing the same type and then the store's popular selections.
  const type = normalize(product.type);
  const score = (item) => (type && normalize(item.type) === type ? 2 : 0)
    + (item.popular ? 1 : 0);
  return {
    products: candidates.sort((a, b) => score(b) - score(a)).slice(0, 6),
    isFallback: true,
  };
};
