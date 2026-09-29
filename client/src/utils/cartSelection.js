import { isSizeAvailable } from "./productStock.js";

export const getCartItemKey = (productId, size) => `${productId}::${size}`;

export const getAvailableCartItems = (items, products) => {
  const productsById = new Map(products.map((product) => [product._id, product]));
  return items.filter((item) => {
    const product = productsById.get(item._id);
    return !product?.isDeleted && product?.sizes?.includes(item.size) &&
      isSizeAvailable(product, item.size);
  });
};

export const changeSizeSelection = (deselected, productId, fromSize, toSize, targetExists) => {
  const sourceKey = getCartItemKey(productId, fromSize);
  const targetKey = getCartItemKey(productId, toSize);
  // A merge must not silently add previously unselected units to checkout.
  const keepDeselected = deselected.has(sourceKey) || (targetExists && deselected.has(targetKey));
  const next = new Set(deselected);
  next.delete(sourceKey);
  next.delete(targetKey);
  if (keepDeselected) next.add(targetKey);
  return next;
};

export const removePurchasedItems = (cartData, purchasedItems) => {
  const nextCartData = structuredClone(cartData);

  for (const item of purchasedItems || []) {
    const productId = String(item.product?._id || item.product || "");
    const currentQuantity = Number(nextCartData[productId]?.[item.size] ?? 0);
    const remainingQuantity = currentQuantity - Number(item.quantity || 0);

    if (!nextCartData[productId]) continue;

    if (remainingQuantity > 0) {
      nextCartData[productId][item.size] = remainingQuantity;
    } else {
      delete nextCartData[productId][item.size];

      if (Object.keys(nextCartData[productId]).length === 0) {
        delete nextCartData[productId];
      }
    }
  }

  return nextCartData;
};
