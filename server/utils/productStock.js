export const isSourceInventory = (product) => product?.inventoryMode === "source";
export const getSizeQuantity = (product, size) => {
  const quantity = Number(product?.stockBySize?.[size] ?? 0);

  return Number.isFinite(quantity) ? quantity : 0;
};

// A source availability flag is not a physical stock count.
export const getPurchaseLimit = (product, size) => isSourceInventory(product)
  ? product?.sizes?.includes(size) && product.inStockBySize?.[size] === true ? 100 : 0
  : getSizeQuantity(product, size);

export const isSizeEnabled = (product, size) => {
  const savedStatus = product?.inStockBySize?.[size];

  if (typeof savedStatus === "boolean") {
    return savedStatus;
  }

  // Tương thích sản phẩm cũ chưa có inStockBySize.
  return getSizeQuantity(product, size) > 0;
};

export const hasAnyQuantity = (product) => {
  if (isSourceInventory(product)) return Boolean(product?.sizes?.length);
  return (product?.sizes || []).some(
    (size) => getSizeQuantity(product, size) > 0,
  );
};

export const hasAnyEnabledSize = (product) => {
  return (product?.sizes || []).some(
    (size) => (isSourceInventory(product) || getSizeQuantity(product, size) > 0) && isSizeEnabled(product, size),
  );
};

export const isSizeAvailable = (product, size) => {
  return (
    Boolean(product?.inStock) &&
    product?.isPublished !== false && !product?.isDeleted &&
    (isSourceInventory(product) ? product?.sizes?.includes(size) : getSizeQuantity(product, size) > 0) &&
    isSizeEnabled(product, size)
  );
};

export const hasAnyAvailableSize = (product) => {
  return (product?.sizes || []).some((size) => isSizeAvailable(product, size));
};
